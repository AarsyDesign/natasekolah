"use server";

import { getAuthenticatedTenantContext } from "../lib/auth/service";
import { getDashboardSnapshot } from "../lib/dashboard";

export async function getDashboardSnapshotAction() {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await getDashboardSnapshot(ctx);
    return { success: true, data };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat dashboard operasional.",
    };
  }
}
