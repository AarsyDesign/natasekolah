import { z } from "zod";
import { idSchema, validate, nonEmptyString } from "./common";

// ---------------------------------------------------------------------------
// Konstanta Domain Bank Soal (Phase 7)
// ---------------------------------------------------------------------------

/** Tipe butir soal yang didukung Question Bank. */
export const QUESTION_TYPES = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "ESSAY"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Tingkat kesulitan butir soal. */
export const QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

/** Siklus status butir soal: DRAFT -> ACTIVE -> ARCHIVED (terminal). */
export const QUESTION_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Label opsi pilihan ganda (tepat A|B|C|D). */
export const QUESTION_OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number];

/**
 * Aturan transisi siklus status soal.
 * ARCHIVED bersifat terminal: soal terarsip tidak boleh diubah lagi
 * ("historical data is sacred" -> soal terpakai tidak hilang diam-diam).
 */
export const QUESTION_STATUS_TRANSITIONS: Record<QuestionStatus, QuestionStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

// ---------------------------------------------------------------------------
// Skema Opsi (QuestionOption)
// ---------------------------------------------------------------------------

export const questionOptionInputSchema = z
  .object({
    label: z.enum(QUESTION_OPTION_LABELS, {
      message: "Label opsi harus salah satu dari A, B, C, atau D",
    }),
    content: nonEmptyString("Konten opsi", 1, 1000),
    isCorrect: z.boolean().optional().default(false),
  })
  .strict();

export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;

// ---------------------------------------------------------------------------
// Invariant Tipe Soal (dipakai skema create & gabungan update)
// ---------------------------------------------------------------------------

interface QuestionInvariants {
  type: QuestionType;
  topic?: string | null;
  stem: string;
  explanation?: string | null;
  shortAnswerKey?: string | null;
  options?: QuestionOptionInput[];
}

/**
 * Invariant tipe soal yang divalidasi Zod:
 * - MULTIPLE_CHOICE: wajib tepat 4 opsi dan tepat 1 isCorrect = true, tanpa kunci teks.
 * - SHORT_ANSWER: wajib kunci teks, wajib 0 opsi.
 * - ESSAY: wajib 0 opsi dan tanpa kunci teks (pedoman penskoran ada di explanation).
 */
function assertQuestionTypeInvariants(val: QuestionInvariants, ctx: z.RefinementCtx): void {
  const options = val.options ?? [];

  // Label unik (A boleh muncul sekali saja)
  const seenLabels = new Set<string>();
  options.forEach((opt, index) => {
    if (seenLabels.has(opt.label)) {
      ctx.addIssue({
        code: "custom",
        path: ["options", index, "label"],
        message: `Label opsi [${opt.label}] duplikat pada soal yang sama`,
      });
    }
    seenLabels.add(opt.label);
  });

  if (val.type === "MULTIPLE_CHOICE") {
    if (options.length !== 4) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: `Soal pilihan ganda harus memiliki tepat 4 opsi (ditemukan ${options.length})`,
      });
    }
    const correctCount = options.filter((opt) => opt.isCorrect).length;
    if (correctCount === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Soal pilihan ganda harus memiliki tepat 1 kunci jawaban",
      });
    } else if (correctCount > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Soal pilihan ganda hanya boleh memiliki 1 kunci jawaban (ditemukan lebih dari satu)",
      });
    }
    if (val.shortAnswerKey) {
      ctx.addIssue({
        code: "custom",
        path: ["shortAnswerKey"],
        message: "Soal pilihan ganda tidak boleh mengisi kunci jawaban teks",
      });
    }
    return;
  }

  if (options.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Soal non-pilihan ganda tidak boleh memiliki opsi pilihan",
    });
  }

  if (val.type === "SHORT_ANSWER") {
    if (!val.shortAnswerKey) {
      ctx.addIssue({
        code: "custom",
        path: ["shortAnswerKey"],
        message: "Soal jawaban singkat wajib memiliki kunci jawaban teks",
      });
    }
    return;
  }

  // ESSAY
  if (val.shortAnswerKey) {
    ctx.addIssue({
      code: "custom",
      path: ["shortAnswerKey"],
      message: "Soal essay menggunakan pedoman penskoran pada kolom pembahasan, bukan kunci jawaban singkat",
    });
  }
}

// ---------------------------------------------------------------------------
// Skema Create / Update Butir Soal
// ---------------------------------------------------------------------------

const questionCoreShape = {
  subjectId: idSchema,
  type: z.enum(QUESTION_TYPES, { message: "Tipe soal tidak valid" }),
  difficulty: z.enum(QUESTION_DIFFICULTIES, { message: "Tingkat kesulitan tidak valid" })
    .optional()
    .default("MEDIUM"),
  topic: z.string().trim().max(150, "Topik maksimal 150 karakter").optional().nullable(),
  stem: z.string().trim().min(5, "Naskah soal minimal 5 karakter").max(5000, "Naskah soal maksimal 5000 karakter"),
  explanation: z.string().trim().max(5000, "Pembahasan maksimal 5000 karakter").optional().nullable(),
  shortAnswerKey: z.string().trim().max(500, "Kunci jawaban maksimal 500 karakter").optional().nullable(),
  options: z.array(questionOptionInputSchema).max(4, "Maksimal 4 opsi pilihan").optional().default([]),
  status: z.enum(QUESTION_STATUSES, { message: "Status soal tidak valid" }).optional().default("DRAFT"),
};

