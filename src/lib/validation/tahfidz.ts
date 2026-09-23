import { z } from "zod";
import { idSchema, validate } from "./common";
import { TAHFIDZ_TYPES, TAHFIDZ_QUALITIES } from "../tahfidz/types";

/**
 * Skema validasi input pencatatan Tahfidz Mutaba'ah (Ziyadah/Muraja'ah).
 */
export const createTahfidzRecordInputSchema = z
  .object({
    studentId: idSchema,
    enrollmentId: idSchema,
    date: z.coerce.date({
      message: "Format tanggal setoran tidak valid",
    }),
    surah: z
      .number({
        message: "Nomor surah wajib diisi",
      })
      .int("Nomor surah harus bilangan bulat")
      .min(1, "Nomor surah minimal 1 (Al-Fatihah)")
      .max(114, "Nomor surah maksimal 114 (An-Nas)"),
    startAyah: z
      .number({
        message: "Ayat awal wajib diisi",
      })
      .int("Ayat awal harus bilangan bulat")
      .min(1, "Ayat awal minimal 1"),
    endAyah: z
      .number({
        message: "Ayat akhir wajib diisi",
      })
      .int("Ayat akhir harus bilangan bulat")
      .min(1, "Ayat akhir minimal 1"),
    type: z.enum(TAHFIDZ_TYPES, {
      message: "Jenis mutaba'ah harus SETORAN atau MURAJAAH",
    }),
    quality: z.enum(TAHFIDZ_QUALITIES, {
      message: "Kualitas hafalan harus MUMTAZ, JAYYID, MAQBUL, atau REPEAT",
    }),
    note: z
      .string()
      .trim()
      .max(500, "Catatan maksimal 500 karakter")
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
  })
  .refine((data) => data.endAyah >= data.startAyah, {
    message: "Ayat akhir tidak boleh lebih kecil dari ayat awal",
    path: ["endAyah"],
  });

export type CreateTahfidzRecordInput = z.infer<typeof createTahfidzRecordInputSchema>;

export function validateCreateTahfidzRecordInput(data: unknown): CreateTahfidzRecordInput {
  return validate(createTahfidzRecordInputSchema, data);
}

/**
 * Filter pencarian riwayat tahfidz
 */
export const tahfidzRecordFilterSchema = z.object({
  studentId: idSchema.optional(),
  enrollmentId: idSchema.optional(),
  type: z.enum(TAHFIDZ_TYPES).optional(),
  quality: z.enum(TAHFIDZ_QUALITIES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type TahfidzRecordFilter = z.infer<typeof tahfidzRecordFilterSchema>;

export function validateTahfidzRecordFilter(data: unknown): TahfidzRecordFilter {
  return validate(tahfidzRecordFilterSchema, data);
}
