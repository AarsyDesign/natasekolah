import * as XLSX from "xlsx";
import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ValidationError } from "../validation/common";
import {
  validateCreateQuestionInput,
  validateQuestionImportRow,
  type CreateQuestionInput,
  type QuestionDifficulty,
  type QuestionStatus,
  type QuestionType,
} from "../validation/question-bank";
import { assertQuestionBankPlugin, insertQuestion } from "./question-service";
import { QuestionImportError } from "./types";
import type { ImportRowAction, ImportRowIssue, ImportRowStatus } from "../importer/types";

/**
 * Impor massal butir soal (xlsx / csv) — mengikuti pola importer siswa
 * (src/lib/importer/*): parse -> preview bervалиdasi -> eksekusi terkonfirmasi.
 *
 * Prinsip keamanan:
 * 1. RBAC Guard (exam:manage) + Plugin Guard FORMAL_ACADEMIC.
 * 2. institutionId & createdById SELALU dari ctx (tidak pernah dari file).
 * 3. subjectId wajib milik lembaga aktif (dicek ulang pada insertQuestion).
 * 4. Setiap baris divalidasi Zod + invariant tipe soal sebelum dianggap VALID.
 */

// ---------------------------------------------------------------------------
// Peta Alias Kolom Spreadsheet
// ---------------------------------------------------------------------------

