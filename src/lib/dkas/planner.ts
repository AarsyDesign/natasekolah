/**
 * DKAS Bot — Orkestrasi Planner (Phase 12.7).
 *
 * Alur:
 *   pertanyaan → [LLM jika AI_GENERATION_ENABLED] → validatePlan (whitelist)
 *             → fallback rule planner bila LLM gagal/curang
 *             → guard izin dataset → { plan, mode }
 *
 * Non-blocking: kegagalan LLM (mati, timeout, JSON rusak, field di luar
 * whitelist) TIDAK menggagalkan permintaan — selalu jatuh ke rule planner.
 */

import { requirePermission } from "../auth/permissions";
import { logger } from "../observability/logger";
import type { TenantContext } from "../tenant/context";
import { ValidationError } from "../validation/common";
import { DATASETS, type DatasetSpec, type QueryPlan } from "./catalog";
import { isPlannerAIEnabled, planWithLLM } from "./llm-planner";
import { validatePlan } from "./plan";
import { planWithRules } from "./rule-planner";

/** Titik injeksi untuk pengujian (tanpa jaringan / tanpa flag env). */
export interface PlanQueryDeps {
  /** Default: `isPlannerAIEnabled()` (`AI_GENERATION_ENABLED=true`). */
  llmEnabled?: boolean;
  /** Default: `planWithLLM`. */
  llmPlanner?: (query: string) => Promise<unknown>;
}

export interface PlannedQuery {
  plan: QueryPlan;
  /** `ai` = rencana datang dari LLM; `rule` = deterministik (termasuk fallback). */
  mode: "ai" | "rule";
  dataset: DatasetSpec;
  aiEnabled: boolean;
  /** Diisi bila jalur LLM dicoba tetapi gagal (alasan jatuh ke aturan). */
  fallbackReason?: string;
}

/**
 * Susun rencana query aman dari pertanyaan bahasa natural.
 * Guard: `dkas:query` (izin masuk fitur) + `permission` dataset terdeteksi.
 */
export async function planQuery(
  rawQuery: string,
  ctx: TenantContext,
  deps: PlanQueryDeps = {}
): Promise<PlannedQuery> {
  const query = (rawQuery ?? "").trim();
  if (query.length === 0) {
    throw new ValidationError("Pertanyaan tidak boleh kosong.");
  }

  // Gerbang izin fitur (dipertahankan juga di action & executor).
  requirePermission(ctx, "dkas:query");

  const aiEnabled = deps.llmEnabled ?? isPlannerAIEnabled();
  let plan: QueryPlan | null = null;
  let mode: PlannedQuery["mode"] = "rule";
  let fallbackReason: string | undefined;

  if (aiEnabled) {
    try {
      const llm = deps.llmPlanner ?? planWithLLM;
      const rawPlan = await llm(query);
      plan = validatePlan(rawPlan, "planner AI");
      mode = "ai";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fallbackReason = message;
      plan = null;
      logger.warn(
        { err: message },
        "planner LLM DKAS gagal — jatuh ke rule planner deterministik"
      );
    }
  }

  if (!plan) {
    plan = validatePlan(planWithRules(query), "rule planner");
    mode = "rule";
  }

  const dataset = DATASETS[plan.dataset];
  if (!dataset) {
    throw new ValidationError(`Dataset "${plan.dataset}" tidak dikenal.`);
  }

  // Guard per-domain: guru tanpa `pesantren:view` tidak bisa menarik izin, dst.
  requirePermission(ctx, dataset.permission);

  const result: PlannedQuery = {
    plan,
    mode,
    dataset,
    aiEnabled,
  };
  if (fallbackReason) result.fallbackReason = fallbackReason;
  return result;
}
