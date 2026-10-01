"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import { requirePermission, hasPermission } from "../lib/auth/permissions";
import {
  getInstitutionSettings,
  updateInstitutionProfile,
  updateInstitutionTerminology,
  updateInstitutionOperationalSettings,
} from "../lib/settings/institution-service";
import {
  getInstitutionPlugins,
  updateInstitutionPlugins,
} from "../lib/plugins/service";
import {
  listManagedUsers,
  updateUserRoles,
  toggleUserActiveStatus,
  createManagedUser,
} from "../lib/settings/user-service";

/**
 * Server action: Mengambil konfigurasi lengkap lembaga (Profil, Terminologi, Operasional).
 */
export async function getInstitutionSettingsAction() {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await getInstitutionSettings(ctx);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat konfigurasi lembaga.",
    };
  }
}

/**
 * Server action: Memperbarui profil dan identitas lembaga.
 */
export async function updateInstitutionProfileAction(input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await updateInstitutionProfile(ctx, input);
    revalidatePath("/settings");
    revalidatePath("/settings/institution");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui profil lembaga.",
    };
  }
}

/**
 * Server action: Memperbarui kamus istilah terminologi lembaga.
 */
export async function updateInstitutionTerminologyAction(input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await updateInstitutionTerminology(ctx, input);
    revalidatePath("/settings");
    revalidatePath("/settings/terminology");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui terminologi lembaga.",
    };
  }
}

/**
 * Server action: Memperbarui pengaturan operasional domain (Presensi, Keuangan, Komunikasi).
 */
export async function updateInstitutionOperationalSettingsAction(input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await updateInstitutionOperationalSettings(ctx, input);
    revalidatePath("/settings");
    revalidatePath("/settings/operations");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui aturan operasional.",
    };
  }
}

/**
 * Server action: Mengambil daftar plugin aktif dan plugin tersedia.
 */
export async function getInstitutionPluginsAction() {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await getInstitutionPlugins(ctx.institutionId);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat konfigurasi plugin.",
    };
  }
}

/**
 * Server action: Memperbarui plugin domain aktif pada institusi.
 */
export async function updateInstitutionPluginsAction(input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    requirePermission(ctx, "institution:manage");
    const data = await updateInstitutionPlugins(ctx.institutionId, input);
    revalidatePath("/settings");
    revalidatePath("/settings/plugins");
    revalidatePath("/dashboard");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui konfigurasi plugin.",
    };
  }
}

/**
 * Server action: Mengambil daftar pengguna/staf internal lembaga.
 */
export async function listManagedUsersAction() {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const users = await listManagedUsers(ctx);
    // Flag izin supaya UI bisa menyembunyikan aksi yang memang akan ditolak
    // server (temuan QA 2026-10-01: tombol Tampil untuk peran tanpa staff:manage).
    const canManage = hasPermission(ctx, "staff:manage");
    return { success: true, data: { users, canManage } };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar pengguna.",
    };
  }
}

/**
 * Server action: Memperbarui peran akun staf internal lembaga.
 */
export async function updateUserRolesAction(targetUserId: string, input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await updateUserRoles(ctx, targetUserId, input);
    revalidatePath("/settings/users");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui peran pengguna.",
    };
  }
}

/**
 * Server action: Mengaktifkan atau menonaktifkan akun staf internal.
 */
export async function toggleUserActiveAction(targetUserId: string, input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await toggleUserActiveStatus(ctx, targetUserId, input);
    revalidatePath("/settings/users");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengubah status aktif pengguna.",
    };
  }
}

/**
 * Server action: Membuat akun staf/guru baru di lembaga sesi berjalan.
 * `institutionId` berasal dari sesi server — klien tidak bisa memilih lembaga lain.
 */
export async function createManagedUserAction(input: unknown) {
  try {
    const ctx = await getAuthenticatedTenantContext();
    const data = await createManagedUser(ctx, input);
    revalidatePath("/settings/users");
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat pengguna baru.",
    };
  }
}
