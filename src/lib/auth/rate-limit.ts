/**
 * Rate limiting kegagalan login (sliding window, in-memory).
 *
 * Konteks: sebelumnya tidak ada perlindungan brute-force sama sekali pada
 * `loginAction` — pencocokan bcrypt tetap jalan tanpa batas, jadi password
 * bisa ditebak puluhan ribu kali per jam.
 *
 * Dua lapis pembatas:
 *  - per-akun  (slug lembaga + email) -> menghentikan tebakan password satu akun
 *  - per-IP    (x-forwarded-for)      -> menghentikan pencurian kredensial dari satu sumber
 *
 * Batas sengaja longgar untuk orang normal (5 kegagalan / 10 menit per akun
 * sudah lebih dari cukup) namun mematikan serangan otomatis.
 *
 * CATATAN DEPLOY: penyimpanan di memori proses. Di Vercel serverless setiap
 * instance punya hitungan sendiri, jadi batas efektif = batas x jumlah instance.
 * Untuk perlindungan keras butuh penyimpanan bersama (Redis / tabel Prisma);
 * untuk kebutuhan sekarang in-memory sudah memadai dan tidak menambah dependensi.
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

/**
 * Pembatas sliding-window sederhana untuk satu kategori key.
 * `now` dapat disuntikkan agar bisa diuji tanpa tidur (deterministik).
 */
export class FailureRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly maxKeys = 10_000
  ) {}

  /** Apakah key ini masih boleh mencoba? */
  check(key: string, now: number = Date.now()): RateLimitDecision {
    const events = this.pruneKey(key, now);
    if (events.length >= this.rule.maxFailures) {
      const oldest = events[0];
      const retryAfterMs = Math.max(oldest + this.rule.windowMs - now, 0);
      return { allowed: false, retryAfterMs };
    }
    return { allowed: true };
  }

  /** Catat satu kegagalan lalu kembalikan status terbaru. */
  recordFailure(key: string, now: number = Date.now()): RateLimitDecision {
    const events = this.pruneKey(key, now);
    events.push(now);
    this.failures.set(key, events);
    this.evictIfNeeded(now);
    return this.check(key, now);
  }

  /** Lupakan seluruh kegagalan key (dipanggil saat login berhasil). */
  reset(key: string): void {
    this.failures.delete(key);
  }

  /** Hapus seluruh state (untuk pengujian). */
  clear(): void {
    this.failures.clear();
  }

  /** Jumlah key tersimpan (untuk pengujian / observasi). */
  size(): number {
    return this.failures.size;
  }

  /** Buang catatan yang sudah lewat window agar memori tidak bocor. */
  private pruneKey(key: string, now: number): number[] {
    const events = this.failures.get(key);
    if (!events) return [];
    const live = events.filter((t) => now - t < this.rule.windowMs);
    if (live.length === 0) {
      this.failures.delete(key);
    } else {
      this.failures.set(key, live);
    }
    return live;
  }

  /** Jaga agar jumlah key tetap terkendali (mis. serangan pakai ribuan key). */
  private evictIfNeeded(now: number): void {
    if (this.failures.size <= this.maxKeys) return;
    for (const key of [...this.failures.keys()]) {
      this.pruneKey(key, now);
      if (this.failures.size <= this.maxKeys) return;
    }
    // Masih penuh: buang key tertua berdasarkan kejadian paling lama.
    for (const key of [...this.failures.keys()]) {
      this.failures.delete(key);
      if (this.failures.size <= this.maxKeys) return;
    }
  }
}

/** Pasangan key pembatas untuk satu percobaan login. */
export interface LoginAttemptKey {
  account: string;
  ip: string;
}

/** Bentuk aman IP ketika header tidak tersedia (mis. panggilan luar request). */
const UNKNOWN_IP = "unknown";

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
 * Pembatas login resmi aplikasi: menggabungkan pembatas per-akun dan per-IP.
 * Keputusan selalu memakai pembatas yang paling ketat (paling cepat memblokir).
 */
export class LoginRateLimiter {
  private readonly accountLimiter: FailureRateLimiter;
  private readonly ipLimiter: FailureRateLimiter;

  constructor(rule: { perAccount: RateLimitRule; perIp: RateLimitRule } = LOGIN_RATE_LIMITS) {
    this.accountLimiter = new FailureRateLimiter(rule.perAccount);
    this.ipLimiter = new FailureRateLimiter(rule.perIp);
  }

  check(keys: LoginAttemptKey, now: number = Date.now()): RateLimitDecision {
    const byAccount = this.accountLimiter.check(keys.account, now);
    if (!byAccount.allowed) return byAccount;
    return this.ipLimiter.check(keys.ip, now);
  }

  recordFailure(keys: LoginAttemptKey, now: number = Date.now()): RateLimitDecision {
    const byAccount = this.accountLimiter.recordFailure(keys.account, now);
    const byIp = this.ipLimiter.recordFailure(keys.ip, now);
    if (!byAccount.allowed) return byAccount;
    if (!byIp.allowed) return byIp;
    return { allowed: true };
  }

  reset(keys: LoginAttemptKey): void {
    this.accountLimiter.reset(keys.account);
    this.ipLimiter.reset(keys.ip);
  }

  clear(): void {
    this.accountLimiter.clear();
    this.ipLimiter.clear();
  }
}

/** Singleton yang dipakai `loginAction`. */
export const loginRateLimiter = new LoginRateLimiter();
