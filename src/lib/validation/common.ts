import { z } from "zod";

/**
 * Detail galat per bidang (field-level validation error).
 */
export interface FieldValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Kesalahan validasi (400 Bad Request) saat data payload/form klien tidak memenuhi aturan skema.
 */
export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly status = 400;
  readonly errors: FieldValidationError[];

  constructor(message: string, errors: FieldValidationError[] = []) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

/**
 * Mengonversi ZodError menjadi daftar galat bidang yang terstruktur dan mudah dibaca.
 */
export function formatZodError(error: z.ZodError): FieldValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Helper validasi aman yang mengeksekusi safeParse dan melempar ValidationError jika tidak valid.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const formatted = formatZodError(result.error);
    const summary = formatted.map((e) => `${e.field || "root"}: ${e.message}`).join("; ");
    throw new ValidationError(`Validasi input gagal: ${summary}`, formatted);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Reusable Primitive Schemas
// ---------------------------------------------------------------------------

/**
 * Skema string non-empty yang dipotong spasi luarnya (trimmed).
 */
export const nonEmptyString = (fieldLabel = "Bidang", min = 1, max = 255) =>
  z
    .string({ message: `${fieldLabel} wajib diisi` })
    .trim()
    .min(min, `${fieldLabel} tidak boleh kosong`)
    .max(max, `${fieldLabel} maksimal ${max} karakter`);

/**
 * Skema identifier unik (CUID / UUID / Slug ID).
 */
export const idSchema = z
  .string({ message: "ID wajib diisi" })
  .trim()
  .min(1, "ID tidak boleh kosong")
  .max(64, "ID maksimal 64 karakter");

/**
 * Skema nama orang / nama entitas.
 */
export const nameSchema = z
  .string({ message: "Nama wajib diisi" })
  .trim()
  .min(1, "Nama tidak boleh kosong")
  .max(120, "Nama maksimal 120 karakter");

/**
 * Skema alamat email berformat standar (disimpan dalam huruf kecil).
 */
export const emailSchema = z
  .string({ message: "Email wajib diisi" })
  .trim()
  .email("Format email tidak valid")
  .max(255, "Email maksimal 255 karakter")
  .toLowerCase();

/**
 * Skema nomor telepon seluler / WhatsApp Indonesia (+62 / 62 / 08...).
 */
export const phoneSchema = z
  .string({ message: "Nomor WhatsApp wajib diisi" })
  .trim()
  .regex(/^(\+?62|0)8[0-9]{7,13}$/, "Format nomor WhatsApp tidak valid (contoh: 081234567890)");

/**
 * Skema URL slug institusi / modul (hanya huruf kecil, angka, dan tanda hubung).
 */
export const slugSchema = z
  .string({ message: "Slug wajib diisi" })
  .trim()
  .min(2, "Slug minimal 2 karakter")
  .max(100, "Slug maksimal 100 karakter")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-)");

/**
 * Skema pagination umum dengan batas atas yang masuk akal (mencegah DoS unbounded query).
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, "Nomor halaman minimal 1").default(1),
  limit: z.coerce.number().int().min(1, "Batas minimal 1 data").max(100, "Batas maksimal 100 data per halaman").default(20),
});

/**
 * Skema kata kunci pencarian umum dengan batas panjang maksimum.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .max(100, "Kata kunci pencarian maksimal 100 karakter")
  .optional();
