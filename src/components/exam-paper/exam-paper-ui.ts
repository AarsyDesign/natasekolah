/**
 * Modul UI klien Exam Paper Engine (Phase 10.2).
 *
 * Berisi konstanta label, badge, tipe bayangan klien, dan helper murni untuk
 * rute /exams/papers. File ini BEBAS impor modul server (prisma / service /
 * validasi Zod server) sehingga aman dibundel ke klien.
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
// Opsi & label
// ---------------------------------------------------------------------------

export const EXAM_TYPE_OPTIONS = [
  { value: "DAILY", label: "Harian" },
  { value: "MIDTERM", label: "Tengah Semester" },
  { value: "FINAL", label: "Akhir Semester" },
  { value: "REMEDIAL", label: "Remedial" },
  { value: "PRACTICAL", label: "Praktik" },
] as const;

export const EXAM_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draf" },
  { value: "READY", label: "Siap" },
  { value: "ISSUED", label: "Diterbitkan" },
  { value: "ARCHIVED", label: "Arsip" },
] as const;

export const EXAM_COLUMN_LAYOUT_OPTIONS = [
  { value: "ONE", label: "1 Kolom" },
  { value: "TWO", label: "2 Kolom" },
] as const;

export const EXAM_STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  READY: "info",
  ISSUED: "success",
  ARCHIVED: "warning",
};

/**
 * Pantulan klien dari EXAM_STATUS_TRANSITIONS pada validasi Zod:
 * DRAFT -> READY -> ISSUED -> ARCHIVED (ARCHIVED terminal).
 */
export const EXAM_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY", "ARCHIVED"],
  READY: ["DRAFT", "ISSUED", "ARCHIVED"],
  ISSUED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function examTypeLabel(type: string): string {
  return EXAM_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

export function examStatusLabel(status: string): string {
  return EXAM_STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

export function examLayoutLabel(layout: string): string {
  return EXAM_COLUMN_LAYOUT_OPTIONS.find((opt) => opt.value === layout)?.label ?? layout;
}

/** Label aksi transisi status (kunci = status TUJUAN). */
export const EXAM_TRANSITION_ACTION_LABEL: Record<string, string> = {
  READY: "Tandai Siap",
  DRAFT: "Kembali ke Draf",
  ISSUED: "Terbitkan",
  ARCHIVED: "Arsipkan",
};

// ---------------------------------------------------------------------------
// Batas (pantulan klien dari src/lib/validation/exam-paper.ts)
// ---------------------------------------------------------------------------

export const EXAM_MAX_QUESTIONS = 100;
export const EXAM_MIN_POINTS = 1;
export const EXAM_MAX_POINTS = 100;

// ---------------------------------------------------------------------------
// Tipe data klien (bayangan ringkas dari bentuk kembalian server action)
// ---------------------------------------------------------------------------

export interface ExamSubjectRef {
  id: string;
  name: string;
  code?: string | null;
}

export interface ExamYearRef {
  id: string;
  name: string;
}

export interface ExamUserRef {
  id: string;
  name: string;
}

export interface ExamListItem {
  id: string;
  subjectId: string;
  academicYearId?: string;
  title: string;
  examType: string;
  status: string;
  columnLayout: string;
  showAnswers: boolean;
  instructions?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  subject?: ExamSubjectRef | null;
  academicYear?: ExamYearRef | null;
  createdBy?: ExamUserRef | null;
  _count?: { questions: number };
}

export interface ExamQuestionOptionItem {
  id?: string;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface ExamPaperQuestionItem {
  id: string;
  questionId: string;
  order: number;
  points: number;
  question: {
    id: string;
    type: string;
    difficulty?: string;
    stem: string;
    explanation?: string | null;
    shortAnswerKey?: string | null;
    options: ExamQuestionOptionItem[];
  };
}

export interface ExamDetailItem extends ExamListItem {
  questions?: ExamPaperQuestionItem[];
}

// ---------------------------------------------------------------------------
// Helper tampilan
// ---------------------------------------------------------------------------

/** Total poin seluruh butir pada sebuah naskah. */
export function sumExamPoints(questions: ExamPaperQuestionItem[] | undefined): number {
  if (!questions || questions.length === 0) return 0;
  return questions.reduce((sum, row) => sum + (row.points || 0), 0);
}

/** Format tanggal resmi Indonesia (contoh: 2 Oktober 2026). */
export function formatExamDate(value: string | Date | undefined | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Potong teks panjang untuk daftar (aman untuk stem soal). */
export function truncateExamText(text: string, max = 160): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}
