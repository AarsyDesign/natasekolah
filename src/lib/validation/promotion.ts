import { z } from "zod";
import { idSchema, validate } from "./common";

/**
 * Skema pemetaan rombel asal -> rombel tujuan
 */
export const classroomMappingSchema = z.object({
  sourceClassroomId: idSchema,
  targetClassroomId: idSchema,
});

/**
 * Skema validasi untuk Prapinjau Kenaikan Kelas Massal (Bulk Promotion Preview)
 */
export const previewBulkPromotionInputSchema = z
  .object({
    sourceAcademicYearId: idSchema,
    targetAcademicYearId: idSchema,
    classroomMappings: z
      .array(classroomMappingSchema)
      .min(1, "Minimal satu pemetaan rombel harus ditentukan"),
    selectedStudentIds: z.array(idSchema).optional(),
  })
  .refine(
    (data) => data.sourceAcademicYearId !== data.targetAcademicYearId,
    {
      message: "Tahun ajaran target harus berbeda dari tahun ajaran asal",
      path: ["targetAcademicYearId"],
    }
  );

export type PreviewBulkPromotionInput = z.infer<typeof previewBulkPromotionInputSchema>;

/**
 * Skema item eksekusi kenaikan kelas per siswa
 */
export const promotionExecutionItemSchema = z.object({
  studentId: idSchema,
  targetClassroomId: idSchema,
});

/**
 * Skema validasi untuk Eksekusi Kenaikan Kelas Massal (Execute Bulk Promotion)
 */
export const executeBulkPromotionInputSchema = z
  .object({
    sourceAcademicYearId: idSchema,
    targetAcademicYearId: idSchema,
    promotions: z
      .array(promotionExecutionItemSchema)
      .min(1, "Minimal satu siswa harus dipilih untuk dipromosikan"),
    allowWarnings: z.boolean().optional().default(false),
  })
  .refine(
    (data) => data.sourceAcademicYearId !== data.targetAcademicYearId,
    {
      message: "Tahun ajaran target harus berbeda dari tahun ajaran asal",
      path: ["targetAcademicYearId"],
    }
  );

export type ExecuteBulkPromotionInput = z.infer<typeof executeBulkPromotionInputSchema>;

/**
 * Skema query filter calon siswa kenaikan kelas
 */
export const promotionCandidateFilterSchema = z.object({
  sourceAcademicYearId: idSchema,
  sourceClassroomId: idSchema.optional(),
  targetAcademicYearId: idSchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type PromotionCandidateFilter = z.infer<typeof promotionCandidateFilterSchema>;

// Helper functions
export function validatePreviewBulkPromotionInput(input: unknown): PreviewBulkPromotionInput {
  return validate(previewBulkPromotionInputSchema, input);
}

export function validateExecuteBulkPromotionInput(input: unknown): ExecuteBulkPromotionInput {
  return validate(executeBulkPromotionInputSchema, input);
}

export function validatePromotionCandidateFilter(input: unknown): PromotionCandidateFilter {
  return validate(promotionCandidateFilterSchema, input);
}
