"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import {
  getStudentProfileClusters,
  upsertStudentCluster,
} from "../lib/student/profile-service";

/**
 * Phase 9.3 — Server actions Student Full Profile (kluster Dapodik/EMIS).
 * Pola standar: requireActionSession → runWithTenantContext →
 * rethrowIfSessionExpired (guard sesi kedaluwarsa).
 */

export async function getStudentProfileClustersAction(studentId: string) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      getStudentProfileClusters(context, studentId)
    );
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal memuat profil lengkap siswa.",
      code: error.code || "STUDENT_PROFILE_GET_ERROR",
    };
  }
}

export async function upsertStudentClusterAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      upsertStudentCluster(context, rawInput)
    );
    revalidatePath("/students");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menyimpan data profil siswa.",
      code: error.code || "STUDENT_PROFILE_UPSERT_ERROR",
    };
  }
}
