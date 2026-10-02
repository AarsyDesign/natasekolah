"use server";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "./cookie";

/**
 * Mengambil raw session token dari cookie HTTP request.
 * Hanya boleh dipanggil di Server Component / Server Action / Route Handler.
 */
export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Menyetel raw session token ke dalam cookie HTTP-only yang aman.
 * Catatan Keamanan: Jangan pernah menyimpan data pengguna, peran, atau tenant di dalam cookie.
 * Hanya boleh dipanggil di Server Action / Route Handler.
 */
export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);
}

/**
 * Menghapus cookie sesi saat pengguna keluar (logout).
 * Hanya boleh dipanggil di Server Action / Route Handler.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}