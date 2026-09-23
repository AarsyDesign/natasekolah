import { z } from "zod";
import { paginationSchema } from "./common";

export const ASSESSMENT_TYPES = [
  "DAILY",
  "QUIZ",
  "MIDTERM",
  "FINAL",
  "PROJECT",
  "OTHER",
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const SEMESTERS = ["ODD", "EVEN"] as const;
export type Semester = (typeof SEMESTERS)[number];

export const REPORT_CARD_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReportCardStatus = (typeof REPORT_CARD_STATUSES)[number];

// -------------------------------------------------------------
// ASSESSMENT SCHEMAS
// -------------------------------------------------------------

export const createAssessmentInputSchema = z.object({
  teacherAssignmentId: z
    .string()
    .min(1, "ID Penugasan guru tidak boleh kosong"),
  title: z
    .string()
    .trim()
    .min(2, "Judul penilaian minimal 2 karakter")
    .max(100, "Judul penilaian maksimal 100 karakter"),
  type: z.enum(ASSESSMENT_TYPES),
  assessmentDate: z.union([z.string(), z.date()]).optional(),
  maxScore: z
    .number()
    .min(1, "Nilai maksimal harus minimal 1")
    .max(1000, "Nilai maksimal tidak boleh melebihi 1000")
    .default(100),
  isPublished: z.boolean().optional().default(false),
});

export type CreateAssessmentInput = z.input<typeof createAssessmentInputSchema>;

export const updateAssessmentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Judul penilaian minimal 2 karakter")
    .max(100, "Judul penilaian maksimal 100 karakter")
    .optional(),
  type: z.enum(ASSESSMENT_TYPES).optional(),
  assessmentDate: z.union([z.string(), z.date()]).optional(),
  maxScore: z
    .number()
    .min(1, "Nilai maksimal harus minimal 1")
    .max(1000, "Nilai maksimal tidak boleh melebihi 1000")
    .optional(),
  isPublished: z.boolean().optional(),
});

export type UpdateAssessmentInput = z.input<typeof updateAssessmentInputSchema>;

export const assessmentFilterSchema = paginationSchema.extend({
  teacherAssignmentId: z.string().optional(),
  type: z.enum(ASSESSMENT_TYPES).optional(),
  classroomId: z.string().optional(),
  subjectId: z.string().optional(),
  academicYearId: z.string().optional(),
  search: z.string().optional(),
});

export type AssessmentFilterQuery = z.input<typeof assessmentFilterSchema>;

// -------------------------------------------------------------
// SCORE SCHEMAS
// -------------------------------------------------------------

export const recordScoreInputSchema = z.object({
  assessmentId: z
    .string()
    .min(1, "ID Penilaian tidak boleh kosong"),
  studentId: z
    .string()
    .min(1, "ID Siswa tidak boleh kosong"),
  score: z
    .number()
    .min(0, "Nilai tidak boleh kurang dari 0"),
  note: z.string().trim().max(255, "Catatan maksimal 255 karakter").optional().nullable(),
});

export type RecordScoreInput = z.input<typeof recordScoreInputSchema>;

export const singleStudentScoreItemSchema = z.object({
  studentId: z.string().min(1, "ID Siswa tidak boleh kosong"),
  score: z.number().min(0, "Nilai tidak boleh kurang dari 0"),
  note: z.string().trim().max(255).optional().nullable(),
});

export const recordBatchScoresInputSchema = z.object({
  assessmentId: z
    .string()
    .min(1, "ID Penilaian tidak boleh kosong"),
  scores: z
    .array(singleStudentScoreItemSchema)
    .min(1, "Minimal 1 nilai siswa yang dikirim"),
});

export type RecordBatchScoresInput = z.input<typeof recordBatchScoresInputSchema>;

export const scoreFilterSchema = z.object({
  assessmentId: z.string().optional(),
  studentId: z.string().optional(),
  enrollmentId: z.string().optional(),
});

export type ScoreFilterQuery = z.input<typeof scoreFilterSchema>;

// -------------------------------------------------------------
// REPORT CARD SCHEMAS
// -------------------------------------------------------------

export const generateReportCardInputSchema = z.object({
  studentId: z
    .string()
    .min(1, "ID Siswa tidak boleh kosong"),
  academicYearId: z
    .string()
    .min(1, "ID Tahun Ajaran tidak boleh kosong"),
  classroomId: z
    .string()
    .min(1, "ID Rombel tidak boleh kosong"),
  semester: z.enum(SEMESTERS),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type GenerateReportCardInput = z.input<typeof generateReportCardInputSchema>;

export const publishReportCardInputSchema = z.object({
  reportCardId: z
    .string()
    .min(1, "ID Raport tidak boleh kosong"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type PublishReportCardInput = z.input<typeof publishReportCardInputSchema>;

export const reportCardFilterSchema = paginationSchema.extend({
  classroomId: z.string().optional(),
  academicYearId: z.string().optional(),
  studentId: z.string().optional(),
  semester: z.enum(SEMESTERS).optional(),
  status: z.enum(REPORT_CARD_STATUSES).optional(),
});

export type ReportCardFilterQuery = z.input<typeof reportCardFilterSchema>;
