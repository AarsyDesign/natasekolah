"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  getPromotionCandidates,
  previewBulkPromotion,
  executeBulkPromotion,
} from "../lib/academic";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

/**
 * Server Action: Mengambil calon siswa kenaikan kelas dengan filter & paginasi.
 */
export async function getPromotionCandidatesAction(query: unknown) {
  try {
    const ctx = await getContext();
    const result = await getPromotionCandidates(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat calon siswa kenaikan kelas.",
    };
  }
}

/**
 * Server Action: Prapinjau kenaikan kelas massal (validasi, deteksi konflik, evaluasi status).
 */
export async function previewBulkPromotionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const result = await previewBulkPromotion(ctx, input);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memproses prapinjau kenaikan kelas.",
    };
  }
}

/**
 * Server Action: Eksekusi transaksi kenaikan kelas massal.
 */
export async function executeBulkPromotionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const result = await executeBulkPromotion(ctx, input);
    revalidatePath("/students");
    revalidatePath("/classrooms");
    revalidatePath("/academic-years");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengeksekusi kenaikan kelas massal.",
    };
  }
}
