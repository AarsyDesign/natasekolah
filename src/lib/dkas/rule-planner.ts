/**
 * DKAS Bot — Rule Planner deterministik (Phase 12.7).
 *
 * Penerjemah bahasa natural Indonesia sederhana → `QueryPlan` TANPA model AI.
 * Dipakai sebagai:
 *  1. Jalur utama saat `AI_GENERATION_ENABLED` mati (default), dan
 *  2. Fallback non-blocking bila planner LLM gagal / menghasilkan rencana
 *     yang melanggar whitelist.
 *
 * Sifatnya sengaja konservatif: hanya mengenali kata kunci yang sudah
 * didefinisikan; bila tidak ada satu pun dataset yang cocok, ia melempar
 * `ValidationError` berisi contoh pertanyaan yang didukung.
 */

import { ValidationError } from "../validation/common";
import {
  DATASETS,
  DKAS_LIMIT_DEFAULT,
  DKAS_LIMIT_MAX,
  type DatasetId,
  type PlanCondition,
  type QueryPlan,
} from "./catalog";

interface DatasetKeyword {
  dataset: DatasetId;
  words: string[];
}

/**
 * Skor per dataset: jumlah kata kunci yang ditemukan. Seri diputuskan oleh
 * urutan prioritas (kehadiran > izin > nilai > santri) agar "siswa yang alpha"
 * jatuh ke presensi, "izin terlambat kembali" ke tasrih, sedangkan "siswa
 * kelas 7A" jatuh ke buku induk.
 */
const DATASET_KEYWORDS: DatasetKeyword[] = [
  {
    dataset: "kehadiran",
    words: [
      "presensi",
      "kehadiran",
      "absen",
      "absensi",
      "alpha",
      "alpa",
      "tidak hadir",
      "hadir",
      "sakit",
      "rekap kehadiran",
    ],
  },
  {
    dataset: "izin",
    words: [
      "tasrih",
      "izin pulang",
      "izin santri",
      "izin siswa",
      "pulang",
      "berangkat",
      "kembali",
      "overdue",
      "izin",
    ],
  },
  {
    dataset: "nilai",
    words: [
      "nilai",
      "skor",
      "ulangan",
      "penilaian",
      "assessment",
      "ujian",
      "rata-rata nilai",
      "rapor",
      "raport",
    ],
  },
  {
    dataset: "santri",
    words: [
      "siswa",
      "santri",
      "murid",
      "buku induk",
      "alumni",
      "almuni",
      "nisn",
      "didik",
    ],
  },
];

type StatusMap = Record<string, string>;

/**
 * Kata kunci status per dataset (dinilai terhadap teks huruf kecil).
 * Urutan penting: aturan spesifik/frasa panjang didahulukan, lalu teks yang
 * sudah dikonsumsi dimasking supaya frasa turunan tidak ikut cocok
 * (contoh: "belum disetujui" tidak boleh melempar status APPROVED).
 */
const STATUS_KEYWORDS: Record<DatasetId, Array<{ words: string[]; value: string }>> = {
  santri: [
    { words: ["tidak aktif", "nonaktif", "inactive"], value: "INACTIVE" },
    { words: ["sudah lulus", "lulus", "graduated"], value: "GRADUATED" },
    { words: ["pindah", "transferred"], value: "TRANSFERRED" },
    { words: ["alumni", "almuni"], value: "ALUMNI" },
    { words: ["aktif", "active"], value: "ACTIVE" },
  ],
  kehadiran: [
    { words: ["alpha", "alpa", "absen", "absent", "tidak hadir"], value: "ABSENT" },
    { words: ["sakit", "sick"], value: "SICK" },
    { words: ["izin", "ijin", "excused"], value: "EXCUSED" },
    { words: ["hadir", "present", "masuk"], value: "PRESENT" },
  ],
  nilai: [],
  izin: [
    { words: ["belum disetujui", "tidak disetujui", "menunggu", "pending", "diajukan"], value: "PENDING" },
    { words: ["ditolak", "rejected", "tolak"], value: "REJECTED" },
    { words: ["sudah kembali", "selesai", "returned"], value: "RETURNED" },
    { words: ["terlambat", "overdue", "lewati waktu"], value: "OVERDUE" },
    { words: ["disetujui", "approved"], value: "APPROVED" },
  ],
};

