/**
 * DKAS Bot — Rate Limit per Pengguna (Phase 12.7).
 *
 * Membatasi jumlah pertanyaan per staf per jendela waktu agar planner AI
 * (yang berbayar/kuatat) tidak bisa dieksploitasi. Memakai abstraksi
 * `RateLimitStore` Phase 11.4 (in-memory default; Upstash bila env produksi
 * diisi) sehingga aturannya konsisten dengan pembatas lain di aplikasi.
 *
 * Setiap pemblokiran juga tercatat pada metrik `rate_limit_hits`
 * (label `scope=account`, Phase 12.6).
 */

import { InMemoryStore, type RateLimitStore } from "../auth/rate-limit-store";
import type { RateLimitRule } from "../auth/rate-limit-types";
import { recordRateLimitHit } from "../observability/metrics";
import { ValidationError } from "../validation/common";

/** Batas default: 20 pertanyaan tiap 5 menit per pengguna. */
export const DKAS_RATE_LIMIT_DEFAULT_MAX = 20;
export const DKAS_RATE_WINDOW_DEFAULT_MS = 5 * 60_000;

function dkasRule(): RateLimitRule {
  const rawMax = Number(process.env.DKAS_RATE_LIMIT_MAX);
  const rawWindow = Number(process.env.DKAS_RATE_LIMIT_WINDOW_MS);
  return {
    maxFailures:
      Number.isFinite(rawMax) && rawMax >= 1
        ? Math.round(rawMax)
        : DKAS_RATE_LIMIT_DEFAULT_MAX,
    windowMs:
      Number.isFinite(rawWindow) && rawWindow >= 1_000
        ? Math.round(rawWindow)
        : DKAS_RATE_WINDOW_DEFAULT_MS,
  };
}

let store: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (!store) store = new InMemoryStore(dkasRule());
  return store;
}

/** Bersihkan state (dipakai pengujian & pergantian konfigurasi env). */
export function resetDkasRateLimit(): void {
  store = null;
}

/**
 * Catat satu pertanyaan; melempar `ValidationError` bila melewati batas.
 * Pemanggil menggunakannya SEBELUM menjalankan planner (hemat panggilan AI).
 */
export async function enforceDkasRateLimit(
  userId: string,
  now: number = Date.now()
): Promise<void> {
  const key = `dkas:${userId}`;
  const active = getStore();

  const decision = await active.check(key, now);
  if (!decision.allowed) {
    recordRateLimitHit("account");
    const seconds = Math.max(1, Math.ceil((decision.retryAfterMs ?? 0) / 1000));
    throw new ValidationError(
      `Terlalu banyak pertanyaan DKAS. Coba lagi dalam ${seconds} detik.`
    );
  }

  await active.recordFailure(key, now);
}
