#!/usr/bin/env node
/**
 * Bundle Report — Phase 12.4 (Performance: Bundle Analyzer + Code Split).
 * File `.mjs` agar Node memakai mode ESM tanpa menyetel `type: module`
 * di package.json (script JS lama lain masih CommonJS).
 *
 * Mengukur ukuran chunk produksi di `.next/static` (raw + gzip) dan
 * menandai chunk yang melewati budget. Dipakai sebagai gerbang verifikasi
 * agar regresi bundling ketahuan tanpa perlu membuka analyzer visual.
 *
 * Pemakaian:
 *   npm run build && npm run bundle:report
 *
 * Exit code 1 hanya bila ada chunk KLIEN melewati budget (regresi nyata).
 * Chunk server (`.next/server`) sengaja TIDAK dihitung — modul berat
 * seperti `pdfkit`/`docx`/`qrcode` memang harus tetap di server.
 */

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const STATIC_DIR = join(ROOT, ".next", "static");

/** Budget per chunk (gzip). Default 100 kB — sesuai PLAN-PHASE-12 §6. */
const BUDGET_GZ = Number(process.env.BUNDLE_BUDGET_GZ || 100 * 1024);

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

function fmt(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const files = walk(STATIC_DIR);
if (files.length === 0) {
  console.error(
    "[bundle-report] Tidak menemukan chunk. Jalankan `npm run build` dulu."
  );
  process.exit(1);
}

const rows = files.map((file) => {
  const raw = statSync(file).size;
  const gz = gzipSync(readFileSync(file)).length;
  return { file: relative(ROOT, file), raw, gz };
});

rows.sort((a, b) => b.gz - a.gz);

const totalRaw = rows.reduce((s, r) => s + r.raw, 0);
const totalGz = rows.reduce((s, r) => s + r.gz, 0);
const over = rows.filter((r) => r.gz > BUDGET_GZ);

console.log("=== Bundle Report (klien, .next/static) ===");
console.log(`Chunk      : ${rows.length}`);
console.log(`Total raw  : ${fmt(totalRaw)}`);
console.log(`Total gzip : ${fmt(totalGz)}`);
console.log(`Budget/chunk (gz): ${fmt(BUDGET_GZ)}`);
console.log("");
console.log("Top 10 chunk terbesar (gzip):");
for (const r of rows.slice(0, 10)) {
  const flag = r.gz > BUDGET_GZ ? "  ⚠ OVER" : "";
  console.log(`  ${fmt(r.gz).padStart(10)} gz / ${fmt(r.raw).padStart(10)} raw  ${r.file}${flag}`);
}

if (over.length > 0) {
  console.error("");
  console.error(`[bundle-report] ${over.length} chunk melewati budget:`);
  for (const r of over) console.error(`  - ${r.file} (${fmt(r.gz)} gz)`);
  process.exit(1);
}

console.log("");
console.log("[bundle-report] OK — semua chunk klien dalam budget.");
