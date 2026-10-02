/**
 * Cohere Provider — Semantic Search & Rerank
 * Phase 11.5 — DKAS Bot Cohere Semantic Search (Optional)
 * 
 * Digunakan sebagai fallback untuk pencarian semantik ketika query ambigu
 * dan pencarian keyword (Prisma contains) tidak memberikan hasil relevan.
 * Free tier: 1M requests/bulan (Cohere API).
 */

import { IAIProvider, SendAIResult } from './provider.interface';

export interface CohereEmbedRequest {
  texts: string[];
  model?: string;
  inputType?: 'search_query' | 'search_document' | 'classification' | 'clustering';
}

export interface CohereEmbedResponse {
  id: string;
  embeddings: {
    float?: number[][];
    int8?: number[][];
    ubinary?: string[];
  };
  meta: {
    apiVersion: { version: string };
    billedUnits: { inputTokens: number };
  };
}

export interface CohereRerankRequest {
  query: string;
  documents: string[];
  model?: string;
  topN?: number;
  returnDocuments?: boolean;
}

export interface CohereRerankResponse {
  id: string;
  results: Array<{
    index: number;
    relevanceScore: number;
    document?: { text: string };
  }>;
  meta: {
    apiVersion: { version: string };
    billedUnits: { inputTokens: number };
  };
}

export interface CohereGenerateRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface CohereGenerateResponse {
  id: string;
  generations: Array<{
    text: string;
    finishReason: string;
  }>;
  meta: {
    apiVersion: { version: string };
    billedUnits: { inputTokens: number; outputTokens: number };
  };
}

const COHERE_API_URL = 'https://api.cohere.com/v2';
const DEFAULT_EMBED_MODEL = 'embed-english-v3.0';
const DEFAULT_RERANK_MODEL = 'rerank-english-v3.0';
const DEFAULT_GENERATE_MODEL = 'command-r-plus';

export class CohereProvider implements IAIProvider {
  readonly id = 'cohere';
  readonly name = 'Cohere';
  readonly supportedModels = ['command-r-plus', 'command-r', 'embed-english-v3.0', 'rerank-english-v3.0'];

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.COHERE_API_KEY || '';
    this.baseUrl = process.env.COHERE_BASE_URL || COHERE_API_URL;
  }

  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new Error('COHERE_API_KEY tidak dikonfigurasi');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cohere API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Generate embeddings untuk teks (query atau dokumen)
   * Digunakan untuk semantic search / vector similarity
   */
  async embed(texts: string[], inputType: 'search_query' | 'search_document' = 'search_document'): Promise<number[][]> {
    if (!this.apiKey) {
      return [];
    }
    const response = await this.request<CohereEmbedResponse>('/embed', {
      texts,
      model: DEFAULT_EMBED_MODEL,
      inputType,
      embeddingTypes: ['float'],
    });

    return response.embeddings.float || [];
  }

  /**
   * Rerank dokumen berdasarkan relevance terhadap query
   * Mengembalikan top-N dokumen paling relevan dengan skor
   */
  async rerank(query: string, documents: string[], topN?: number): Promise<Array<{ index: number; score: number; text: string }>> {
    const response = await this.request<CohereRerankResponse>('/rerank', {
      query,
      documents,
      model: DEFAULT_RERANK_MODEL,
      topN: topN || documents.length,
      returnDocuments: true,
    });

    return response.results.map(r => ({
      index: r.index,
      score: r.relevanceScore,
      text: r.document?.text || documents[r.index],
    }));
  }

  /**
   * Generate text (completion) — untuk generasi jawaban bot
   * Implementasi IAIProvider.generateQuestions tidak dipakai untuk Cohere
   * (Cohere dipakai untuk search/rerank/generate jawaban, bukan generate soal)
   */
  async generateQuestions(prompt: string, model: string, params: {
    type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    topic?: string;
    count: number;
  }): Promise<SendAIResult> {
    // Cohere tidak digunakan untuk generate soal — ini untuk AI Generator (Phase 8)
    // Method ini hanya untuk memenuhi interface IAIProvider
    return {
      success: false,
      errorMessage: 'Cohere provider tidak mendukung generateQuestions (digunakan untuk semantic search/rerank)',
      isPermanentError: true,
    };
  }

  /**
   * Generate jawaban bebas untuk DKAS Bot
   */
  async generateAnswer(prompt: string, options?: { model?: string; maxTokens?: number; temperature?: number }): Promise<string> {
    if (!this.apiKey) {
      return '';
    }
    const response = await this.request<CohereGenerateResponse>('/generate', {
      prompt,
      model: options?.model || DEFAULT_GENERATE_MODEL,
      max_tokens: options?.maxTokens || 500,
      temperature: options?.temperature ?? 0.3,
    });

    return response.generations[0]?.text?.trim() || '';
  }

  /**
   * Cek apakah provider terkonfigurasi
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

/**
 * Singleton instance
 */
let cohereInstance: CohereProvider | null = null;

export function getCohereProvider(): CohereProvider {
  if (!cohereInstance) {
    cohereInstance = new CohereProvider();
  }
  return cohereInstance;
}

export function isCohereConfigured(): boolean {
  return getCohereProvider().isConfigured();
}