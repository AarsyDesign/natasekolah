"use server";

import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import {
  listAuditLog,
  getAuditLogFacets,
} from "../lib/audit/audit-query";

/**
 * Phase 12.3 — Server Action AuditLog Query.
 *
 * Guard: `institution:view` (sinonim legacy `audit:read`) di dalam service.
 * Pola standar: `requireActionSession` → `runWithTenantContext` →
 * `rethrowIfSessionExpired` di tiap catch.
 */

export async function listAuditLogAction(filter?: unknown) {
  try {
    const context = await requireActionSession();
    const page = await runWithTenantContext(context, () =>
      listAuditLog(context, filter)
    );
    return { success: true as const, data: page };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error?.message || "Gagal menampilkan jejak audit.",
    };
  }
}

export async function getAuditLogFacetsAction() {
  try {
    const context = await requireActionSession();
    const facets = await runWithTenantContext(context, () =>
      getAuditLogFacets(context)
    );
    return { success: true as const, data: facets };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error?.message || "Gagal memuat opsi filter jejak audit.",
    };
  }
}
