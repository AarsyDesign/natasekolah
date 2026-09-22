import { z } from "zod";
import { nameSchema, emailSchema, phoneSchema, validate } from "./common";
import { STUDENT_STATUSES } from "../academic/types";

/**
 * Skema validasi input pendaftaran peserta didik baru (Core Student Model).
 *
 * Mengabaikan institutionId karena tenant identity selalu diinjeksi
 * oleh authenticated server session, bukan payload klien.
 */
export const createStudentInputSchema = z
  .object({
    fullName: nameSchema,
    nis: z.string().trim().min(1, "NIS tidak boleh kosong").max(30, "NIS maksimal 30 karakter"),
    nisn: z
      .string()
      .trim()
      .regex(/^[0-9]{10}$/, "NISN harus tepat 10 digit angka")
      .optional()
      .or(z.literal(""))
      .transform((val) => (val === "" ? undefined : val)),
    nik: z
      .string()
      .trim()
      .regex(/^[0-9]{16}$/, "NIK harus tepat 16 digit angka")
      .optional()
      .or(z.literal(""))
      .transform((val) => (val === "" ? undefined : val)),
    nickname: z.string().trim().max(50, "Nama panggilan maksimal 50 karakter").optional(),
    gender: z.enum(["L", "P"], {
      message: "Jenis kelamin harus L (Laki-laki) atau P (Perempuan)",
    }),
    birthPlace: z.string().trim().max(100, "Tempat lahir maksimal 100 karakter").optional(),
    birthDate: z.coerce.date({ message: "Format tanggal lahir tidak valid" }).optional(),
    religion: z.string().trim().max(30, "Agama maksimal 30 karakter").optional(),
    address: z.string().trim().max(255, "Alamat maksimal 255 karakter").optional(),
    phone: phoneSchema.optional().or(z.literal("")).transform((val) => (val === "" ? undefined : val)),
    email: emailSchema.optional().or(z.literal("")).transform((val) => (val === "" ? undefined : val)),
    status: z.enum(STUDENT_STATUSES, {
      message: "Status siswa tidak valid",
    }).optional().default("ACTIVE"),
  });

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;

export const updateStudentInputSchema = createStudentInputSchema.partial();
export type UpdateStudentInput = z.infer<typeof updateStudentInputSchema>;

export const archiveStudentInputSchema = z
  .object({
    status: z.enum(["INACTIVE", "GRADUATED", "TRANSFERRED", "ALUMNI"], {
      message: "Status arsip harus berupa INACTIVE, GRADUATED, TRANSFERRED, atau ALUMNI",
    }),
    reason: z.string().trim().max(255).optional(),
  });

export type ArchiveStudentInput = z.infer<typeof archiveStudentInputSchema>;

export const studentFilterSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(STUDENT_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

export type StudentFilter = z.infer<typeof studentFilterSchema>;

/**
 * Helper validasi input data siswa baru.
 */
export function validateCreateStudentInput(input: unknown): CreateStudentInput {
  return validate(createStudentInputSchema, input);
}

export function validateUpdateStudentInput(input: unknown): UpdateStudentInput {
  return validate(updateStudentInputSchema, input);
}

export function validateArchiveStudentInput(input: unknown): ArchiveStudentInput {
  return validate(archiveStudentInputSchema, input);
}

export function validateStudentFilter(input: unknown): StudentFilter {
  return validate(studentFilterSchema, input);
}