const QUESTION_COLUMN_ALIASES: Record<string, string[]> = {
  subject: [
    "mapel",
    "mata pelajaran",
    "kode mapel",
    "kode nama mapel",
    "kode mata pelajaran",
    "nama mapel",
    "subject",
    "subject code",
    "subject name",
  ],
  type: ["tipe", "tipe soal", "jenis", "jenis soal", "type", "question type"],
  difficulty: ["tingkat kesulitan", "kesulitan", "difficulty", "level", "tingkat"],
  topic: ["topik", "bab", "topic", "chapter"],
  stem: ["soal", "naskah", "naskah soal", "pertanyaan", "stem", "question", "butir soal"],
  optionA: ["opsi a", "pilihan a", "a", "option a"],
  optionB: ["opsi b", "pilihan b", "b", "option b"],
  optionC: ["opsi c", "pilihan c", "c", "option c"],
  optionD: ["opsi d", "pilihan d", "d", "option d"],
  correctAnswer: [
    "kunci",
    "kunci jawaban",
    "jawaban",
    "jawaban benar",
    "kunci pilihan ganda",
    "correct answer",
    "answer",
    "key",
  ],
  shortAnswerKey: ["jawaban singkat", "kunci jawaban singkat", "short answer", "short answer key"],
  explanation: ["pembahasan", "rubrik", "kunci penskoran", "pedoman penskoran", "explanation"],
  status: ["status", "status soal"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    // Buang petunjuk dalam kurung (mis. "Tipe Soal (MULTIPLE_CHOICE / ...)")
    .replace(/\([^)]*\)/g, " ")
    // Sisakan huruf/angka saja (menghapus *, /, -, ., tanda baca lain)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildQuestionHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const rawHeader of headers) {
    const norm = normalizeHeader(rawHeader);
    for (const [canonical, aliases] of Object.entries(QUESTION_COLUMN_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === norm)) {
        mapping[rawHeader] = canonical;
        break;
      }
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Normalisasi Nilai Sel
// ---------------------------------------------------------------------------

const TYPE_ALIASES: Record<string, QuestionType> = {
  "pilihan ganda": "MULTIPLE_CHOICE",
  pilgan: "MULTIPLE_CHOICE",
  pg: "MULTIPLE_CHOICE",
  "multiple choice": "MULTIPLE_CHOICE",
  multiplechoice: "MULTIPLE_CHOICE",
  pilihan: "MULTIPLE_CHOICE",
  "jawaban singkat": "SHORT_ANSWER",
  "short answer": "SHORT_ANSWER",
  shortanswer: "SHORT_ANSWER",
  isian: "SHORT_ANSWER",
  essay: "ESSAY",
  esai: "ESSAY",
  uraian: "ESSAY",
};

const DIFFICULTY_ALIASES: Record<string, QuestionDifficulty> = {
  mudah: "EASY",
  easy: "EASY",
  ringan: "EASY",
  sedang: "MEDIUM",
  normal: "MEDIUM",
  medium: "MEDIUM",
  sulit: "HARD",
  susah: "HARD",
  berat: "HARD",
  hard: "HARD",
};

const STATUS_ALIASES: Record<string, QuestionStatus> = {
  draft: "DRAFT",
  aktif: "ACTIVE",
  active: "ACTIVE",
  siap: "ACTIVE",
  arsip: "ARCHIVED",
  archived: "ARCHIVED",
  diarsipkan: "ARCHIVED",
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function cellOrNull(value: unknown): string | null {
  const text = cellText(value);
  return text.length > 0 ? text : null;
}

function normalizeEnum<T extends string>(
  value: unknown,
  aliases: Record<string, T>,
  allowed: readonly string[]
): T | null | undefined {
  const text = cellText(value);
  if (!text) return null; // kosong -> biarkan skema menentukan default
  const norm = normalizeHeader(text);
  if ((allowed as readonly string[]).includes(text.toUpperCase())) {
    return text.toUpperCase() as T;
  }
  if (aliases[norm]) return aliases[norm];
  return undefined; // tidak dikenali
}

/** Mengekstrak label kunci (A-D) dari teks bebas: "A", "a.", "A,C", "A dan C". */
function parseCorrectLabels(value: unknown): string[] {
  const text = cellText(value);
  if (!text) return [];
  const tokens = text.split(/[\s,;/|]+/).filter(Boolean);
  const labels: string[] = [];
  for (const token of tokens) {
    const char = token.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
    if (char && "ABCD".includes(char) && !labels.includes(char)) {
      labels.push(char);
    }
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Parser Spreadsheet
// ---------------------------------------------------------------------------

/**
 * Membaca buffer file soal (.xlsx / .xls / .csv) menjadi baris kanonikal.
 */
export function parseQuestionSpreadsheetBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  fileName: string
): {
  rawRows: Record<string, unknown>[];
  headersFound: string[];
  recognizedCanonicalFields: string[];
} {
  const lowerName = fileName.toLowerCase();
  const isAllowedExt =
    lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
  if (!isAllowedExt) {
    throw new QuestionImportError(
      `Format file '${fileName}' tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.`
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  } catch (err: unknown) {
    throw new QuestionImportError(
      `Gagal membaca file spreadsheet: ${err instanceof Error ? err.message : "File rusak atau tidak terbaca"}`
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new QuestionImportError("File spreadsheet tidak memiliki lembar kerja (worksheet).");
  }

  const sheetName =
    workbook.SheetNames.find((name) => /soal|bank|question/i.test(name)) || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new QuestionImportError(`Lembar kerja '${sheetName}' kosong.`);
  }

  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    blankrows: false,
  });
  if (rawJson.length === 0) {
    return { rawRows: [], headersFound: [], recognizedCanonicalFields: [] };
  }

  const rawHeaders = Object.keys(rawJson[0]);
  const mapping = buildQuestionHeaderMapping(rawHeaders);
  const recognized = Array.from(new Set(Object.values(mapping)));

  const rawRows = rawJson.map((row) => {
    const canonicalRow: Record<string, unknown> = {};
    for (const [rawKey, val] of Object.entries(row)) {
      const canonicalKey = mapping[rawKey];
      if (canonicalKey) {
        canonicalRow[canonicalKey] = val;
      } else {
        canonicalRow[rawKey] = val;
      }
    }
    return canonicalRow;
  });

  return { rawRows, headersFound: rawHeaders, recognizedCanonicalFields: recognized };
}

// ---------------------------------------------------------------------------
// Preview Impor
// ---------------------------------------------------------------------------

export interface QuestionPreviewRow {
  rowNumber: number;
  status: ImportRowStatus;
  action: ImportRowAction;
  raw: Record<string, string>;
  payload?: CreateQuestionInput;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
}

export interface QuestionImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  newRecords: number;
  rejectedRows: number;
}

export interface QuestionImportPreviewResult {
  fileName: string;
  summary: QuestionImportSummary;
  rows: QuestionPreviewRow[];
  canProceed: boolean;
}

export interface QuestionImportExecutionResult {
  totalProcessed: number;
  createdQuestions: number;
  skippedRows: number;
  failedRows: number;
  details: Array<{
    rowNumber: number;
    status: "CREATED" | "SKIPPED" | "FAILED";
    message?: string;
  }>;
}

const EMPTY_SUMMARY: QuestionImportSummary = {
  totalRows: 0,
  validRows: 0,
  errorRows: 0,
  newRecords: 0,
  rejectedRows: 0,
};

function toRawStrings(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = cellText(value);
  }
  return out;
}

