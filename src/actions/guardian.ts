"use server";

import { revalidatePath } from "next/cache";
import { clearSessionCookie, setSessionCookie } from "../lib/auth/server-cookie";
import { activateGuardian, GuardianInvitationError } from "../lib/auth/guardian";
import { validateGuardianActivationInput } from "../lib/validation/guardian";
import { revokeSession } from "../lib/auth/session";
import { getSessionCookie } from "../lib/auth/server-cookie";
import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import { hasPermission } from "../lib/auth/permissions";
import {
  listGuardians,
  updateGuardianProfile,
  deactivateGuardian,
  issueGuardianInvitation,
} from "../lib/guardian/master-data-service";

export async function activateGuardianAction(
  input: unknown
): Promise<{ success: true; redirect: string } | { success: false; error: string }> {
  try {
    const validated = validateGuardianActivationInput(input);
    const { rawToken } = await activateGuardian({
      rawToken: validated.token,
    });

    await setSessionCookie(rawToken);
    return { success: true, redirect: "/wali" };
  } catch (err: unknown) {
    if (err instanceof GuardianInvitationError) {
      return { success: false, error: err.message };
    }
    if (err instanceof Error) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Gagal mengaktivasi akun wali murid. Silakan periksa kembali tautan undangan Anda.",
    };
  }
}

export async function logoutGuardianAction(): Promise<{ success: true }> {
  try {
    const token = await getSessionCookie();
    if (token) {
      await revokeSession(token);
    }
  } finally {
    await clearSessionCookie();
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Phase 9.2 — Guardian Master Data CRUD Staf + Wizard Undangan
// ---------------------------------------------------------------------------

/**
 * Daftar wali murid (filter status + pencarian) beserta relasi anak.
 * `canManage` dihitung dari izin sesi agar tombol aksi hanya tampil
 * bagi peran yang memang berhak (guardian:manage).
 */
export async function listGuardiansAction(filter?: unknown) {
  try {
    const context = await requireActionSession();
    const guardians = await runWithTenantContext(context, () =>
      listGuardians(context, filter)
    );
    return {
      success: true as const,
      data: { guardians, canManage: hasPermission(context, "guardian:manage") },
    };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error.message || "Gagal menampilkan daftar wali murid.",
      code: error.code || "GUARDIAN_LIST_ERROR",
    };
  }
}

export async function updateGuardianAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      updateGuardianProfile(context, rawInput)
    );
    revalidatePath("/guardians");
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error.message || "Gagal memperbarui profil wali murid.",
      code: error.code || "GUARDIAN_UPDATE_ERROR",
    };
  }
}

export async function deactivateGuardianAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      deactivateGuardian(context, rawInput)
    );
    revalidatePath("/guardians");
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error.message || "Gagal menonaktifkan wali murid.",
      code: error.code || "GUARDIAN_DEACTIVATE_ERROR",
    };
  }
}

export async function createGuardianInvitationAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      issueGuardianInvitation(context, rawInput)
    );
    revalidatePath("/guardians");
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: error.message || "Gagal membuat undangan aktivasi wali murid.",
      code: error.code || "GUARDIAN_INVITATION_ERROR",
    };
  }
}
