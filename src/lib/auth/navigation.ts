const DEFAULT_AUTHENTICATED_PATH = "/students";

/**
 * Membatasi redirect setelah login pada path internal aplikasi agar parameter
 * query tidak dapat digunakan sebagai open redirect ke situs lain.
 */
export function getSafePostLoginPath(candidate: string | null | undefined): string {
  if (
    candidate &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\")
  ) {
    return candidate;
  }

  return DEFAULT_AUTHENTICATED_PATH;
}
