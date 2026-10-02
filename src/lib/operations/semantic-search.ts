/**
 * Semantic Search Service — DKAS Bot Cohere Fallback
 * Phase 11.5 — Optional: Cohere API untuk semantic search/rerank
 * 
 * Digunakan sebagai fallback ketika:
 * 1. Query ambigu (hasil keyword search kosong atau tidak relevan)
 * 2. User meminta pencarian bahasa natural (mis. "siswa yang sakit kemarin")
 * 
 * Flow: keyword search (Prisma) → jika hasil < threshold atau user minta semantic → Cohere rerank
 */

import { prisma } from '../prisma';
import type { TenantContext } from '../tenant/context';
import { hasPermission } from '../auth/permissions';
import type { GlobalSearchResultItem } from './types';
import { getCohereProvider, isCohereConfigured } from '../ai-providers/cohere.provider';
import { getAuthenticatedTenantContext } from '../auth/service';
import { searchGlobalEntities } from './search-service';

export interface SemanticSearchOptions {
  query: string;
  ctx: TenantContext;
  useSemanticFallback?: boolean; // default: true jika Cohere terkonfigurasi
  minKeywordResults?: number; // threshold untuk trigger fallback
}

export interface SemanticSearchResult {
  results: GlobalSearchResultItem[];
  source: 'keyword' | 'semantic' | 'hybrid';
  semanticUsed: boolean;
}

/**
 * Bangun korpus dokumen untuk rerank dari data tenant
 * Hanya dipanggil saat butuh semantic fallback
 */
export async function buildSearchCorpus(ctx: TenantContext): Promise<Array<{ id: string; type: string; text: string; href: string; badge?: string }>> {
  const corpus: Array<{ id: string; type: string; text: string; href: string; badge?: string }> = [];

  // Siswa
  if (hasPermission(ctx, 'student:view')) {
    const students = await prisma.student.findMany({
      where: { institutionId: ctx.institutionId },
      select: { id: true, fullName: true, nis: true, nisn: true, status: true },
      take: 200, // batas untuk performa
    });
    for (const s of students) {
      corpus.push({
        id: s.id,
        type: 'STUDENT',
        text: `${s.fullName} NIS ${s.nis} ${s.nisn || ''} ${s.status}`,
        href: `/students?search=${encodeURIComponent(s.nis)}`,
        badge: s.status,
      });
    }
  }

  // Rombel
  if (hasPermission(ctx, 'classroom:view') || hasPermission(ctx, 'academic:view')) {
    const classrooms = await prisma.classroom.findMany({
      where: { institutionId: ctx.institutionId },
      select: { id: true, name: true, gradeLevel: true, academicYear: { select: { name: true } } },
      take: 100,
    });
    for (const c of classrooms) {
      corpus.push({
        id: c.id,
        type: 'CLASSROOM',
        text: `${c.name} Tingkat ${c.gradeLevel || '-'} Tahun Ajaran ${c.academicYear?.name || '-'}`,
        href: '/classrooms',
        badge: c.gradeLevel || 'Rombel',
      });
    }
  }

  // Guru/Staf
  if (hasPermission(ctx, 'staff:view')) {
    const staff = await prisma.user.findMany({
      where: { institutionId: ctx.institutionId },
      select: { id: true, name: true, email: true, roles: true },
      take: 100,
    });
    for (const u of staff) {
      const roleStr = Array.isArray(u.roles) ? u.roles.join(' ') : u.roles;
      corpus.push({
        id: u.id,
        type: 'TEACHER',
        text: `${u.name} ${u.email} ${roleStr}`,
        href: '/teachers',
        badge: 'Guru/Staf',
      });
    }
  }

  // Wali
  if (hasPermission(ctx, 'guardian:view') || hasPermission(ctx, 'student:view')) {
    const guardians = await prisma.guardian.findMany({
      where: { institutionId: ctx.institutionId },
      select: { id: true, fullName: true, phoneWa: true, status: true },
      take: 100,
    });
    for (const g of guardians) {
      corpus.push({
        id: g.id,
        type: 'GUARDIAN',
        text: `${g.fullName} WA ${g.phoneWa} ${g.status}`,
        href: '/students',
        badge: g.status,
      });
    }
  }

  return corpus;
}

/**
 * Konversi hasil rerank Cohere ke format GlobalSearchResultItem
 */
export function mapRerankToResults(
  rerankResults: Array<{ index: number; score: number; text: string }>,
  corpus: Array<{ id: string; type: string; text: string; href: string; badge?: string }>
): GlobalSearchResultItem[] {
  return rerankResults.map(r => {
    const doc = corpus[r.index];
    return {
      id: doc.id,
      type: doc.type as GlobalSearchResultItem['type'],
      title: doc.text.split(' ')[0], // nama pertama sebagai title
      subtitle: doc.text.substring(doc.text.indexOf(' ') + 1),
      href: doc.href,
      badge: doc.badge,
    };
  });
}

/**
 * Semantic Search dengan Cohere Rerank sebagai fallback
 * 
 * 1. Jalankan keyword search dulu (existing searchGlobalEntities)
 * 2. Jika hasil kurang dari minKeywordResults ATAU useSemanticFallback=true:
 *    - Bangun korpus dari data tenant
 *    - Rerank dengan Cohere
 *    - Return hasil rerank (top 20)
 */
export async function searchGlobalEntitiesWithSemanticFallback(
  options: SemanticSearchOptions
): Promise<SemanticSearchResult> {
  const { query, ctx, useSemanticFallback = true, minKeywordResults = 3 } = options;

  // 1. Keyword search dulu (cepat, tidak butuh API eksternal)
  const keywordResults = await searchGlobalEntities(ctx, query);

  // Cek apakah butuh semantic fallback
  const needFallback = useSemanticFallback && 
    isCohereConfigured() && 
    (keywordResults.length < minKeywordResults || query.length > 20); // query panjang = kemungkinan natural language

  if (!needFallback) {
    return {
      results: keywordResults,
      source: 'keyword',
      semanticUsed: false,
    };
  }

  try {
    // 2. Bangun korpus & rerank dengan Cohere
    const provider = getCohereProvider();
    const corpus = await buildSearchCorpus(ctx);
    
    if (corpus.length === 0) {
      return { results: keywordResults, source: 'keyword', semanticUsed: false };
    }

    const documents = corpus.map(d => d.text);
    const reranked = await provider.rerank(query, documents, 20); // top 20
    
    const semanticResults = mapRerankToResults(reranked, corpus);

    return {
      results: semanticResults,
      source: keywordResults.length > 0 ? 'hybrid' : 'semantic',
      semanticUsed: true,
    };
  } catch (error) {
    // Fallback gagal (rate limit, network, dll) → return keyword results
    console.error('[SemanticSearch] Cohere rerank failed, falling back to keyword:', error);
    return {
      results: keywordResults,
      source: 'keyword',
      semanticUsed: false,
    };
  }
}

/**
 * Server Action wrapper untuk semantic search
 * Bisa dipakai oleh GlobalSearchDialog atau DKAS Bot
 */
export async function searchGlobalSemanticAction(
  query: string,
  useSemantic: boolean = true
): Promise<{ success: boolean; data?: GlobalSearchResultItem[]; source?: string; error?: string }> {
  try {
    const ctx = await getAuthenticatedTenantContext();
    
    if (!ctx) {
      return { success: false, error: 'Sesi tidak valid' };
    }

    const result = await searchGlobalEntitiesWithSemanticFallback({
      query,
      ctx,
      useSemanticFallback: useSemantic,
    });

    return {
      success: true,
      data: result.results,
      source: result.source,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}