/**
 * Membangun payload kandidat dari satu baris spreadsheet + resolusi mata pelajaran.
 */
function buildCandidate(row: Record<string, unknown>, subjects: Array<{ id: string; code: string | null; name: string }>): {
  payload?: CreateQuestionInput;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
} {
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];

  const rawType = normalizeEnum(row.type, TYPE_ALIASES, Object.values(TYPE_ALIASES) as string[]);
  const rawDifficulty = normalizeEnum(
    row.difficulty,
    DIFFICULTY_ALIASES,
    Object.values(DIFFICULTY_ALIASES) as string[]
  );
  const rawStatus = normalizeEnum(row.status, STATUS_ALIASES, Object.values(STATUS_ALIASES) as string[]);

  if (rawType === undefined) {
    errors.push({
      field: "type",
      message: `Tipe soal '${cellText(row.type)}' tidak dikenali (gunakan MULTIPLE_CHOICE / SHORT_ANSWER / ESSAY).`,
    });
  }
  if (rawDifficulty === undefined) {
    errors.push({
      field: "difficulty",
      message: `Tingkat kesulitan '${cellText(row.difficulty)}' tidak dikenali (EASY / MEDIUM / HARD).`,
    });
  }
  if (rawStatus === undefined) {
    errors.push({
      field: "status",
      message: `Status '${cellText(row.status)}' tidak dikenali (DRAFT / ACTIVE / ARCHIVED).`,
    });
  }
  if (errors.length > 0) return { errors, warnings };

  // 1. Validasi skema baris impor
  let importRow;
  try {
    importRow = validateQuestionImportRow({
      subject: cellText(row.subject),
      type: rawType,
      difficulty: rawDifficulty ?? "MEDIUM",
      topic: cellOrNull(row.topic),
      stem: cellText(row.stem),
      optionA: cellOrNull(row.optionA),
      optionB: cellOrNull(row.optionB),
      optionC: cellOrNull(row.optionC),
      optionD: cellOrNull(row.optionD),
      correctAnswer: cellOrNull(row.correctAnswer),
      shortAnswerKey: cellOrNull(row.shortAnswerKey),
      explanation: cellOrNull(row.explanation),
      status: rawStatus ?? "DRAFT",
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      errors.push(...err.errors);
      return { errors, warnings };
    }
    throw err;
  }

  // 2. Resolusi mata pelajaran pada lembaga aktif (tenant isolation)
  const subjectNeedle = normalizeHeader(importRow.subject);
  const subject = subjects.find(
    (s) =>
      (s.code && normalizeHeader(s.code) === subjectNeedle) ||
      normalizeHeader(s.name) === subjectNeedle
  );
  if (!subject) {
    errors.push({
      field: "subject",
      message: `Mata pelajaran '${importRow.subject}' tidak ditemukan pada lembaga ini.`,
    });
    return { errors, warnings };
  }

  // 3. Susun opsi pilihan ganda
  const optionContents: Array<{ label: "A" | "B" | "C" | "D"; content: string | null }> = [
    { label: "A", content: importRow.optionA ?? null },
    { label: "B", content: importRow.optionB ?? null },
    { label: "C", content: importRow.optionC ?? null },
    { label: "D", content: importRow.optionD ?? null },
  ];
  const providedOptions = optionContents.filter((opt) => opt.content);
  const correctLabels = parseCorrectLabels(importRow.correctAnswer);

  if (importRow.type === "MULTIPLE_CHOICE") {
    if (providedOptions.length > 0 && providedOptions.length < 4) {
      warnings.push({
        field: "options",
        message: `Hanya ${providedOptions.length} opsi terisi; opsi kosong akan dibuat dengan teks '-' agar genap 4.`,
      });
    }
    while (providedOptions.length < 4 && providedOptions.length < optionContents.length) {
      const emptySlot = optionContents.find((opt) => !opt.content);
      if (!emptySlot) break;
      emptySlot.content = "-";
      providedOptions.push(emptySlot);
    }
    if (correctLabels.length === 0 && importRow.shortAnswerKey) {
      const matched = optionContents.find(
        (opt) => opt.content && normalizeHeader(opt.content) === normalizeHeader(importRow.shortAnswerKey ?? "")
      );
      if (matched) {
        correctLabels.push(matched.label);
        warnings.push({
          field: "correctAnswer",
          message: "Kunci jawaban diambil dari teks yang sama persis dengan salah satu opsi.",
        });
      }
    }
  }

  const options = providedOptions.map((opt) => ({
    label: opt.label,
    content: opt.content ?? "-",
    isCorrect: importRow.type === "MULTIPLE_CHOICE" && correctLabels.includes(opt.label),
  }));

  // 4. Validasi akhir: invariant tipe soal (termasuk deteksi kunci ganda)
  try {
    const payload = validateCreateQuestionInput({
      subjectId: subject.id,
      type: importRow.type,
      difficulty: importRow.difficulty,
      topic: importRow.topic,
      stem: importRow.stem,
      explanation: importRow.explanation,
      shortAnswerKey:
        importRow.type === "SHORT_ANSWER"
          ? importRow.shortAnswerKey ?? importRow.correctAnswer
          : importRow.shortAnswerKey,
      options: importRow.type === "MULTIPLE_CHOICE" ? options : [],
      status: importRow.status,
    });
    return { payload, errors, warnings };
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      errors.push(...err.errors);
      return { errors, warnings };
    }
    throw err;
  }
}

