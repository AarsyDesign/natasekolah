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
 * Helper untuk parsing cookie secara manual dari request headers (misal pada Middleware / Test).
 * Client-safe: tidak bergantung pada `next/headers`.
 */
export function parseSessionTokenFromHeader(
  cookieHeader: string | null | undefined
): string | undefined {
  if (!cookieHeader) return undefined;

  const cookiesList = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookiesList) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return cookie.substring(SESSION_COOKIE_NAME.length + 1);
    }
  }
  return undefined;
}