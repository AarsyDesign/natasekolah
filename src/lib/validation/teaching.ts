import { z } from "zod";
import { idSchema, validate } from "./common";
import { SUBJECT_CATEGORIES } from "../teaching/types";

/**
 * Skema validasi pembuatan Mata Pelajaran (Subject).
 */
export const createSubjectInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nama mata pelajaran minimal 2 karakter")
      .max(100, "Nama mata pelajaran maksimal 100 karakter"),
    // Field opsional: form React bisa mengirim "" ATAU null (field tak disentuh).
    // Tanpa normalisasi, null jatuh ke .min/.max dan melempar "Invalid input"
    // padahal field berlabel (Opsional) — temuan QA E2E 9.0.
    code: z.preprocess(
      (val) => (val === null || val === undefined || val === "" ? undefined : val),
      z
        .string()
        .trim()
        .min(1, "Kode mata pelajaran minimal 1 karakter")
        .max(20, "Kode mata pelajaran maksimal 20 karakter")
        .toUpperCase()
        .optional()
    ),
    shortName: z.preprocess(
      (val) => (val === null || val === undefined || val === "" ? undefined : val),
      z.string().trim().max(20, "Singkatan nama maksimal 20 karakter").optional()
    ),
    category: z
      .enum(SUBJECT_CATEGORIES, {
        message: "Kategori mata pelajaran tidak valid",
      })
      .optional()
      .default("UMUM"),
    isActive: z.boolean().optional().default(true),
  });

export type CreateSubjectInput = z.infer<typeof createSubjectInputSchema>;

export const updateSubjectInputSchema = createSubjectInputSchema.partial();
export type UpdateSubjectInput = z.infer<typeof updateSubjectInputSchema>;

export const subjectFilterSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.enum(SUBJECT_CATEGORIES).optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

export type SubjectFilter = z.infer<typeof subjectFilterSchema>;

/**
 * Skema validasi Penugasan Mengajar (TeacherAssignment).
 */
export const createTeacherAssignmentInputSchema = z
  .object({
    teacherId: idSchema,
    subjectId: idSchema,
    classroomId: idSchema,
    academicYearId: idSchema,
  });

export type CreateTeacherAssignmentInput = z.infer<typeof createTeacherAssignmentInputSchema>;

export const updateTeacherAssignmentInputSchema = createTeacherAssignmentInputSchema.partial();
export type UpdateTeacherAssignmentInput = z.infer<typeof updateTeacherAssignmentInputSchema>;

export const teacherAssignmentFilterSchema = z
  .object({
    academicYearId: idSchema.optional(),
    teacherId: idSchema.optional(),
    subjectId: idSchema.optional(),
    classroomId: idSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  });

export type TeacherAssignmentFilter = z.infer<typeof teacherAssignmentFilterSchema>;

// Helper functions
export function validateCreateSubjectInput(input: unknown): CreateSubjectInput {
  return validate(createSubjectInputSchema, input);
}

export function validateUpdateSubjectInput(input: unknown): UpdateSubjectInput {
  return validate(updateSubjectInputSchema, input);
}

export function validateSubjectFilter(input: unknown): SubjectFilter {
  return validate(subjectFilterSchema, input);
}

export function validateCreateTeacherAssignmentInput(input: unknown): CreateTeacherAssignmentInput {
  return validate(createTeacherAssignmentInputSchema, input);
}

export function validateUpdateTeacherAssignmentInput(input: unknown): UpdateTeacherAssignmentInput {
  return validate(updateTeacherAssignmentInputSchema, input);
}

export function validateTeacherAssignmentFilter(input: unknown): TeacherAssignmentFilter {
  return validate(teacherAssignmentFilterSchema, input);
}