export const createQuestionInputSchema = z
  .object(questionCoreShape)
  .strict()
  .superRefine(assertQuestionTypeInvariants);

export type CreateQuestionInput = z.infer<typeof createQuestionInputSchema>;

/**
 * Skema update parsial (tanpa nilai default agar field yang tidak dikirim
 * tidak pernah menimpa data lama). Invariant tipe soal diverifikasi ulang pada
 * service terhadap gabungan data lama + patch.
 */
export const updateQuestionInputSchema = z
  .object({
    subjectId: idSchema.optional(),
    type: z.enum(QUESTION_TYPES, { message: "Tipe soal tidak valid" }).optional(),
    difficulty: z.enum(QUESTION_DIFFICULTIES, { message: "Tingkat kesulitan tidak valid" }).optional(),
    topic: z.string().trim().max(150, "Topik maksimal 150 karakter").optional().nullable(),
    stem: z
      .string()
      .trim()
      .min(5, "Naskah soal minimal 5 karakter")
      .max(5000, "Naskah soal maksimal 5000 karakter")
      .optional(),
    explanation: z.string().trim().max(5000, "Pembahasan maksimal 5000 karakter").optional().nullable(),
    shortAnswerKey: z.string().trim().max(500, "Kunci jawaban maksimal 500 karakter").optional().nullable(),
    options: z.array(questionOptionInputSchema).max(4, "Maksimal 4 opsi pilihan").optional(),
  })
  .strict();
export type UpdateQuestionInput = z.infer<typeof updateQuestionInputSchema>;

/** Skema perubahan siklus status soal (publish / unpublish / arsip). */
export const updateQuestionStatusInputSchema = z
  .object({
    status: z.enum(QUESTION_STATUSES, { message: "Status soal tidak valid" }),
  })
  .strict();
export type UpdateQuestionStatusInput = z.infer<typeof updateQuestionStatusInputSchema>;

// ---------------------------------------------------------------------------
// Skema Filter Daftar Soal
// ---------------------------------------------------------------------------

export const questionFilterSchema = z
  .object({
    search: z.string().trim().max(100, "Kata kunci pencarian maksimal 100 karakter").optional(),
    subjectId: idSchema.optional(),
    createdById: idSchema.optional(),
    type: z.enum(QUESTION_TYPES, { message: "Tipe soal tidak valid" }).optional(),
    difficulty: z.enum(QUESTION_DIFFICULTIES, { message: "Tingkat kesulitan tidak valid" }).optional(),
    status: z.enum(QUESTION_STATUSES, { message: "Status soal tidak valid" }).optional(),
    topic: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type QuestionFilter = z.infer<typeof questionFilterSchema>;

// ---------------------------------------------------------------------------
// Skema Baris Impor Spreadsheet (xlsx / csv)
// ---------------------------------------------------------------------------

export const questionImportRowSchema = z
  .object({
    /** Kode atau nama mata pelajaran sesuai kolom pada file impor. */
    subject: nonEmptyString("Mata pelajaran", 1, 100),
    type: z.enum(QUESTION_TYPES, { message: "Tipe soal tidak valid" }),
    difficulty: z.enum(QUESTION_DIFFICULTIES, { message: "Tingkat kesulitan tidak valid" })
      .optional()
      .default("MEDIUM"),
    topic: z.string().trim().max(150, "Topik maksimal 150 karakter").optional().nullable(),
    stem: z.string().trim().min(5, "Naskah soal minimal 5 karakter").max(5000, "Naskah soal maksimal 5000 karakter"),
    optionA: z.string().trim().max(1000).optional().nullable(),
    optionB: z.string().trim().max(1000).optional().nullable(),
    optionC: z.string().trim().max(1000).optional().nullable(),
    optionD: z.string().trim().max(1000).optional().nullable(),
    /** Kunci jawaban: label (A-D) atau teks untuk jawaban singkat. */
    correctAnswer: z.string().trim().max(500).optional().nullable(),
    shortAnswerKey: z.string().trim().max(500).optional().nullable(),
    explanation: z.string().trim().max(5000).optional().nullable(),
    status: z.enum(QUESTION_STATUSES, { message: "Status soal tidak valid" }).optional().default("DRAFT"),
  })
  .strict();

export type QuestionImportRow = z.infer<typeof questionImportRowSchema>;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function validateCreateQuestionInput(input: unknown): CreateQuestionInput {
  return validate(createQuestionInputSchema, input);
}

export function validateUpdateQuestionInput(input: unknown): UpdateQuestionInput {
  return validate(updateQuestionInputSchema, input);
}

export function validateUpdateQuestionStatusInput(input: unknown): UpdateQuestionStatusInput {
  return validate(updateQuestionStatusInputSchema, input);
}

export function validateQuestionFilter(input: unknown): QuestionFilter {
  return validate(questionFilterSchema, input);
}

export function validateQuestionImportRow(input: unknown): QuestionImportRow {
  return validate(questionImportRowSchema, input);
}
