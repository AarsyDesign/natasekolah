import { z } from "zod";
import { idSchema, validate, nonEmptyString } from "./common";

// ---------------------------------------------------------------------------
// Konstanta Domain Exam Paper Engine (Phase 10, PRD #31)
// ---------------------------------------------------------------------------

/** Jenis ujian yang didukung naskah cetak. */
export const EXAM_TYPES = ["DAILY", "MIDTERM", "FINAL", "REMEDIAL", "PRACTICAL"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/**
 * Siklus status naskah ujian: DRAFT -> READY -> ISSUED -> ARCHIVED (terminal).
 * ARCHIVED menggantikan hard delete (historical data is sacred).
 */
export const EXAM_STATUSES = ["DRAFT", "READY", "ISSUED", "ARCHIVED"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

/** Aturan transisi siklus status naskah. ARCHIVED bersifat terminal. */
export const EXAM_STATUS_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  DRAFT: ["READY", "ARCHIVED"],
  READY: ["DRAFT", "ISSUED", "ARCHIVED"],
  ISSUED: ["ARCHIVED"],
  ARCHIVED: [],
};

/** Layout kolom cetak (konfigurable sesuai PRD #31). */
export const EXAM_COLUMN_LAYOUTS = ["ONE", "TWO"] as const;
export type ExamColumnLayout = (typeof EXAM_COLUMN_LAYOUTS)[number];

/** Batas jumlah butir soal dalam satu naskah (mencegah komposisi tak terbatas). */
export const EXAM_MAX_QUESTIONS = 100;

/** Batas butir soal yang boleh ditarik per aksi. */
export const EXAM_MAX_ADD_PER_BATCH = 100;

/** Batas poin per butir soal. */
export const EXAM_MIN_POINTS = 1;
export const EXAM_MAX_POINTS = 100;

// ---------------------------------------------------------------------------
// Skema Create Naskah Ujian
// ---------------------------------------------------------------------------

export const createExamInputSchema = z
  .object({
    academicYearId: idSchema,
    subjectId: idSchema,
    title: nonEmptyString("Judul naskah", 3, 200),
    examType: z.enum(EXAM_TYPES, { message: "Jenis ujian tidak valid" })
      .optional()
      .default("DAILY"),
    instructions: z
      .string()
      .trim()
      .max(2000, "Petunjuk pengerjaan maksimal 2000 karakter")
      .optional()
      .nullable(),
    showAnswers: z.boolean().optional().default(false),
    columnLayout: z.enum(EXAM_COLUMN_LAYOUTS, { message: "Layout kolom tidak valid" })
      .optional()
      .default("ONE"),
  })
  .strict();

export type CreateExamInput = z.infer<typeof createExamInputSchema>;

// ---------------------------------------------------------------------------
// Skema Komposisi Soal (tarik soal dari Bank Soal)
// ---------------------------------------------------------------------------

export const addExamQuestionsInputSchema = z
  .object({
    questionIds: z
      .array(idSchema, { message: "Daftar soal wajib berupa ID" })
      .min(1, "Pilih minimal 1 soal")
      .max(EXAM_MAX_ADD_PER_BATCH, `Maksimal ${EXAM_MAX_ADD_PER_BATCH} soal per aksi`)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Terdapat ID soal duplikat pada daftar"
      ),
  })
  .strict();

export type AddExamQuestionsInput = z.infer<typeof addExamQuestionsInputSchema>;

// ---------------------------------------------------------------------------
// Skema Atur Poin & Urutan
// ---------------------------------------------------------------------------

export const setExamQuestionPointsInputSchema = z
  .object({
    questionId: idSchema,
    points: z
      .number({ message: "Poin wajib berupa angka" })
      .int("Poin harus berupa bilangan bulat")
      .min(EXAM_MIN_POINTS, `Poin minimal ${EXAM_MIN_POINTS}`)
      .max(EXAM_MAX_POINTS, `Poin maksimal ${EXAM_MAX_POINTS}`),
  })
  .strict();

export type SetExamQuestionPointsInput = z.infer<typeof setExamQuestionPointsInputSchema>;

export const reorderExamQuestionsInputSchema = z
  .object({
    questionIds: z
      .array(idSchema, { message: "Urutan soal wajib berupa ID" })
      .min(1, "Urutan soal tidak boleh kosong")
      .max(EXAM_MAX_QUESTIONS, `Maksimal ${EXAM_MAX_QUESTIONS} soal`)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Terdapat ID soal duplikat pada urutan"
      ),
  })
  .strict();

export type ReorderExamQuestionsInput = z.infer<typeof reorderExamQuestionsInputSchema>;

// ---------------------------------------------------------------------------
// Skema Transisi Status & Filter Daftar Naskah
// ---------------------------------------------------------------------------

export const updateExamStatusInputSchema = z
  .object({
    status: z.enum(EXAM_STATUSES, { message: "Status naskah tidak valid" }),
  })
  .strict();

export type UpdateExamStatusInput = z.infer<typeof updateExamStatusInputSchema>;

export const examFilterSchema = z
  .object({
    search: z.string().trim().max(100, "Kata kunci pencarian maksimal 100 karakter").optional(),
    subjectId: idSchema.optional(),
    academicYearId: idSchema.optional(),
    status: z.enum(EXAM_STATUSES, { message: "Status naskah tidak valid" }).optional(),
    examType: z.enum(EXAM_TYPES, { message: "Jenis ujian tidak valid" }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ExamFilter = z.infer<typeof examFilterSchema>;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function validateCreateExamInput(input: unknown): CreateExamInput {
  return validate(createExamInputSchema, input);
}

export function validateAddExamQuestionsInput(input: unknown): AddExamQuestionsInput {
  return validate(addExamQuestionsInputSchema, input);
}

export function validateSetExamQuestionPointsInput(input: unknown): SetExamQuestionPointsInput {
  return validate(setExamQuestionPointsInputSchema, input);
}

export function validateReorderExamQuestionsInput(input: unknown): ReorderExamQuestionsInput {
  return validate(reorderExamQuestionsInputSchema, input);
}

export function validateUpdateExamStatusInput(input: unknown): UpdateExamStatusInput {
  return validate(updateExamStatusInputSchema, input);
}

export function validateExamFilter(input: unknown): ExamFilter {
  return validate(examFilterSchema, input);
}
