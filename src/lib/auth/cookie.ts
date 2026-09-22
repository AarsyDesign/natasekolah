import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-nata_session" : "nata_session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 hari dalam detik
};

/**
 * Mengambil raw session token dari cookie HTTP request.
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Menyetel raw session token ke dalam cookie HTTP-only yang aman.
 * Catatan Keamanan: Jangan pernah menyimpan data pengguna, peran, atau tenant di dalam cookie.
 */
export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);
}

/**
 * Menghapus cookie sesi saat pengguna keluar (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Helper untuk parsing cookie secara manual dari request headers (misal pada Middleware / Test).
 */
export function parseSessionTokenFromHeader(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  
  const cookiesList = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookiesList) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return cookie.substring(SESSION_COOKIE_NAME.length + 1);
    }
  }
  return undefined;
}
