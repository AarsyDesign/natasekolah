/**
 * Phase 12.6 — Observability: Logger Terstruktur + Metrik Kustom.
 *
 * Cakupan DoD per item (happy / edge / error):
 *  1. Logger Pino      — mode, child logger, formatter dev, fallback aman.
 *  2. Registry metrik  — counter, histogram, label, batas cardinalitas, reset,
 *                        snapshot, helper domain (latensi AI, fallback Cohere,
 *                        rate limit).
 *  3. Wiring nyata     — withAIGenerationLatency (success/failure/sync-throw),
 *                        LoginRateLimiter (allowed/blocked account/blocked ip),
 *                        shouldUseSemanticFallback (5 kasus keputusan).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  logger,
  childLogger,
  loggerMode,
  formatDevLine,
} from "@/lib/observability/logger";
import {
  METRIC_NAMES,
  incrementCounter,
  getCounter,
  observeHistogram,
  getHistogram,
  seriesCount,
  getOverflowCounter,
  metricsSnapshot,
  resetMetrics,
  recordAIGenerationLatency,
  recordSearchFallbackCohere,
  recordRateLimitHit,
} from "@/lib/observability/metrics";
import { withAIGenerationLatency } from "@/lib/ai-generation/ai-generation-service";
import { LoginRateLimiter } from "@/lib/auth/rate-limit";
import { shouldUseSemanticFallback } from "@/lib/operations/semantic-search";

// ---------------------------------------------------------------------------
// 1. Logger terstruktur
// ---------------------------------------------------------------------------

describe("12.6 — Logger terstruktur (Pino)", () => {
  it("loggerMode melaporkan level/json/prod yang konsisten dengan env", () => {
    const mode = loggerMode();
    const expectedLevel = process.env.LOG_LEVEL ?? "silent";
    assert.equal(mode.level, expectedLevel);
    assert.equal(typeof mode.json, "boolean");
    assert.equal(mode.prod, process.env.NODE_ENV === "production");
    // di bawah test runner: bukan production → format non-JSON (kecuali dipaksa)
    assert.equal(mode.json, process.env.LOG_FORMAT === "json");
  });

  it("logger & childLogger mengekspos API log tanpa melempar", () => {
    assert.equal(typeof logger.info, "function");
    assert.equal(typeof logger.warn, "function");
    assert.equal(typeof logger.error, "function");
    const child = childLogger({ requestId: "req-1", institutionId: "inst-1" });
    assert.equal(typeof child.info, "function");
    // level silent di test → tidak ada output, tapi tidak boleh crash
    child.info({ status: 200, durationMs: 3 }, "request");
    logger.debug({ metric: "probe" }, "probe");
  });

  it("formatDevLine mengubah entri JSON pino jadi satu baris ringkas", () => {
    const raw = JSON.stringify({
      level: "warn",
      time: "2026-10-03T10:20:30.123Z",
      msg: "rate limit memblokir request",
      metric: "rate_limit_hits",
      scope: "account",
    });
    const line = formatDevLine(raw);
    assert.ok(line.endsWith("\n"));
    assert.ok(line.includes("WARN"));
    assert.ok(line.includes("rate limit memblokir request"));
    assert.ok(line.includes("metric=rate_limit_hits"));
    assert.ok(line.includes("scope=account"));
    assert.ok(line.includes("10:20:30")); // jam dari timestamp ISO
  });

  it("formatDevLine meneruskan input tidak valid apa adanya (tidak crash)", () => {
    assert.equal(formatDevLine("bukan-json"), "bukan-json");
    const missingMsg = JSON.stringify({ level: "info", time: "2026-10-03T00:00:00.000Z" });
    const line = formatDevLine(missingMsg);
    assert.ok(line.includes("INFO"));
    assert.ok(line.endsWith("\n"));
  });
});

// ---------------------------------------------------------------------------
// 2. Registry metrik
// ---------------------------------------------------------------------------

describe("12.6 — Registry metrik", () => {
  beforeEach(() => resetMetrics());

  it("counter: increment, label terpisah, dan default 0", () => {
    assert.equal(getCounter("probe_count"), 0);
    assert.equal(incrementCounter("probe_count"), 1);
    assert.equal(incrementCounter("probe_count", { scope: "account" }), 1);
    assert.equal(incrementCounter("probe_count", { scope: "account" }), 2);
    assert.equal(incrementCounter("probe_count", { scope: "ip" }, 5), 5);
    assert.equal(getCounter("probe_count", { scope: "account" }), 2);
    assert.equal(getCounter("probe_count", { scope: "ip" }), 5);
    assert.equal(getCounter("probe_count"), 1); // baris tanpa label terpisah
    assert.equal(getCounter("metrik_tidak_ada"), 0);
  });

  it("histogram: count/sum/min/max/avg/p50/p95", () => {
    for (const v of [10, 20, 30, 40]) observeHistogram("probe_ms", v);
    const h = getHistogram("probe_ms");
    assert.ok(h);
    assert.equal(h.count, 4);
    assert.equal(h.sum, 100);
    assert.equal(h.min, 10);
    assert.equal(h.max, 40);
    assert.equal(h.avg, 25);
    assert.ok(h.p50 >= 10 && h.p50 <= 40);
    assert.ok(h.p95 >= h.p50 && h.p95 <= 40);
    assert.equal(getHistogram("metrik_tidak_ada"), null);
  });

  it("histogram mengabaikan nilai non-finite (edge)", () => {
    observeHistogram("probe_ms", Number.NaN);
    observeHistogram("probe_ms", Number.POSITIVE_INFINITY);
    assert.equal(getHistogram("probe_ms"), null);
    observeHistogram("probe_ms", 5);
    assert.equal(getHistogram("probe_ms")?.count, 1);
  });

  it("batas cardinalitas: label melebihi 100 jatuh ke overflow", () => {
    const name = "cardinality_probe";
    for (let i = 0; i < 150; i++) incrementCounter(name, { scope: `s${i}` });
    assert.equal(seriesCount(name), 101); // 100 seri + 1 overflow
    assert.equal(getOverflowCounter(name), 50); // 150 - 100
    // label yang melebihi batas tidak membuat baris baru
    assert.equal(getCounter(name, { scope: "s120" }), 0);
  });

  it("helper domain: latensi AI, fallback Cohere, rate limit", () => {
    recordAIGenerationLatency(120, "success");
    recordAIGenerationLatency(-5, "failure"); // negatif di-clamp ke 0
    const h = getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "success" });
    assert.equal(h?.count, 1);
    assert.equal(h?.sum, 120);
    const hFail = getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "failure" });
    assert.equal(hFail?.count, 1);
    assert.equal(hFail?.min, 0);

    assert.equal(recordSearchFallbackCohere(), 1);
    assert.equal(recordSearchFallbackCohere(), 2);
    assert.equal(getCounter(METRIC_NAMES.SEARCH_FALLBACK_COHERE), 2);

    recordRateLimitHit("account");
    recordRateLimitHit("account");
    recordRateLimitHit("ip");
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "account" }), 2);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "ip" }), 1);
  });

  it("snapshot memuat ketiga metrik wajib; resetMetrics mengosongkan", () => {
    recordAIGenerationLatency(10, "success");
    recordSearchFallbackCohere();
    recordRateLimitHit("ip");

    const snap = metricsSnapshot();
    const counterNames = new Set(snap.counters.map((c) => c.name));
    const histNames = new Set(snap.histograms.map((h) => h.name));
    assert.ok(counterNames.has(METRIC_NAMES.SEARCH_FALLBACK_COHERE));
    assert.ok(counterNames.has(METRIC_NAMES.RATE_LIMIT_HITS));
    assert.ok(histNames.has(METRIC_NAMES.AI_GENERATION_LATENCY_MS));

    resetMetrics();
    const after = metricsSnapshot();
    assert.equal(after.counters.length, 0);
    assert.equal(after.histograms.length, 0);
    assert.equal(getCounter(METRIC_NAMES.SEARCH_FALLBACK_COHERE), 0);
    assert.equal(getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS), null);
  });
});

// ---------------------------------------------------------------------------
// 3a. Wiring metrik latensi AI (withAIGenerationLatency)
// ---------------------------------------------------------------------------

describe("12.6 — Wiring ai_generation_latency_ms", () => {
  beforeEach(() => resetMetrics());

  it("happy: fungsi sukses → outcome success + nilai dikembalikan", async () => {
    const value = await withAIGenerationLatency(async () => "ok");
    assert.equal(value, "ok");
    const h = getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "success" });
    assert.equal(h?.count, 1);
    assert.ok(h!.sum >= 0);
    assert.equal(getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "failure" }), null);
  });

  it("error: fungsi reject → outcome failure + error diteruskan", async () => {
    await assert.rejects(
      withAIGenerationLatency(async () => {
        throw new Error("provider down");
      }),
      /provider down/
    );
    const h = getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "failure" });
    assert.equal(h?.count, 1);
    assert.equal(getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "success" }), null);
  });

  it("edge: throw sinkron tetap tercatat sebagai failure", async () => {
    await assert.rejects(
      withAIGenerationLatency(() => {
        throw new Error("sync boom");
      }),
      /sync boom/
    );
    const h = getHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, { outcome: "failure" });
    assert.equal(h?.count, 1);
  });
});

// ---------------------------------------------------------------------------
// 3b. Wiring metrik rate limit (LoginRateLimiter)
// ---------------------------------------------------------------------------

describe("12.6 — Wiring rate_limit_hits", () => {
  beforeEach(() => resetMetrics());

  const keys = { account: "lembaga:admin@sekolah.id", ip: "10.0.0.7" };

  it("attempt yang diizinkan tidak menghasilkan hit", async () => {
    const limiter = new LoginRateLimiter({
      perAccount: { maxFailures: 5, windowMs: 60_000 },
      perIp: { maxFailures: 5, windowMs: 60_000 },
    });
    const decision = await limiter.check(keys);
    assert.equal(decision.allowed, true);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS), 0);
  });

  it("pemblokiran berbasis akun tercatat dengan scope=account", async () => {
    const limiter = new LoginRateLimiter({
      perAccount: { maxFailures: 1, windowMs: 60_000 },
      perIp: { maxFailures: 50, windowMs: 60_000 },
    });
    const afterFail = await limiter.recordFailure(keys);
    assert.equal(afterFail.allowed, false);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "account" }), 1);

    const check = await limiter.check(keys); // masih diblokir window
    assert.equal(check.allowed, false);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "account" }), 2);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "ip" }), 0);
  });

  it("pemblokiran berbasis IP tercatat dengan scope=ip", async () => {
    const limiter = new LoginRateLimiter({
      perAccount: { maxFailures: 50, windowMs: 60_000 },
      perIp: { maxFailures: 1, windowMs: 60_000 },
    });
    const afterFail = await limiter.recordFailure(keys);
    assert.equal(afterFail.allowed, false);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "ip" }), 1);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "account" }), 0);

    await limiter.check(keys);
    assert.equal(getCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope: "ip" }), 2);
  });
});

// ---------------------------------------------------------------------------
// 3c. Keputusan fallback semantic search (tanpa DB/network)
// ---------------------------------------------------------------------------

describe("12.6 — Keputusan shouldUseSemanticFallback", () => {
  const base = {
    useSemanticFallback: true,
    cohereConfigured: true,
    keywordResultCount: 0,
    minKeywordResults: 3,
    query: "adi",
  };

  it("happy: keyword sedikit → fallback aktif", () => {
    assert.equal(shouldUseSemanticFallback({ ...base, keywordResultCount: 1 }), true);
  });

  it("edge: query panjang >20 char → fallback aktif walau hasil cukup", () => {
    assert.equal(
      shouldUseSemanticFallback({
        ...base,
        keywordResultCount: 10,
        query: "siswa kelas 10 yang izin sakit minggu lalu",
      }),
      true
    );
  });

  it("tanpa fallback: hasil cukup & query pendek", () => {
    assert.equal(
      shouldUseSemanticFallback({ ...base, keywordResultCount: 5 }),
      false
    );
  });

  it("flag dimatikan → tidak fallback", () => {
    assert.equal(
      shouldUseSemanticFallback({ ...base, useSemanticFallback: false }),
      false
    );
  });

  it("Cohere tidak terkonfigurasi → tidak fallback", () => {
    assert.equal(
      shouldUseSemanticFallback({ ...base, cohereConfigured: false }),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// 3d. Middleware: logging request tanpa mengubah perilaku guard
// ---------------------------------------------------------------------------

describe("12.6 — Middleware request logging", () => {
  it("rute terlindungi tanpa sesi → redirect ke /login (dengan log, tanpa throw)", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");
    const request = new NextRequest("http://localhost:3100/students");
    const response = middleware(request);
    assert.equal(response.status, 307);
    const location = response.headers.get("location");
    assert.ok(location?.includes("/login"));
    assert.ok(location?.includes("redirect=%2Fstudents"));
  });

  it("rute terlindungi dengan cookie sesi → diteruskan", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");
    const request = new NextRequest("http://localhost:3100/finance", {
      // Dua nama cookie (prod __Host- vs dev) agar test tahan env NODE_ENV
      headers: {
        cookie: "nata_session=token-abc; __Host-nata_session=token-abc",
      },
    });
    const response = middleware(request);
    assert.equal(response.status, 200);
  });

  it("rute publik (/login) → diteruskan tanpa cek sesi", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");
    const request = new NextRequest("http://localhost:3100/login?expired=1");
    const response = middleware(request);
    assert.equal(response.status, 200);
  });
});
