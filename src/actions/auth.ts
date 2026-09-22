"use server";

import { clearSessionCookie, setSessionCookie } from "../lib/auth/cookie";
import { loginUser, logoutUser } from "../lib/auth/service";
import { validateLoginInput } from "../lib/validation/auth";

const GENERIC_LOGIN_ERROR = "Identitas lembaga, email, atau kata sandi tidak valid.";

export async function loginAction(input: unknown): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const credentials = validateLoginInput(input);
    const { rawToken } = await loginUser({
      institutionSlug: credentials.institutionSlug,
      email: credentials.email,
      plainPassword: credentials.password,
    });

    await setSessionCookie(rawToken);
    return { success: true };
  } catch {
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }
}

export async function logoutAction(): Promise<{ success: true }> {
  try {
    await logoutUser();
  } finally {
    await clearSessionCookie();
  }

  return { success: true };
}
