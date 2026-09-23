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