const GENDER_KEYWORDS: Array<{ words: string[]; value: string }> = [
  { words: ["laki-laki", "laki laki", "pria", "cowok", "lk"], value: "L" },
  { words: ["perempuan", "wanita", "cewek", "pr perempuan"], value: "P" },
];

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Deteksi dataset dengan skor kata kunci + keputus-serian berdasar prioritas. */
export function detectDataset(rawQuery: string): DatasetId | null {
  const q = normalize(rawQuery);
  let best: { dataset: DatasetId; score: number } | null = null;

  for (const entry of DATASET_KEYWORDS) {
    let score = 0;
    for (const word of entry.words) {
      if (q.includes(word)) score += 1;
    }
    if (score > 0) {
      if (!best || score > best.score) {
        best = { dataset: entry.dataset, score };
      }
    }
  }

  return best ? best.dataset : null;
}

/** Ekstrak kondisi status (satu → equals, banyak → in) untuk dataset terpilih. */
function extractStatus(q: string, dataset: DatasetId): PlanCondition | null {
  const rules = STATUS_KEYWORDS[dataset];
  if (!rules || rules.length === 0) return null;

  let work = q;
  const matched: string[] = [];
  for (const rule of rules) {
    if (rule.words.some((w) => work.includes(w))) {
      if (!matched.includes(rule.value)) matched.push(rule.value);
      // Masking: teks yang sudah dikonsumsi aturan ini dihapus dari kerja
      // berikutnya supaya frasa turunan tidak cocok dua kali.
      for (const w of rule.words) work = work.split(w).join(" ");
    }
  }

  if (matched.length === 0) return null;
  if (matched.length === 1) {
    return { field: "status", op: "equals", value: matched[0] };
  }
  return { field: "status", op: "in", value: matched };
}

function extractGender(q: string): PlanCondition | null {
  for (const rule of GENDER_KEYWORDS) {
    if (rule.words.some((w) => q.includes(w))) {
      return { field: "gender", op: "equals", value: rule.value };
    }
  }
  return null;
}

/** Ambil angka pertama dari pola ambang batas, dipasangkan dengan operatornya. */
function extractThreshold(
  q: string,
  patterns: RegExp[],
  op: "gte" | "lte"
): { op: "gte" | "lte"; value: number } | null {
  for (const pattern of patterns) {
    const m = q.match(pattern);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return { op, value: n };
    }
  }
  return null;
}

/** Rentang tanggal relatif → kondisi `gte`/`lte` pada field tanggal dataset. */
function extractDateRange(
  q: string,
  now: Date
): Array<{ op: "equals" | "gte" | "lte"; value: string }> | null {
  const explicit = q.match(/(\d{4}-\d{2}-\d{2})/);
  if (explicit) return [{ op: "equals", value: explicit[1] }];

  const today = isoDate(now);

  if (q.includes("hari ini")) return [{ op: "equals", value: today }];

  if (q.includes("kemarin")) {
    const y = new Date(now.getTime() - 86_400_000);
    return [
      { op: "gte", value: isoDate(y) },
      { op: "lte", value: isoDate(y) },
    ];
  }

  if (q.includes("minggu ini")) {
    const start = new Date(now.getTime() - 6 * 86_400_000);
    return [{ op: "gte", value: isoDate(start) }];
  }

  if (q.includes("bulan ini")) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return [{ op: "gte", value: isoDate(start) }];
  }

  return null;
}

