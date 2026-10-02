/**
 * Rate limiting kegagalan login (sliding window).
 *
 * Backend storage dapat diganti via `RateLimitStore` abstraction:
 * - InMemoryStore (default, dev/single-instance)
 * - UpstashStore (produksi multi-instance, butuh env RATE_LIMIT_REDIS_URL + TOKEN)
 *
 * Konteks: sebelumnya tidak ada perlindungan brute-force sama sekali pada
 * `loginAction` — pencocokan bcrypt tetap jalan tanpa batas.
 *
 * Dua lapis pembatas:
 *  - per-akun  (slug lembaga + email) -> menghentikan tebakan password satu akun
 *  - per-IP    (x-forwarded-for)      -> menghentikan pencurian kredensial dari satu sumber
 *
 * Batas sengaja longgar untuk orang normal (5 kegagalan / 10 menit per akun
 * sudah lebih dari cukup) namun mematikan serangan otomatis.
 */

import {
  RateLimitDecision,
  RateLimitRule,
  LOGIN_RATE_LIMITS,
  LoginAttemptKey,
  buildLoginAttemptKey,
  formatDurasi,
  UNKNOWN_IP,
} from "./rate-limit-types";
import {
  RateLimitStore,
  InMemoryStore,
  createRateLimitStore,
} from "./rate-limit-store";

/**
 * Pembatas sliding-window untuk satu kategori key.
 * Delegasikan ke `RateLimitStore` (sync atau async).
 */
export class FailureRateLimiter {
  private readonly store: RateLimitStore;

  constructor(
    rule: RateLimitRule,
    store?: RateLimitStore,
    private readonly maxKeys = 10_000
  ) {
    this.store = store ?? new InMemoryStore(rule, maxKeys);
  }

  /** Apakah key ini masih boleh mencoba? */
  async check(key: string, now: number = Date.now()): Promise<RateLimitDecision> {
    const result = this.store.check(key, now);
    return result instanceof Promise ? result : result;
  }

  /** Catat satu kegagalan lalu kembalikan status terbaru. */
  async recordFailure(key: string, now: number = Date.now()): Promise<RateLimitDecision> {
    const result = this.store.recordFailure(key, now);
    return result instanceof Promise ? result : result;
  }

  /** Lupakan seluruh kegagalan key (dipanggil saat login berhasil). */
  async reset(key: string): Promise<void> {
    const result = this.store.reset(key);
    if (result instanceof Promise) await result;
  }

  /** Hapus seluruh state (untuk pengujian). */
  async clear(): Promise<void> {
    const result = this.store.clear();
    if (result instanceof Promise) await result;
  }

  /** Jumlah key tersimpan (untuk pengujian / observasi). */
  async size(): Promise<number> {
    const result = this.store.size();
    return result instanceof Promise ? result : result;
  }

  /** Accessor untuk store internal (testing). */
  getStore(): RateLimitStore {
    return this.store;
  }
}

/**
 * Pembatas login resmi aplikasi: menggabungkan pembatas per-akun dan per-IP.
 * Keputusan selalu memakai pembatas yang paling ketat (paling cepat memblokir).
 */
export class LoginRateLimiter {
  private readonly accountLimiter: FailureRateLimiter;
  private readonly ipLimiter: FailureRateLimiter;

  constructor(
    rule: { perAccount: RateLimitRule; perIp: RateLimitRule } = LOGIN_RATE_LIMITS,
    options?: { accountStore?: RateLimitStore; ipStore?: RateLimitStore }
  ) {
    this.accountLimiter = new FailureRateLimiter(
      rule.perAccount,
      options?.accountStore ?? createRateLimitStore(rule.perAccount)
    );
    this.ipLimiter = new FailureRateLimiter(
      rule.perIp,
      options?.ipStore ?? createRateLimitStore(rule.perIp)
    );
  }

  async check(keys: LoginAttemptKey, now: number = Date.now()): Promise<RateLimitDecision> {
    const byAccount = await this.accountLimiter.check(keys.account, now);
    if (!byAccount.allowed) return byAccount;
    return this.ipLimiter.check(keys.ip, now);
  }

  async recordFailure(keys: LoginAttemptKey, now: number = Date.now()): Promise<RateLimitDecision> {
    const byAccount = await this.accountLimiter.recordFailure(keys.account, now);
    const byIp = await this.ipLimiter.recordFailure(keys.ip, now);
    if (!byAccount.allowed) return byAccount;
    if (!byIp.allowed) return byIp;
    return { allowed: true };
  }

  async reset(keys: LoginAttemptKey): Promise<void> {
    await Promise.all([
      this.accountLimiter.reset(keys.account),
      this.ipLimiter.reset(keys.ip),
    ]);
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.accountLimiter.clear(),
      this.ipLimiter.clear(),
    ]);
  }
}

/** Singleton yang dipakai `loginAction` (backward compatible, in-memory default). */
export const loginRateLimiter = new LoginRateLimiter();

// Re-export types and constants
export {
  LOGIN_RATE_LIMITS,
  buildLoginAttemptKey,
  formatDurasi,
  UNKNOWN_IP,
} from "./rate-limit-types";

export type {
  RateLimitDecision,
  RateLimitRule,
  LoginAttemptKey,
} from "./rate-limit-types";

export type {
  RateLimitStore,
} from "./rate-limit-store";

export {
  InMemoryStore,
  createRateLimitStore,
} from "./rate-limit-store";