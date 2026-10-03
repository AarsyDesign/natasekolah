/**
 * Registry metrik kustom in-memory (Phase 12.6 — Observability).
 *
 * Tiga metrik wajib sesuai plan Phase 12:
 *  - `ai_generation_latency_ms`        (histogram, label `outcome`)
 *  - `search_fallback_cohere_count`    (counter)
 *  - `rate_limit_hits`                 (counter, label `scope`)
 *
 * Desain:
 *  - Tersistor di memori proses (single instance) — cukup untuk observability
 *    dev/staging; bila butuh cross-instance gunakan backend eksternal (backlog
 *    terblokir rate-limit Redis, keputusan Arsyad).
 *  - Anti high-cardinality: maksimal `MAX_SERIES` kombinasi label per metrik,
 *    selebihnya jatuh ke bucket `__overflow__`.
 *  - Tiap pencatatan juga mengeluarkan baris log terstruktur (logger Level
 *    debug; `rate_limit_hits` naik ke warn karena itu sinyal keamanan).
 *  - `resetMetrics()` disediakan untuk pengujian.
 */

import { logger } from "./logger";

export const METRIC_NAMES = {
  AI_GENERATION_LATENCY_MS: "ai_generation_latency_ms",
  SEARCH_FALLBACK_COHERE: "search_fallback_cohere_count",
  RATE_LIMIT_HITS: "rate_limit_hits",
} as const;

export type MetricLabels = Record<string, string | number | boolean | undefined>;

const MAX_SERIES = 100; // kombinasi label maksimum per metrik
const OVERFLOW_BUCKET = "__overflow__";
const SAMPLE_CAP = 5_000; // jumlah sampel histogram yang disimpan untuk persentil

type HistogramState = {
  count: number;
  sum: number;
  min: number;
  max: number;
  samples: number[];
};

const counters = new Map<string, Map<string, number>>();
const histograms = new Map<string, Map<string, HistogramState>>();

function labelKey(labels?: MetricLabels): string {
  if (!labels) return "";
  return Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(",");
}

/** Ambil (atau buat) series per nama metrik. */
function series<T>(
  registry: Map<string, Map<string, T>>,
  name: string
): Map<string, T> {
  let map = registry.get(name);
  if (!map) {
    map = new Map();
    registry.set(name, map);
  }
  return map;
}

/**
 * Kunci label efektif dengan jaminan batas cardinalitas: kombinasi label baru
 * melebihi `MAX_SERIES` jatuh ke bucket `__overflow__` (bukan baris baru).
 */
function effectiveKey(map: Map<string, unknown>, labels: string): string {
  if (labels === "" || map.has(labels)) return labels;
  return map.size >= MAX_SERIES ? OVERFLOW_BUCKET : labels;
}

/** Tambah counter; kembalikan nilai baru. */
export function incrementCounter(
  name: string,
  labels?: MetricLabels,
  delta = 1
): number {
  const map = series<number>(counters, name);
  const key = effectiveKey(map, labelKey(labels));
  const next = (map.get(key) ?? 0) + delta;
  map.set(key, next);
  return next;
}

/** Baca counter (0 bila metrik/belum ada). */
export function getCounter(name: string, labels?: MetricLabels): number {
  return counters.get(name)?.get(labelKey(labels)) ?? 0;
}

/** Catat satu observasi histogram (nilai non-finite diabaikan). */
export function observeHistogram(
  name: string,
  value: number,
  labels?: MetricLabels
): void {
  if (!Number.isFinite(value)) return;
  const map = series<HistogramState>(histograms, name);
  const key = effectiveKey(map, labelKey(labels));
  let s = map.get(key);
  if (!s) {
    s = { count: 0, sum: 0, min: value, max: value, samples: [] };
    map.set(key, s);
  }
  s.count += 1;
  s.sum += value;
  s.min = Math.min(s.min, value);
  s.max = Math.max(s.max, value);
  if (s.samples.length < SAMPLE_CAP) s.samples.push(value);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(idx, 0)];
}

/** Statistik histogram (null bila metrik/belum ada). */
export function getHistogram(
  name: string,
  labels?: MetricLabels
): {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
} | null {
  const state = histograms.get(name)?.get(labelKey(labels));
  if (!state) return null;
  const sorted = [...state.samples].sort((a, b) => a - b);
  return {
    count: state.count,
    sum: state.sum,
    min: state.min,
    max: state.max,
    avg: state.count === 0 ? 0 : state.sum / state.count,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

/** Jumlah kombinasi label aktif untuk satu metrik (pengujian/inspeksi). */
export function seriesCount(name: string): number {
  return (counters.get(name)?.size ?? 0) + (histograms.get(name)?.size ?? 0);
}

/** Nilai bucket `__overflow__` (seri label yang melebihi batas cardinalitas). */
export function getOverflowCounter(name: string): number {
  return counters.get(name)?.get(OVERFLOW_BUCKET) ?? 0;
}

/** Snapshot utuh seluruh metrik — siap dicetak/di-export. */
export function metricsSnapshot(): {
  counters: Array<{ name: string; labels: string; value: number }>;
  histograms: Array<{
    name: string;
    labels: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
  }>;
} {
  const out_counters: ReturnType<typeof metricsSnapshot>["counters"] = [];
  for (const [name, series] of counters) {
    for (const [labels, value] of series) {
      out_counters.push({ name, labels, value });
    }
  }
  const out_histograms: ReturnType<typeof metricsSnapshot>["histograms"] = [];
  for (const [name, series] of histograms) {
    for (const [labels, state] of series) {
      const sorted = [...state.samples].sort((a, b) => a - b);
      out_histograms.push({
        name,
        labels,
        count: state.count,
        sum: state.sum,
        min: state.min,
        max: state.max,
        avg: state.count === 0 ? 0 : state.sum / state.count,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
      });
    }
  }
  return { counters: out_counters, histograms: out_histograms };
}

/** Kosongkan seluruh metrik (pengujian). */
export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
}

// ---------------------------------------------------------------------------
// Helper domain (dipanggil dari titik integrasi)
// ---------------------------------------------------------------------------

/** Latensi eksekusi generate AI (ms) + outcome. */
export function recordAIGenerationLatency(
  ms: number,
  outcome: "success" | "failure"
): void {
  const value = Number.isFinite(ms) && ms > 0 ? ms : 0;
  observeHistogram(METRIC_NAMES.AI_GENERATION_LATENCY_MS, value, { outcome });
  logger.debug(
    { metric: METRIC_NAMES.AI_GENERATION_LATENCY_MS, outcome, value },
    "ai generation latency tercatat"
  );
}

/** Fallback pencarian ke Cohere terpicu (attempt dicatat). */
export function recordSearchFallbackCohere(): number {
  const value = incrementCounter(METRIC_NAMES.SEARCH_FALLBACK_COHERE);
  logger.debug(
    { metric: METRIC_NAMES.SEARCH_FALLBACK_COHERE, value },
    "fallback semantic search Cohere"
  );
  return value;
}

/** Request diblokir rate limiter. `scope`: account | ip | lainnya. */
export function recordRateLimitHit(scope: string): number {
  const value = incrementCounter(METRIC_NAMES.RATE_LIMIT_HITS, { scope });
  logger.warn(
    { metric: METRIC_NAMES.RATE_LIMIT_HITS, scope, value },
    "rate limit memblokir request"
  );
  return value;
}