/**
 * Preview impor soal: parse file, validasi tiap baris, tandai baris VALID / ERROR.
 */
export async function generateQuestionImportPreview(
  ctx: TenantContext,
  fileBuffer: Buffer | Uint8Array,
  fileName: string
): Promise<QuestionImportPreviewResult> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Parse file
  const { rawRows } = parseQuestionSpreadsheetBuffer(fileBuffer, fileName);
  if (rawRows.length === 0) {
    return { fileName, summary: { ...EMPTY_SUMMARY }, rows: [], canProceed: false };
  }
  if (rawRows.length > 1000) {
    throw new QuestionImportError(
      `File berisi ${rawRows.length} baris. Batas maksimum impor adalah 1.000 baris per file.`
    );
  }

  // 4. Ambil mata pelajaran lembaga aktif untuk resolusi subjectId
  const subjects = await prisma.subject.findMany({
    where: { institutionId: ctx.institutionId },
    select: { id: true, code: true, name: true },
  });

  // 5. Validasi per baris
  const rows: QuestionPreviewRow[] = rawRows.map((row, index) => {
    const { payload, errors, warnings } = buildCandidate(row, subjects);
    const isValid = errors.length === 0 && !!payload;
    return {
      rowNumber: index + 2, // +1 header, +1 basis-1
      status: (isValid ? "VALID" : "ERROR") as ImportRowStatus,
      action: (isValid ? "CREATE" : "REJECT") as ImportRowAction,
      raw: toRawStrings(row),
      payload,
      errors,
      warnings,
    };
  });

  const validRows = rows.filter((row) => row.status === "VALID").length;
  const errorRows = rows.length - validRows;

  return {
    fileName,
    summary: {
      totalRows: rows.length,
      validRows,
      errorRows,
      newRecords: validRows,
      rejectedRows: errorRows,
    },
    rows,
    canProceed: validRows > 0,
  };
}

