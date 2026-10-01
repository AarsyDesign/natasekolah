"use server";

import { getAuthenticatedTenantContext } from "../lib/auth/service";
import { getOperationalDashboard } from "../lib/operations/dashboard-service";
import { searchGlobalEntities } from "../lib/operations/search-service";
import { rethrowIfSessionExpired } from "../lib/auth/action-session";

/**
 * Server action untuk mengambil ringkasan operasional harian (Command Center).
 */
export async function getOperationalDashboardAction() {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await getOperationalDashboard(ctx);
    return { success: true, data };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat data dasbor operasional.",
    };
  }
}

/**
 * Server action untuk pencarian cepat multi-entitas (Global Search).
 */
export async function searchGlobalAction(query: string) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await searchGlobalEntities(ctx, query);
    return { success: true, data };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menjalankan pencarian data.",
    };
  }
}
