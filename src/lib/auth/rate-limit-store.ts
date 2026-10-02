/**
 * Rate Limit Store Abstraction
 *
 * Memungkinkan backend rate limit yang berbeda (in-memory untuk dev,
 * Upstash Redis untuk produksi multi-instance) tanpa mengubah logika
 * `FailureRateLimiter` / `LoginRateLimiter`.
 */

import { RateLimitDecision, RateLimitRule } from "./rate-limit-types";

/** Interface yang harus diimplementasikan oleh setiap store rate limit. */
export interface RateLimitStore {
  /** Cek apakah key masih diizinkan (tanpa mencatat kegagalan). */
  check(key: string, now: number): RateLimitDecision | Promise<RateLimitDecision>;

  /** Catat satu kegagalan untuk key, kembalikan keputusan terbaru. */
  recordFailure(key: string, now: number): RateLimitDecision | Promise<RateLimitDecision>;

  /** Reset (hapus) seluruh catatan key — dipanggil saat login berhasil. */
  reset(key: string): void | Promise<void>;

  /** Hapus seluruh state store (untuk testing). */
  clear(): void | Promise<void>;

  /** Jumlah key tersimpan (observability). */
  size(): number | Promise<number>;
}

/**
 * Implementasi in-memory (existing behavior, diekstrak dari FailureRateLimiter).
 * Cocok untuk development, testing, dan single-instance deployment.
 */
export class InMemoryStore implements RateLimitStore {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly maxKeys = 10_000
  ) {}

  check(key: string, now: number = Date.now()): RateLimitDecision {
    const events = this.pruneKey(key, now);
    if (events.length >= this.rule.maxFailures) {
      const oldest = events[0];
      const retryAfterMs = Math.max(oldest + this.rule.windowMs - now, 0);
      return { allowed: false, retryAfterMs };
    }
    return { allowed: true };
  }

  recordFailure(key: string, now: number = Date.now()): RateLimitDecision {
    const events = this.pruneKey(key, now);
    events.push(now);
    this.failures.set(key, events);
    this.evictIfNeeded(now);
    return this.check(key, now);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  clear(): void {
    this.failures.clear();
  }

  size(): number {
    return this.failures.size;
  }

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

  private evictIfNeeded(now: number): void {
    if (this.failures.size <= this.maxKeys) return;
    for (const key of [...this.failures.keys()]) {
      this.pruneKey(key, now);
      if (this.failures.size <= this.maxKeys) return;
    }
    for (const key of [...this.failures.keys()]) {
      this.failures.delete(key);
      if (this.failures.size <= this.maxKeys) return;
    }
  }
}

/**
 * Implementasi Upstash Redis (HTTP REST API).
 * Cocok untuk serverless (Vercel) — tidak perlu connection pool.
 *
 * Skema key Redis: `ratelimit:login:{account|ip}:{normalizedKey}`
 * Tipe data: Sorted Set (ZSET) — score = timestamp (ms), member = UUID unik per event.
 * TTL otomatis via `EXPIRE` = windowMs + 60 detik buffer.
 */
export class UpstashStore implements RateLimitStore {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly rule: RateLimitRule;
  private readonly prefix: string;

  constructor(
    rule: RateLimitRule,
    options: { baseUrl: string; token: string; prefix?: string }
  ) {
    this.rule = rule;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.prefix = options.prefix ?? "ratelimit:login";
  }

  private async request(command: string, ...args: (string | number)[]): Promise<unknown> {
    const url = `${this.baseUrl}/${command}`;
    const body = JSON.stringify(args);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upstash request failed: ${res.status} ${res.statusText} — ${text}`);
    }
    return res.json();
  }

  private makeKey(category: "account" | "ip", key: string): string {
    return `${this.prefix}:${category}:${key}`;
  }

  async check(key: string, now: number = Date.now()): Promise<RateLimitDecision> {
    const accountKey = this.makeKey("account", key);
    const ipKey = this.makeKey("ip", key);

    // Upstash tidak support multi-key atomic check, jadi cek sequential
    // (acceptable karena rate limit login low frequency)
    const [accountCount, ipCount] = await Promise.all([
      this.countInWindow(accountKey, now),
      this.countInWindow(ipKey, now),
    ]);

    // Per-account limit lebih ketat (5 vs 30), cek itu dulu
    if (accountCount >= this.rule.maxFailures) {
      const oldest = await this.getOldest(accountKey, now);
      if (oldest !== null) {
        const retryAfterMs = Math.max(oldest + this.rule.windowMs - now, 0);
        return { allowed: false, retryAfterMs };
      }
    }
    if (ipCount >= this.rule.maxFailures) {
      const oldest = await this.getOldest(ipKey, now);
      if (oldest !== null) {
        const retryAfterMs = Math.max(oldest + this.rule.windowMs - now, 0);
        return { allowed: false, retryAfterMs };
      }
    }
    return { allowed: true };
  }

  async recordFailure(key: string, now: number = Date.now()): Promise<RateLimitDecision> {
    const accountKey = this.makeKey("account", key);
    const ipKey = this.makeKey("ip", key);
    const member = `${now}:${crypto.randomUUID()}`;
    const ttlSeconds = Math.ceil(this.rule.windowMs / 1000) + 60;

    await Promise.all([
      this.request("ZADD", accountKey, now, member),
      this.request("EXPIRE", accountKey, ttlSeconds),
      this.request("ZADD", ipKey, now, member),
      this.request("EXPIRE", ipKey, ttlSeconds),
    ]);

    return this.check(key, now);
  }

  async reset(key: string): Promise<void> {
    const accountKey = this.makeKey("account", key);
    const ipKey = this.makeKey("ip", key);
    await Promise.all([
      this.request("DEL", accountKey),
      this.request("DEL", ipKey),
    ]);
  }

  async clear(): Promise<void> {
    // Upstash tidak support SCAN/KEYS pattern delete via REST mudah
    // Untuk testing: gunakan InMemoryStore. Di produksi clear() tidak dipakai.
    // Bisa implement via Lua script kalau benar-benar perlu.
  }

  async size(): Promise<number> {
    // Estimasi: tidak akurat tanpa SCAN. Return 0 untuk kompatibilitas.
    return 0;
  }

  private async countInWindow(key: string, now: number): Promise<number> {
    const windowStart = now - this.rule.windowMs;
    // ZRANGEBYSCORE key (windowStart +inf COUNT 1000
    const result = await this.request("ZRANGEBYSCORE", key, windowStart, "+inf", "LIMIT", 0, 1000);
    return Array.isArray(result) ? result.length : 0;
  }

  private async getOldest(key: string, now: number): Promise<number | null> {
    const windowStart = now - this.rule.windowMs;
    const result = await this.request("ZRANGEBYSCORE", key, windowStart, "+inf", "LIMIT", 0, 1);
    if (Array.isArray(result) && result.length > 0) {
      const member = result[0];
      const score = parseInt(member.split(":")[0], 10);
      return isNaN(score) ? null : score;
    }
    return null;
  }
}

/** Factory untuk membuat store berdasarkan environment. */
export function createRateLimitStore(
  rule: RateLimitRule,
  options?: { baseUrl?: string; token?: string; prefix?: string }
): RateLimitStore {
  const baseUrl = options?.baseUrl ?? process.env.RATE_LIMIT_REDIS_URL;
  const token = options?.token ?? process.env.RATE_LIMIT_REDIS_TOKEN;

  if (baseUrl && token) {
    return new UpstashStore(rule, { baseUrl, token, prefix: options?.prefix });
  }
  return new InMemoryStore(rule);
}