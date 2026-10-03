import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { childLogger } from "@/lib/observability/logger";

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-nata_session" : "nata_session";

// Daftar rute publik yang tidak memerlukan sesi aktif
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/api/auth",
  "/login",
  "/daftar",
  "/wali/aktivasi",
  "/verify",
];

/**
 * Middleware Next.js sebagai early routing guard.
 * CATATAN KEAMANAN: Middleware BUKAN satu-satunya boundary keamanan.
 * Server Actions, Route Handlers, dan Domain Services tetap wajib memvalidasi
 * sesi dan otorisasi tenant secara independen pada layer server.
 *
 * Observability (Phase 12.6): tiap request menghasilkan SATU baris log
 * terstruktur (requestId, method, path, status, durationMs) — tanpa cookie,
 * query sensitif, atau kredensial. Logging dibungkus try/catch: kegagalan
 * observasi tidak boleh mematikan request.
 */
export function middleware(request: NextRequest) {
  const startedAt = Date.now();
  const { pathname } = request.nextUrl;
  const requestId = createRequestId();

  let response: NextResponse;

  // Izinkan akses bebas ke homepage landing page visi (PRD 1.1) dan aset statis
  if (pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response = NextResponse.next();
  } else {
    // Cek keberadaan cookie sesi pada rute terlindungi
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next();
    }
  }

  logRequest(request, response.status, Date.now() - startedAt, requestId);
  return response;
}

/** ID permintaan acak (UUID bila tersedia; fallback ke random). */
function createRequestId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // jatuh ke fallback di bawah
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Satu baris log JSON per request; tidak pernah melempar. */
function logRequest(
  request: NextRequest,
  status: number,
  durationMs: number,
  requestId: string
): void {
  try {
    childLogger({ requestId }).info(
      {
        method: request.method,
        path: request.nextUrl.pathname,
        status,
        durationMs,
      },
      "request"
    );
  } catch {
    // observasi gagal → abaikan, request tetap dilayani
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
