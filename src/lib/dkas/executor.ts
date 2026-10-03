/**
 * DKAS Bot — Eksekutor Rencana Query (Phase 12.7).
 *
 * Mengubah `QueryPlan` (bentuk netral hasil validasi whitelist) menjadi query
 * Prisma sungguhan.
 *
 * Invariant keamanan:
 * - `institutionId` SELALU disuntikkan dari `ctx.institutionId` — tidak pernah
 *   dari rencana, sehingga lembaga lain tidak mungkin terbaca.
 * - Hanya model & field yang terdaftar di katalog yang bisa tersentuh.
 * - `take` dikunci pada limit ter-validasi (≤ 50) — tanpa pagination liar.
 * - Guard izin diulang di sini (defense in depth terhadap pemanggil lupa).
 */

import { requirePermission } from "../auth/permissions";
import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { DATASETS, type DatasetId, type DkasRow, type QueryPlan } from "./catalog";
import { describePlan } from "./plan";

export interface CompiledQuery {
  where: Record<string, unknown>;
  orderBy: Record<string, unknown>;
  take: number;
}

export function buildCompiledQuery(
  ctx: TenantContext,
  plan: QueryPlan
): CompiledQuery {
  const spec = DATASETS[plan.dataset];
  const and: Record<string, unknown>[] = [{ institutionId: ctx.institutionId }];

  for (const condition of plan.conditions) {
    const fieldSpec = spec.fields[condition.field];
    if (!fieldSpec) {
      // Tidak mungkin terjadi setelah validatePlan; tetap dijaga sebagai jaring.
      throw new Error(`Field "${condition.field}" tidak ada di katalog.`);
    }
    and.push(fieldSpec.where(condition.op, condition.value));
  }

  const orderKey = plan.orderBy ?? spec.defaultOrderBy;
  const orderBy = spec.orderBy[orderKey] ?? spec.orderBy[spec.defaultOrderBy];

  return { where: { AND: and }, orderBy, take: plan.limit };
}

export interface DkasExecution {
  dataset: DatasetId;
  datasetLabel: string;
  rows: DkasRow[];
  total: number;
  truncated: boolean;
  summary: string;
}

/**
 * Jalankan rencana query dan kembalikan baris siap-tampil.
 * `tx` bisa diganti dengan fake repository saat pengujian.
 */
export async function executePlanQuery(
  ctx: TenantContext,
  plan: QueryPlan,
  tx: Record<string, any> = prisma
): Promise<DkasExecution> {
  requirePermission(ctx, "dkas:query");

  const spec = DATASETS[plan.dataset];
  requirePermission(ctx, spec.permission);

  const { where, orderBy, take } = buildCompiledQuery(ctx, plan);

  const delegate = tx[spec.model];
  if (!delegate || typeof delegate.findMany !== "function") {
    throw new Error(`Delegate Prisma "${spec.model}" tidak tersedia.`);
  }

  const rows: Array<Record<string, any>> = await delegate.findMany({
    where,
    orderBy,
    take,
    select: spec.select,
  });

  return {
    dataset: plan.dataset,
    datasetLabel: spec.label,
    rows: rows.map((row) => spec.mapRow(row)),
    total: rows.length,
    truncated: rows.length >= take,
    summary: describePlan(plan),
  };
}
