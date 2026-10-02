# ADR-011: Rate Limit Store — In-Memory vs Redis (Produksi)

**Tanggal:** 2026-10-02
**Status:** Accepted
**Konteks:** Phase 11.4 — Rate Limit Redis/DB (Optional)

## Latar Belakang

Rate limiting login saat ini menggunakan `FailureRateLimiter` berbasis `Map` in-memory (`src/lib/auth/rate-limit.ts`). Di lingkungan serverless (Vercel), setiap instance memiliki state terpisah → batas efektif = batas × jumlah instance. Untuk perlindungan keras di produksi multi-instance, diperlukan penyimpanan bersama (Redis / tabel Prisma).

## Keputusan

**Gunakan Redis via Upstash (HTTP-based, serverless-friendly) sebagai backend rate limit produksi.**

Alasan:
- Upstash Redis REST API cocok untuk serverless (tidak perlu koneksi persisten/pool)
- Gratis tier cukup untuk rate limit login (10k req/bln)
- Tanpa migrasi Prisma (eksternal store)
- Bisa di-toggle via env var (`RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_TOKEN`)
- Fallback ke in-memory otomatis jika Redis tidak dikonfigurasi

## Implementasi

1. **Abstraksi `RateLimitStore`** — interface yang diimplementasikan oleh `InMemoryStore` (existing) dan `UpstashStore` (baru).
2. **Factory `createRateLimitStore()`** — baca env, kembalikan store yang sesuai.
3. **`LoginRateLimiter`** menerima store via constructor (dependency injection) — backward compatible.
4. **Env vars baru (opsional):**
   - `RATE_LIMIT_REDIS_URL` — Upstash REST URL (contoh: `https://xxx.upstash.io`)
   - `RATE_LIMIT_REDIS_TOKEN` — Upstash REST token
5. **Key schema Redis:** `ratelimit:login:{account|ip}:{key}` → sorted set (score = timestamp ms), TTL = windowMs + buffer.
6. **Test:** Unit test untuk `UpstashStore` (mock fetch) + integration test bila env diset.

## Konsekuensi

- **Positif:** Rate limit konsisten cross-instance di Vercel; tidak menambah dependency berat (`ioredis` butuh native); toggle mudah.
- **Negatif:** Tambah 1 network call per login attempt (latency ~50-100ms Upstash); perlu env vars di produksi.
- **Netral:** In-memory tetap default untuk dev/local/CI (tanpa env Redis).

## Alternatif yang Dipertimbangkan

| Opsi | Kelebihan | Kekurangan | Keputusan |
|------|-----------|------------|-----------|
| Tabel Prisma `RateLimitAttempt` | Terintegrasi, ACID | Tambah migrasi, beban DB login | ❌ |
| `ioredis` (TCP) | Standar, fitur penuh | Butuh connection pool, tidak cocok serverless | ❌ |
| **Upstash (HTTP/REST)** | Serverless-native, gratis tier, simpel | Network call per request | ✅ |
| Vercel KV | Native Vercel | Vendor lock-in, kuota project penuh | ❌ |

## Rencana Rollout

1. Implementasi `UpstashStore` + factory + DI ke `LoginRateLimiter`.
2. Tambah test unit (mock fetch) + test integrasi (butuh env).
3. Dokumentasi di `README.md` section "Rate Limit Production Setup".
4. Deploy: set env vars di Vercel → rate limit konsisten multi-instance.