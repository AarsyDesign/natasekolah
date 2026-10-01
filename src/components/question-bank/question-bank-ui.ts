/**
 * Modul UI klien Bank Soal (Phase 7 tahap 7).
 *
 * Berisi konstanta label, tipe data klien, dan helper murni untuk rute
 * /exams/question-bank. File ini BEBAS impor modul server (prisma / service)
 * sehingga aman dibundel ke klien. Tipe di bawah adalah bayangan ringkas dari
 * bentuk kembalian server action, bukan duplikasi skema.
 */

/** Varian badge yang tersedia pada primitif Badge (src/components/ui/badge.tsx). */
export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary";

// ---------------------------------------------------------------------------
// Opsi filter & label
// ---------------------------------------------------------------------------

export const QUESTION_TYPE_OPTIONS = [
  { value: "MULTIPLE_CHOICE", label: "Pilihan Ganda" },
  { value: "SHORT_ANSWER", label: "Jawaban Singkat" },
  { value: "ESSAY", label: "Esai" },
] as const;

export const QUESTION_DIFFICULTY_OPTIONS = [
  { value: "EASY", label: "Mudah" },
  { value: "MEDIUM", label: "Sedang" },
  { value: "HARD", label: "Sulit" },
] as const;

export const QUESTION_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draf" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "ARCHIVED", label: "Arsip" },
] as const;

export function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

export function questionDifficultyLabel(difficulty: string): string {
  return (
    QUESTION_DIFFICULTY_OPTIONS.find((opt) => opt.value === difficulty)?.label ??
    difficulty
  );
}

export function questionStatusLabel(status: string): string {
  return QUESTION_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export const QUESTION_STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
};

export const QUESTION_TYPE_BADGE: Record<string, BadgeVariant> = {
  MULTIPLE_CHOICE: "info",
  SHORT_ANSWER: "primary",
  ESSAY: "neutral",
};

export const QUESTION_DIFFICULTY_BADGE: Record<string, BadgeVariant> = {
  EASY: "success",
  MEDIUM: "info",
  HARD: "danger",
};

/**
 * Aturan transisi siklus status (pantulan klien dari
 * QUESTION_STATUS_TRANSITIONS pada validasi Zod).
 */
export const QUESTION_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

export const QUESTION_OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type QuestionOptionLabelValue = (typeof QUESTION_OPTION_LABELS)[number];

// ---------------------------------------------------------------------------
// Tipe data klien
// ---------------------------------------------------------------------------

