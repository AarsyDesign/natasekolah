import { z } from "zod";
import { idSchema, validate } from "./common";
import { DORMITORY_ASSIGNMENT_STATUSES } from "../dormitory/types";

/**
 * Skema validasi pembuatan Gedung Asrama.
 */
export const createDormitoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama asrama minimal 2 karakter")
    .max(100, "Nama asrama maksimal 100 karakter"),
  gender: z
    .enum(["L", "P"], {
      message: "Peruntukan asrama harus L (Putra) atau P (Putri)",
    })
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
  isActive: z.boolean().optional().default(true),
});

export type CreateDormitoryInput = z.infer<typeof createDormitoryInputSchema>;

export function validateCreateDormitoryInput(data: unknown): CreateDormitoryInput {
  return validate(createDormitoryInputSchema, data);
}

export const updateDormitoryInputSchema = createDormitoryInputSchema.partial();
export type UpdateDormitoryInput = z.infer<typeof updateDormitoryInputSchema>;

export function validateUpdateDormitoryInput(data: unknown): UpdateDormitoryInput {
  return validate(updateDormitoryInputSchema, data);
}

/**
 * Skema validasi pembuatan Kamar Asrama (DormitoryRoom).
 */
export const createDormitoryRoomInputSchema = z.object({
  dormitoryId: idSchema,
  name: z
    .string()
    .trim()
    .min(1, "Nama kamar minimal 1 karakter")
    .max(50, "Nama kamar maksimal 50 karakter"),
  capacity: z
    .number({
      message: "Kapasitas kamar wajib diisi",
    })
    .int("Kapasitas harus bilangan bulat")
    .min(1, "Kapasitas kamar minimal 1 santri")
    .max(100, "Kapasitas kamar maksimal 100 santri"),
  isActive: z.boolean().optional().default(true),
});

export type CreateDormitoryRoomInput = z.infer<typeof createDormitoryRoomInputSchema>;

export function validateCreateDormitoryRoomInput(data: unknown): CreateDormitoryRoomInput {
  return validate(createDormitoryRoomInputSchema, data);
}

export const updateDormitoryRoomInputSchema = createDormitoryRoomInputSchema.partial();
export type UpdateDormitoryRoomInput = z.infer<typeof updateDormitoryRoomInputSchema>;

export function validateUpdateDormitoryRoomInput(data: unknown): UpdateDormitoryRoomInput {
  return validate(updateDormitoryRoomInputSchema, data);
}

/**
 * Skema penempatan santri ke kamar (StudentDormitoryAssignment).
 */
export const assignStudentToRoomInputSchema = z.object({
  studentId: idSchema,
  roomId: idSchema,
  startDate: z.coerce.date().optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export type AssignStudentToRoomInput = z.infer<typeof assignStudentToRoomInputSchema>;

export function validateAssignStudentToRoomInput(data: unknown): AssignStudentToRoomInput {
  return validate(assignStudentToRoomInputSchema, data);
}

/**
 * Skema pengakhiran penempatan kamar santri.
 */
export const endDormitoryAssignmentInputSchema = z.object({
  assignmentId: idSchema,
  endDate: z.coerce.date().optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export type EndDormitoryAssignmentInput = z.infer<typeof endDormitoryAssignmentInputSchema>;

export function validateEndDormitoryAssignmentInput(data: unknown): EndDormitoryAssignmentInput {
  return validate(endDormitoryAssignmentInputSchema, data);
}

/**
 * Filter penempatan kamar
 */
export const dormitoryAssignmentFilterSchema = z.object({
  roomId: idSchema.optional(),
  studentId: idSchema.optional(),
  status: z.enum(DORMITORY_ASSIGNMENT_STATUSES).optional(),
});

export type DormitoryAssignmentFilter = z.infer<typeof dormitoryAssignmentFilterSchema>;

export function validateDormitoryAssignmentFilter(data: unknown): DormitoryAssignmentFilter {
  return validate(dormitoryAssignmentFilterSchema, data);
}
