import { z } from "zod";
import { ROLES, isValidRole, Role } from "../auth/permissions";
import { phoneSchema } from "../validation/common";

export const institutionTypeEnum = z.enum([
  "SEKOLAH",
  "PESANTREN",
  "PESANTREN_TERPADU",
  "RUMAH_TAHFIDZ",
  "PKBM",
]);

export const updateInstitutionProfileSchema = z.object({
  name: z
    .string({ message: "Nama lembaga wajib diisi" })
    .trim()
    .min(3, "Nama lembaga minimal 3 karakter")
    .max(100, "Nama lembaga maksimal 100 karakter"),
  type: institutionTypeEnum.optional(),
  address: z
    .string()
    .trim()
    .max(255, "Alamat maksimal 255 karakter")
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .nullable()
    .optional(),
  logoUrl: z
    .string()
    .trim()
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .email("Format email lembaga tidak valid")
    .nullable()
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type UpdateInstitutionProfileInput = z.infer<typeof updateInstitutionProfileSchema>;

export const updateTerminologySchema = z.object({
  student: z.string().trim().min(1).max(50).optional(),
  studentPlural: z.string().trim().min(1).max(50).optional(),
  guardian: z.string().trim().min(1).max(50).optional(),
  classroom: z.string().trim().min(1).max(50).optional(),
  academicYear: z.string().trim().min(1).max(50).optional(),
  fee: z.string().trim().min(1).max(50).optional(),
  teacher: z.string().trim().min(1).max(50).optional(),
});

export type UpdateTerminologyInput = z.infer<typeof updateTerminologySchema>;

export const updateOperationalSettingsSchema = z.object({
  attendance: z
    .object({
      lateThresholdMinutes: z.number().int().min(0).max(240).default(15),
      requireAttendanceNotes: z.boolean().default(false),
    })
    .optional(),
  finance: z
    .object({
      receiptNumberPrefix: z.string().trim().min(1).max(10).default("KW"),
      invoiceDueDays: z.number().int().min(1).max(90).default(10),
      receiptFooterNote: z.string().trim().max(255).default("Kwitansi resmi diterbitkan oleh sistem."),
    })
    .optional(),
  communication: z
    .object({
      enableWhatsAppNotifications: z.boolean().default(true),
      whatsappProvider: z.enum(["fonnte", "waha", "deeplink"]).default("deeplink"),
    })
    .optional(),
  academic: z
    .object({
      passingGradeDefault: z.number().min(0).max(100).default(75),
      reportCardHeader: z.string().trim().max(255).default("Laporan Capaian Kompetensi Peserta Didik"),
    })
    .optional(),
});

export type UpdateOperationalSettingsInput = z.infer<typeof updateOperationalSettingsSchema>;

export const updateUserRolesSchema = z.object({
  roles: z
    .array(
      z.string().refine((val): val is Role => isValidRole(val), {
        message: `Peran harus salah satu dari: ${ROLES.join(", ")}`,
      })
    )
    .min(1, "Pengguna minimal harus memiliki 1 peran"),
});

export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;

export const toggleUserActiveSchema = z.object({
  isActive: z.boolean({ message: "Status aktif wajib bernilai boolean" }),
});

export type ToggleUserActiveInput = z.infer<typeof toggleUserActiveSchema>;

/**
 * Skema pembuatan akun staf/guru baru dari dalam aplikasi.
 *
 * Latar: sebelumnya tidak ada satu pun `user.create` di `src/` — akun hanya bisa
 * lahir dari skrip bootstrap, sehingga admin tidak bisa menambahkan guru/staf.
 * Password minimal 12 karakter (selaras dengan bootstrap) dan peran wajib valid
 * sesuai ROLES; pencegahan eskalasi hak (SUPER_ADMIN) ditangani di lapisan service.
 */
export const createManagedUserSchema = z
  .object({
    name: z
      .string({ message: "Nama wajib diisi" })
      .trim()
      .min(2, "Nama minimal 2 karakter")
      .max(120, "Nama maksimal 120 karakter"),
    email: z
      .string({ message: "Email wajib diisi" })
      .trim()
      .toLowerCase()
      .email("Format email tidak valid")
      .max(190, "Email maksimal 190 karakter"),
    phoneWa: phoneSchema.optional(),
    password: z
      .string({ message: "Kata sandi wajib diisi" })
      .min(12, "Kata sandi minimal 12 karakter")
      .max(128, "Kata sandi maksimal 128 karakter"),
    roles: z
      .array(
        z.string().refine((val): val is Role => isValidRole(val), {
          message: `Peran harus salah satu dari: ${ROLES.join(", ")}`,
        })
      )
      .min(1, "Pengguna minimal harus memiliki 1 peran")
      .refine((roles) => new Set(roles).size === roles.length, {
        message: "Peran tidak boleh duplikat",
      }),
  })
  .strict(); // menolak payload tak dikenal (mis. institutionId dari klien)

export type CreateManagedUserInput = z.infer<typeof createManagedUserSchema>;