export interface QuestionOptionItem {
  id?: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface QuestionSubjectRef {
  id: string;
  name: string;
  code?: string | null;
}

export interface QuestionUserRef {
  id: string;
  name: string;
}

/** Bayangan klien dari QuestionWithOptions. */
export interface QuestionItem {
  id: string;
  type: string;
  difficulty: string;
  topic?: string | null;
  stem: string;
  explanation?: string | null;
  shortAnswerKey?: string | null;
  status: string;
  subjectId?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  options: QuestionOptionItem[];
  subject?: QuestionSubjectRef | null;
  createdBy?: QuestionUserRef | null;
}

export interface QuestionBankSummary {
  total: number;
  byStatus: { DRAFT: number; ACTIVE: number; ARCHIVED: number };
  byDifficulty: { EASY: number; MEDIUM: number; HARD: number };
  subjectCount: number;
  topicCount: number;
  topics: string[];
}

export interface QuestionListResult {
  data: QuestionItem[];
  items: QuestionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SubjectOption {
  id: string;
  name: string;
  code?: string | null;
}

export interface QuestionImportIssue {
  field?: string;
  message: string;
}

export interface QuestionImportPreviewRow {
  rowNumber: number;
  status: "VALID" | "WARNING" | "ERROR";
  action: string;
  raw: Record<string, string>;
  payload?: unknown;
  errors: QuestionImportIssue[];
  warnings: QuestionImportIssue[];
}

export interface QuestionImportPreview {
  fileName: string;
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    newRecords: number;
    rejectedRows: number;
  };
  rows: QuestionImportPreviewRow[];
  canProceed: boolean;
}

export interface QuestionImportResult {
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

// ---------------------------------------------------------------------------
// Bentuk form soal (dipakai halaman tambah & halaman ubah)
// ---------------------------------------------------------------------------

export interface QuestionFormOption {
  label: QuestionOptionLabelValue;
  content: string;
  isCorrect: boolean;
}

export interface QuestionFormValue {
  subjectId: string;
  type: string;
  difficulty: string;
  topic: string;
  stem: string;
  explanation: string;
  shortAnswerKey: string;
  options: QuestionFormOption[];
}

export function createEmptyQuestionForm(): QuestionFormValue {
  return {
    subjectId: "",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    topic: "",
    stem: "",
    explanation: "",
    shortAnswerKey: "",
    options: [
      { label: "A", content: "", isCorrect: true },
      { label: "B", content: "", isCorrect: false },
      { label: "C", content: "", isCorrect: false },
      { label: "D", content: "", isCorrect: false },
    ],
  };
}

export function questionFormFromItem(item: QuestionItem): QuestionFormValue {
  const base = createEmptyQuestionForm();
  const options = base.options.map((fallback) => {
    const found = item.options.find((opt) => opt.label === fallback.label);
    return {
      label: fallback.label,
      content: found?.content ?? "",
      isCorrect: found ? found.isCorrect : fallback.isCorrect,
    };
  });
  const correct = options.filter((opt) => opt.isCorrect);
  if (correct.length !== 1 && options.length > 0) {
    options.forEach((opt, index) => {
      opt.isCorrect = index === 0;
    });
  }

  return {
    subjectId: item.subjectId ?? item.subject?.id ?? "",
    type: item.type,
    difficulty: item.difficulty,
    topic: item.topic ?? "",
    stem: item.stem,
    explanation: item.explanation ?? "",
    shortAnswerKey: item.shortAnswerKey ?? "",
    options,
  };
}

/**
 * Validasi ringan di sisi klien (umpan balik instan).
 * Sumber kebenaran tetap validasi Zod pada server action.
 */
export function validateQuestionForm(form: QuestionFormValue): string | null {
  if (!form.subjectId) {
    return "Pilih mata pelajaran terlebih dahulu.";
  }
  if (form.stem.trim().length < 5) {
    return "Naskah soal minimal 5 karakter.";
  }
  if (form.stem.trim().length > 5000) {
    return "Naskah soal maksimal 5000 karakter.";
  }
  if (form.type === "MULTIPLE_CHOICE") {
    if (form.options.some((opt) => !opt.content.trim())) {
      return "Seluruh opsi A sampai D wajib diisi.";
    }
    if (form.options.filter((opt) => opt.isCorrect).length !== 1) {
      return "Pilih tepat satu kunci jawaban.";
    }
    if (form.shortAnswerKey.trim()) {
      return "Soal pilihan ganda tidak memakai kunci jawaban teks.";
    }
  }
  if (form.type === "SHORT_ANSWER" && !form.shortAnswerKey.trim()) {
    return "Isi kunci jawaban untuk soal jawaban singkat.";
  }
  if (form.type === "ESSAY" && form.shortAnswerKey.trim()) {
    return "Soal esai memakai pedoman penskoran pada kolom pembahasan.";
  }
  return null;
}

/** Susun payload create dari nilai form (status selalu DRAFT). */
export function buildCreateQuestionPayload(form: QuestionFormValue) {
  return {
    subjectId: form.subjectId,
    type: form.type,
    difficulty: form.difficulty,
    topic: form.topic.trim() ? form.topic.trim() : null,
    stem: form.stem.trim(),
    explanation: form.explanation.trim() ? form.explanation.trim() : null,
    shortAnswerKey:
      form.type === "SHORT_ANSWER" ? form.shortAnswerKey.trim() : null,
    options:
      form.type === "MULTIPLE_CHOICE"
        ? form.options.map((opt) => ({
            label: opt.label,
            content: opt.content.trim(),
            isCorrect: opt.isCorrect,
          }))
        : [],
    status: "DRAFT",
  };
}

/** Susun patch update dari nilai form (hanya field yang boleh diubah klien). */
export function buildUpdateQuestionPayload(form: QuestionFormValue) {
  return {
    subjectId: form.subjectId,
    type: form.type,
    difficulty: form.difficulty,
    topic: form.topic.trim() ? form.topic.trim() : null,
    stem: form.stem.trim(),
    explanation: form.explanation.trim() ? form.explanation.trim() : null,
    shortAnswerKey:
      form.type === "SHORT_ANSWER" ? form.shortAnswerKey.trim() : null,
    options:
      form.type === "MULTIPLE_CHOICE"
        ? form.options.map((opt) => ({
            label: opt.label,
            content: opt.content.trim(),
            isCorrect: opt.isCorrect,
          }))
        : [],
  };
}

// ---------------------------------------------------------------------------
// Helper tampilan
// ---------------------------------------------------------------------------

/** Format tanggal resmi Indonesia (contoh: 23 September 2026). */
export function formatLongDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function truncateText(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}
