/**
 * Rate Limit Shared Types & Constants
 *
 * Tipe-tipe dasar dan konstanta yang dibagi oleh rate-limit.ts dan rate-limit-store.ts
 * untuk menghindari circular dependency.
 */

/** Keputusan hasil pengecekan rate limit. */
export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/** Aturan satu kategori pembatas. */
export interface RateLimitRule {
  /** Jumlah kegagalan maksimum di dalam satu window. */
  maxFailures: number;
  /** Panjang window dalam milidetik. */
  windowMs: number;
}

/** Batas resmi percobaan login gagal. */
export const LOGIN_RATE_LIMITS: Record<"perAccount" | "perIp", RateLimitRule> = {
  perAccount: { maxFailures: 5, windowMs: 10 * 60_000 },
  perIp: { maxFailures: 30, windowMs: 10 * 60_000 },
};

/** Pasangan key pembatas untuk satu percobaan login. */
export interface LoginAttemptKey {
  account: string;
  ip: string;
}

/** Bentuk aman IP ketika header tidak tersedia (mis. panggilan luar request). */
export const UNKNOWN_IP = "unknown";

/**
 * Membangun key pembatas dari kredensial login + klien.
 * Nilai dinormalkan (lowercase, trim) agar bypass lewat kapitalisasi tidak membuang hitungan.
 */
export function buildLoginAttemptKey(input: {
  institutionSlug: string;
  email: string;
  ipAddress?: string;
}): LoginAttemptKey {
  const slug = input.institutionSlug.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const ip = (input.ipAddress ?? "").trim().toLowerCase() || UNKNOWN_IP;
  return { account: `acct:${slug}:${email}`, ip: `ip:${ip}` };
}

/**
 * Durasi manusiawi Bahasa Indonesia: "9 menit 59 detik", bukan angka detik mentah.
 * Tidak diekspor dari `src/actions/*` — di sana semua export wajib async
 * (kaidah Server Actions Next.js), jadi helper sync harus tinggal di lib.
 */
export function formatDurasi(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.floor(seconds / 60)} menit ${seconds % 60} detik`;
}