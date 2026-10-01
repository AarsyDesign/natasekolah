import { redirect } from "next/navigation";
import { getAuthenticatedTenantContext } from "./service";
import {
  TenantContext,
  TenantContextMissingError,
} from "../tenant/context";

/**
 * Tujuan pengalihan ketika sesi pengguna sudah tidak berlaku.
 * `expired=1` dipakai halaman masuk untuk menampilkan pesan pemulihan yang
 * manusiawi (DESIGN.md §14), bukan banner kesalihan mentah.
 */
export const SESSION_EXPIRED_PATH = "/login?expired=1";

/**
 * True hanya untuk sesi yang hilang / tidak valid (cookie ada tapi token
 * kedaluwarsa, dicabut, atau tidak pernah ada). Sesi non-internal (wali murid)
 * dan konteks AsyncLocalStorage yang belum di-set TIDAK dianggap sesi berakhir
 * agar tidak menggiring pengguna ke halaman masuk karena bug panggilan.
 */
export function isSessionExpiredError(err: unknown): boolean {
  if (!(err instanceof TenantContextMissingError)) {
    return false;
  }
  return err.reason === "SESSION_MISSING" || err.reason === "SESSION_INVALID";
}

/**
 * Melempar ulang error sesi berakhir sebagai pengalihan ke halaman masuk.
 * Dipanggil sebagai baris pertama di setiap blok `catch` server action supaya
 * pesan "sesi tidak ditemukan" tidak pernah sampai ke UI sebagai kegagalan biasa.
 */
export function rethrowIfSessionExpired(err: unknown): void {
  if (isSessionExpiredError(err)) {
    redirect(SESSION_EXPIRED_PATH, "replace");
  }
}

/**
 * Pengganti `getAuthenticatedTenantContext` untuk server action yang TIDAK
 * memakai blok `catch` (finance, notifikasi): sesi berakhir langsung menjadi
 * pengalihan, kegagalan lain tetap diteruskan apa adanya.
 */
export async function requireActionSession(
  rawToken?: string
): Promise<TenantContext> {
  try {
    return await getAuthenticatedTenantContext(rawToken);
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    throw err;
  }
}
