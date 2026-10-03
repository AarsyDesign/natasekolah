"use server";

import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { hasPermission, requirePermission } from "../lib/auth/permissions";
import { runWithTenantContext } from "../lib/tenant/context";
import { ValidationError } from "../lib/validation/common";
import { validateDkasQueryInput } from "../lib/validation/dkas";
import { describePlan } from "../lib/dkas/plan";
import { enforceDkasRateLimit } from "../lib/dkas/rate-limit";
import { executePlanQuery } from "../lib/dkas/executor";
import { planQuery } from "../lib/dkas/planner";
import { isPlannerAIEnabled } from "../lib/dkas/llm-planner";
import { DATASETS, DATASET_IDS } from "../lib/dkas/catalog";

/**
 * Phase 12.7 — Server Action DKAS Bot (Natural Language → Query).
 *
 * Rantai: sesi (`requireActionSession`) → guard `dkas:query` → rate limit
 * per pengguna → planner (LLM bila `AI_GENERATION_ENABLED`, selalu jatuh ke
 * rule planner) → guard izin dataset → eksekusi Prisma tenant-scoped.
 * Tiap `catch` memakai `rethrowIfSessionExpired` (kaidah repo).
 *
 * Respons tidak pernah membocorkan objek where mentah — hanya baris hasil
 * siap-tampil + ringkasan rencana berbahasa manusiawi.
 */

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof ValidationError) return message;
  if (/Akses ditolak|tidak memiliki izin/i.test(message)) return message;
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|hang up/i.test(message)) {
    return "Layanan AI tidak dapat dihubungi. Coba lagi nanti atau hubungi administrator lembaga.";
  }
  return "Pertanyaan belum bisa diproses. Coba reformat, misalnya: \"siswa yang alpha hari ini\".";
}

export async function dkasQueryAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();

    // Guard fitur dulu (sebelum memakai kuota rate limit).
    requirePermission(context, "dkas:query");

    const input = validateDkasQueryInput(rawInput);

    // Pembatas jumlah pertanyaan per pengguna (panggilan AI berbayar).
    await enforceDkasRateLimit(context.userId);

    const data = await runWithTenantContext(context, async () => {
      const planned = await planQuery(input.query, context);
      const execution = await executePlanQuery(context, planned.plan);
      return {
        query: input.query,
        dataset: planned.dataset.id,
        datasetLabel: planned.dataset.label,
        datasetDescription: planned.dataset.description,
        mode: planned.mode,
        aiEnabled: planned.aiEnabled,
        aiFlagEnabled: isPlannerAIEnabled(),
        summary: execution.summary || describePlan(planned.plan),
        rows: execution.rows,
        total: execution.total,
        truncated: execution.truncated,
        limit: planned.plan.limit,
        conditions: planned.plan.conditions,
        fallbackReason: planned.fallbackReason ?? null,
        samples: planned.dataset.samples,
      };
    });

    return { success: true as const, data };
  } catch (error: unknown) {
    rethrowIfSessionExpired(error);
    return { success: false as const, error: friendlyError(error) };
  }
}

/** Daftar dataset + contoh pertanyaan untuk chip saran di UI (tanpa query data). */
export async function dkasCatalogAction() {
  try {
    const context = await requireActionSession();
    requirePermission(context, "dkas:query");

    const datasets = DATASET_IDS.map((id) => {
      const spec = DATASETS[id];
      return {
        id,
        label: spec.label,
        description: spec.description,
        // Hanya tampilkan contoh untuk domain yang berhak dilihat pengguna.
        allowed: hasPermission(context, spec.permission),
        samples: spec.samples,
      };
    });

    return {
      success: true as const,
      data: { datasets, aiFlagEnabled: isPlannerAIEnabled() },
    };
  } catch (error: unknown) {
    rethrowIfSessionExpired(error);
    return { success: false as const, error: friendlyError(error) };
  }
}
