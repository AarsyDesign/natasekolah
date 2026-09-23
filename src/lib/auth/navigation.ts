export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/**
 * Membatasi redirect setelah login pada path internal aplikasi agar parameter
 * query tidak dapat digunakan sebagai open redirect ke situs lain.
 */
export function getSafePostLoginPath(
  candidate: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH
): string {
  if (
    candidate &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
  ) {
    return candidate;
  }

  return fallback;
}
