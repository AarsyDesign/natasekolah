/**
 * Logger terstruktur (Phase 12.6 — Observability).
 *
 * Pino dipilih karena murah di hot path (buffered, non-blocking) dan output
 * JSON yang siap di-*ingest* (Vercel/Datadog/Loki) tanpa parser khusus.
 *
 * - `LOG_LEVEL` (default `info`; `silent` saat test) mengatur tingkat minimal.
 * - `LOG_FORMAT=json` memaksa JSON mentah; selain itu di dev memakai format
 *   tunggal-baris yang enak dibaca — tanpa dependensi `pino-pretty`.
 * - Stream ditulis sendiri (bukan `pino.destination`) supaya aman dipakai
 *   dari middleware Next.js: tanpa sonic-boom/fs dan tanpa `process.stdout`
 *   (dilarang di Edge Runtime) — output lewat `console.log` yang didukung
 *   di semua runtime Next.
 * - Logger ini murni pengamatan: tidak pernah menyentuh domain logika aplikasi
 *   dan tidak pernah mencetak kredensial/token (caller wajib redact).
 */

import pino from "pino";

const isProd = process.env.NODE_ENV === "production";
const isTest =
  process.env.NODE_ENV === "test" ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.env.npm_lifecycle_event === "test";
const level =
  process.env.LOG_LEVEL ?? (isTest ? "silent" : "info");
const forceJson = process.env.LOG_FORMAT === "json";

/** true → JSON mentah (siap ingest); false → format ringkas dev. */
export const structuredLogs = isProd || forceJson;

/**
 * Format satu baris ringkas untuk dev (tanpa dependensi tambahan).
 * Input diharapkan JSON utuh dari pino; bila tidak valid → diteruskan apa adanya.
 */
export function formatDevLine(raw: string): string {
  try {
    const entry = JSON.parse(raw) as Record<string, unknown>;
    const { level: lv, time, msg, ...rest } = entry;
    const clock =
      typeof time === "string" && time.length >= 19
        ? time.slice(11, 19)
        : "";
    const label = typeof lv === "string" ? lv.toUpperCase() : "INFO";
    const extras = Object.entries(rest)
      .map(([k, v]) =>
        v === undefined ? "" : `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`
      )
      .filter(Boolean)
      .join(" ");
    return `${clock} ${label} ${String(msg ?? "")}${extras ? " " + extras : ""}\n`;
  } catch {
    return raw;
  }
}

/**
 * Tulis satu baris log.
 * CATATAN: hanya `console` yang dipakai — `process.stdout` dilarang di Edge
 * Runtime (middleware Next.js dibundle untuk edge) dan static-analyzer Next
 * menolaknya meski sudah dibungkus guard.
 */
function writeOut(line: string): void {
  try {
    console.log(line.replace(/\n$/, ""));
  } catch {
    // logging tidak boleh pernah menjatuhkan pemanggil
  }
}

/** Sink kustom: satu `write` per entri log dari pino. */
const sink: { write(msg: string): void } = {
  write(msg) {
    if (level === "silent") return;
    writeOut(structuredLogs ? msg : formatDevLine(msg));
  },
};

export const logger = pino(
  {
    level,
    base: undefined, // buang pid/host agar baris ringkas
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  sink
);

/**
 * Membuat child logger dengan konteks tetap — dipakai untuk mengikat
 * `requestId` / `institutionId` ke seluruh satu permintaan.
 */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/** Mode yang sedang dipakai (untuk pengujian/inspeksi). */
export function loggerMode(): { level: string; json: boolean; prod: boolean } {
  return { level, json: structuredLogs, prod: isProd };
}
