import { z } from "zod";
import { idSchema, validate } from "./common";
import { ENROLLMENT_STATUSES } from "../academic/types";

/**
 * Skema validasi pembuatan Tahun Ajaran (AcademicYear).
 */
export const createAcademicYearInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(4, "Nama tahun ajaran minimal 4 karakter (misal: 2026/2027)")
      .max(20, "Nama tahun ajaran maksimal 20 karakter"),
    startDate: z.coerce.date({ message: "Format tanggal mulai tidak valid" }).optional(),
    endDate: z.coerce.date({ message: "Format tanggal selesai tidak valid" }).optional(),
    isActive: z.boolean().optional().default(false),
  });

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearInputSchema>;

export const updateAcademicYearInputSchema = createAcademicYearInputSchema.partial();
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearInputSchema>;

/**
 * Skema validasi pembuatan Rombel / Ruang Kelas (Classroom).
 */
export const createClassroomInputSchema = z
  .object({
    academicYearId: idSchema,
    name: z
      .string()
      .trim()
      .min(1, "Nama kelas tidak boleh kosong (misal: VII A, 10 MIPA 1)")
      .max(50, "Nama kelas maksimal 50 karakter"),
    gradeLevel: z.string().trim().max(20, "Tingkat kelas maksimal 20 karakter").optional(),
    capacity: z.coerce.number().int().min(1, "Kapasitas minimal 1").max(100, "Kapasitas maksimal 100").optional(),
  });

export type CreateClassroomInput = z.infer<typeof createClassroomInputSchema>;

export const updateClassroomInputSchema = createClassroomInputSchema.partial();
export type UpdateClassroomInput = z.infer<typeof updateClassroomInputSchema>;

/**
 * Skema validasi penempatan siswa ke kelas (Enrollment).
 */
export const createEnrollmentInputSchema = z
  .object({
    studentId: idSchema,
    academicYearId: idSchema,
    classroomId: idSchema,
    status: z.enum(ENROLLMENT_STATUSES, {
      message: "Status enrollment tidak valid",
    }).optional().default("ENROLLED"),
    enrolledAt: z.coerce.date({ message: "Format tanggal enrollment tidak valid" }).optional(),
  });

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentInputSchema>;

export const updateEnrollmentInputSchema = z
  .object({
    classroomId: idSchema.optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    endedAt: z.coerce.date({ message: "Format tanggal berakhir tidak valid" }).optional(),
  });

export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentInputSchema>;

// Helper functions
export function validateCreateAcademicYearInput(input: unknown): CreateAcademicYearInput {
  return validate(createAcademicYearInputSchema, input);
}

export function validateUpdateAcademicYearInput(input: unknown): UpdateAcademicYearInput {
  return validate(updateAcademicYearInputSchema, input);
}

export function validateCreateClassroomInput(input: unknown): CreateClassroomInput {
  return validate(createClassroomInputSchema, input);
}

export function validateUpdateClassroomInput(input: unknown): UpdateClassroomInput {
  return validate(updateClassroomInputSchema, input);
}

export function validateCreateEnrollmentInput(input: unknown): CreateEnrollmentInput {
  return validate(createEnrollmentInputSchema, input);
}

export function validateUpdateEnrollmentInput(input: unknown): UpdateEnrollmentInput {
  return validate(updateEnrollmentInputSchema, input);
}
