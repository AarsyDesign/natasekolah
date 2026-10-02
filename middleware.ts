import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Izinkan akses bebas ke homepage landing page visi (PRD 1.1) dan aset statis
  if (pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Cek keberadaan cookie sesi pada rute terlindungi
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
