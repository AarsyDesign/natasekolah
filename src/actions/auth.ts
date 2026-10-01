"use server";

import { headers } from "next/headers";
import { clearSessionCookie, setSessionCookie } from "../lib/auth/cookie";
import { loginUser, logoutUser } from "../lib/auth/service";
import { validateLoginInput } from "../lib/validation/auth";
import {
  buildLoginAttemptKey,
  loginRateLimiter,
  LoginAttemptKey,
  formatDurasi,
} from "../lib/auth/rate-limit";

const GENERIC_LOGIN_ERROR = "Identitas lembaga, email, atau kata sandi tidak valid.";
const THROTTLE_ERROR_PREFIX = "Terlalu banyak percobaan gagal. Coba lagi dalam";

/**
 * Membaca identitas klien dari header request.
 * Dipakai untuk rate limit dan disimpan ke sesi (audit trail login).
 * Aman dipanggil di luar scope request: bila `headers()` melempar, kembalikan undefined.
 */
async function resolveClientIdentity(): Promise<{ ipAddress?: string; userAgent?: string }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const firstHop = forwarded?.split(",")[0]?.trim();
    return {
      ipAddress: firstHop || h.get("x-real-ip") || undefined,
      userAgent: h.get("user-agent") || undefined,
    };
  } catch {
    return {};
  }
}

/** Pesan pembatas yang informatif namun tidak membocorkan status akun. */
function throttleError(decision: { retryAfterMs: number }): string {
  const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  return `${THROTTLE_ERROR_PREFIX} ${formatDurasi(seconds)}.`;
}

export async function loginAction(input: unknown): Promise<{ success: true } | { success: false; error: string }> {
  const { ipAddress, userAgent } = await resolveClientIdentity();
  let keys: LoginAttemptKey | null = null;
  let authenticated = false;

  try {
    const credentials = validateLoginInput(input);

    keys = buildLoginAttemptKey({
      institutionSlug: credentials.institutionSlug,
      email: credentials.email,
      ipAddress,
    });

    // Cek sebelum bcrypt: blokir jauh sebelum verifikasi password dijalankan.
    const decision = loginRateLimiter.check(keys);
    if (!decision.allowed) {
      return { success: false, error: throttleError(decision) };
    }

    const { rawToken } = await loginUser({
      institutionSlug: credentials.institutionSlug,
      email: credentials.email,
      plainPassword: credentials.password,
      ipAddress,
      userAgent,
    });

    authenticated = true;
    loginRateLimiter.reset(keys);
    await setSessionCookie(rawToken);
    return { success: true };
  } catch {
    // Hanya kegagalan autentikasi yang menambah hitungan — kegagalan infra
    // (mis. cookie gagal disetel setelah login sukses) tidak boleh menghukum pengguna.
    if (keys && !authenticated) {
      const decision = loginRateLimiter.recordFailure(keys);
      if (!decision.allowed) {
        return { success: false, error: throttleError(decision) };
      }
    }
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
