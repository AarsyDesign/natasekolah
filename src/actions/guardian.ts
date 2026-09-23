"use server";

import { clearSessionCookie, setSessionCookie } from "../lib/auth/cookie";
import { activateGuardian, GuardianInvitationError } from "../lib/auth/guardian";
import { validateGuardianActivationInput } from "../lib/validation/guardian";
import { revokeSession } from "../lib/auth/session";
import { getSessionCookie } from "../lib/auth/cookie";

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