/** Teks dalam tanda kutip / setelah "nama" → kondisi contains pada nama. */
function extractNamePhrase(q: string): string | null {
  const quoted = q.match(/["“']([^"”']{2,})["”']/);
  if (quoted) return quoted[1].trim();

  const named = q.match(/nama\s+(?:siswa|santri|murid)?\s*([a-z][a-z\s.'-]{1,40})/);
  if (named) return named[1].trim();

  return null;
}

function extractNis(q: string): string | null {
  const m = q.match(/\bnis\s+([a-z0-9][a-z0-9-]{1,15})\b/);
  return m ? m[1] : null;
}

function extractRombel(q: string): string | null {
  const m = q.match(/\bkelas\s+([0-9]{1,2}\s?[a-z]?|[a-z]{2,10})\b/);
  if (m) return m[1].replace(/\s+/g, "");
  const r = q.match(/\brombel\s+([a-z0-9]{1,10})\b/);
  return r ? r[1] : null;
}

/**
 * Susun rencana query dari teks bebas (Indonesia).
 * Melempar `ValidationError` bila tidak ada dataset yang dikenali.
 */
export function planWithRules(rawQuery: string, now: Date = new Date()): QueryPlan {
  const q = normalize(rawQuery);
  if (q.length < 3) {
    throw new ValidationError(
      "Pertanyaan terlalu pendek. Contoh: \"siswa yang alpha hari ini\"."
    );
  }

  const dataset = detectDataset(q);
  if (!dataset) {
    const samples = Object.values(DATASETS)
      .flatMap((d) => d.samples.slice(0, 1))
      .join("; ");
    throw new ValidationError(
      `Saya belum mengenali pertanyaan itu. Coba salah satu contoh: ${samples}.`
    );
  }

  const conditions: PlanCondition[] = [];
  const push = (c: PlanCondition | null | Array<PlanCondition | null>) => {
    const items = Array.isArray(c) ? c : [c];
    for (const item of items) {
      if (item && conditions.length < 5) conditions.push(item);
    }
  };

  push(extractStatus(q, dataset));

  if (dataset === "santri") {
    push(extractGender(q));
  }

  // Ambang batas numerik (hanya dataset yang punya field angka: nilai).
  const spec = DATASETS[dataset];
  const hasNumeric = Object.values(spec.fields).some((f) => f.type === "number");
  if (hasNumeric) {
    const field = Object.values(spec.fields).find((f) => f.type === "number")!.key;
    const lte = extractThreshold(
      q,
      [
        /di\s*bawah\s*(\d+)/,
        /kurang\s*dari\s*(\d+)/,
        /maksimal\s*(\d+)/,
        /lebih\s*kecil\s*dari\s*(\d+)/,
      ],
      "lte"
    );
    const gte = extractThreshold(
      q,
      [
        /di\s*atas\s*(\d+)/,
        /lebih\s*dari\s*(\d+)/,
        /minimal\s*(\d+)/,
        /paling\s*rendah\s*(\d+)/,
      ],
      "gte"
    );
    if (lte) push({ field, op: "lte", value: lte.value });
    if (gte) push({ field, op: "gte", value: gte.value });
  }

  // Rentang tanggal relatif (kehadiran & izin punya field tanggal).
  const hasDate = Object.values(spec.fields).some((f) => f.type === "date");
  if (hasDate) {
    const dateField = Object.values(spec.fields).find((f) => f.type === "date")!.key;
    const range = extractDateRange(q, now);
    if (range) {
      for (const r of range) push({ field: dateField, op: r.op, value: r.value });
    }
  }

  // Rombel (santri & kehadiran).
  if (Object.prototype.hasOwnProperty.call(spec.fields, "rombel")) {
    const rombel = extractRombel(q);
    if (rombel) push({ field: "rombel", op: "contains", value: rombel });
  }

  // Teks bebas / NIS pada field nama yang sesuai.
  const nameField = Object.prototype.hasOwnProperty.call(spec.fields, "nama")
    ? "nama"
    : Object.prototype.hasOwnProperty.call(spec.fields, "siswa")
      ? "siswa"
      : null;
  const nis = dataset === "santri" ? extractNis(q) : null;
  if (nis) {
    push({ field: "nis", op: "equals", value: nis });
  } else if (nameField) {
    const phrase = extractNamePhrase(q);
    if (phrase) push({ field: nameField, op: "contains", value: phrase.slice(0, 120) });
  }

  const limit = /\b(semua|seluruh|all)\b/.test(q) ? DKAS_LIMIT_MAX : DKAS_LIMIT_DEFAULT;

  const plan: QueryPlan = { dataset, conditions, limit };
  plan.orderBy = spec.defaultOrderBy;
  return plan;
}

export type { StatusMap };