// ---------------------------------------------------------------------------
// Eksekusi Impor
// ---------------------------------------------------------------------------

/**
 * Eksekusi impor untuk baris preview berstatus VALID (dikonfirmasi pengguna).
 * Setiap payload divalidasi ulang sebelum disimpan; institutionId & pembuat
 * selalu diambil dari ctx (anti-tampering).
 */
export async function executeQuestionImport(
  ctx: TenantContext,
  rawRows: unknown
): Promise<QuestionImportExecutionResult> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new QuestionImportError("Tidak ada baris data valid yang dipilih untuk diimpor.");
  }

  const details: QuestionImportExecutionResult["details"] = [];
  let createdQuestions = 0;
  let skippedRows = 0;
  let failedRows = 0;

  for (const raw of rawRows) {
    const row = raw as QuestionPreviewRow;
    const rowNumber = typeof row?.rowNumber === "number" ? row.rowNumber : 0;

    if (!row || row.status !== "VALID" || !row.payload) {
      skippedRows++;
      details.push({ rowNumber, status: "SKIPPED", message: "Baris tidak valid atau ditolak." });
      continue;
    }

    try {
      const payload = validateCreateQuestionInput(row.payload);
      await insertQuestion(ctx, payload);
      createdQuestions++;
      details.push({ rowNumber, status: "CREATED" });
    } catch (err: unknown) {
      failedRows++;
      details.push({
        rowNumber,
        status: "FAILED",
        message: err instanceof Error ? err.message : "Gagal menyimpan soal.",
      });
    }
  }

  if (createdQuestions > 0) {
    await prisma.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId || null,
        action: "IMPORT",
        entityType: "Question",
        detailsJson: JSON.stringify({
          totalProcessed: rawRows.length,
          createdQuestions,
          skippedRows,
          failedRows,
        }),
      },
    });
  }

  return {
    totalProcessed: rawRows.length,
    createdQuestions,
    skippedRows,
    failedRows,
    details,
  };
}

// ---------------------------------------------------------------------------
// Template Impor
// ---------------------------------------------------------------------------

/**
 * Template Excel standar NataSekolah untuk impor soal.
 */
export function generateQuestionImportTemplateBuffer(): Buffer {
  const headers = [
    "Kode/Nama Mapel*",
    "Tipe Soal* (MULTIPLE_CHOICE / SHORT_ANSWER / ESSAY)",
    "Tingkat Kesulitan (EASY / MEDIUM / HARD)",
    "Topik/Bab",
    "Naskah Soal*",
    "Opsi A",
    "Opsi B",
    "Opsi C",
    "Opsi D",
    "Kunci Jawaban (label A-D)",
    "Kunci Jawaban Singkat",
    "Pembahasan / Rubrik",
    "Status (DRAFT / ACTIVE)",
  ];

  const sampleData = [
    [
      "MTK",
      "MULTIPLE_CHOICE",
      "MEDIUM",
      "Aljabar",
      "Berapa hasil dari 3 x 4?",
      "6",
      "12",
      "14",
      "16",
      "B",
      "",
      "3 x 4 = 12",
      "DRAFT",
    ],
    [
      "FIQ",
      "SHORT_ANSWER",
      "EASY",
      "Thaharah",
      "Sebutkan tiga syarat wudu!",
      "",
      "",
      "",
      "",
      "",
      "Suci dari hadas, anggota wudu, niat",
      "",
      "DRAFT",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Soal");

  const out = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
