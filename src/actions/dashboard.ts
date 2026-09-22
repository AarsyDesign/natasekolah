"use server";

import { getAuthenticatedTenantContext } from "../lib/auth/service";
import { getDashboardSnapshot } from "../lib/dashboard";

export async function getDashboardSnapshotAction(dateInput?: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await getDashboardSnapshot(ctx, dateInput);
    return { success: true, data };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat dashboard operasional.",
    };
  }
}
