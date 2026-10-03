import { z } from "zod";
import { idSchema, validate } from "./common";

// ---------------------------------------------------------------------------
// Konstanta Audit Query (Phase 12.3 — AuditLog Query API + UI Filter)
// ---------------------------------------------------------------------------

/**
 * Nilai `action` yang dipakai penulis AuditLog di seluruh codebase
 * (CREATE / UPDATE / DELETE / LOGIN / IMPERSONATE / EXPORT / IMPORT /
 * VOID / SOFT_DELETE / BULK_PROMOTION / ARCHIVE / STATUS_CHANGE /
 * OFFLINE_ATTENDANCE_MUTATION / ...).
 *
 * Filter bersifat TERBUKA (string bebas, divalidasi panjang) — bukan enum
 * ketat — agar entri audit baru dari modul manapun tidak membuat filter
 * lama gagal memvalidasi.
 */
export const AUDIT_ACTION_MAX = 64;
export const AUDIT_ENTITY_MAX = 64;

/** Batas halaman (audit log bisa sangat besar — jangan izinkan limit liar). */
export const AUDIT_PAGE_SIZE_MIN = 10;
export const AUDIT_PAGE_SIZE_MAX = 50;
export const AUDIT_PAGE_SIZE_DEFAULT = 20;

/** Rentang tanggal wajib valid: `from` tidak boleh setelah `to`. */
const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD");

export const auditLogFilterSchema = z
  .object({
    action: z
      .string()
      .trim()
      .max(AUDIT_ACTION_MAX, `Aksi maksimal ${AUDIT_ACTION_MAX} karakter`)
      .optional(),
    entityType: z
      .string()
      .trim()
      .max(AUDIT_ENTITY_MAX, `Entitas maksimal ${AUDIT_ENTITY_MAX} karakter`)
      .optional(),
    entityId: idSchema.optional(),
    userId: idSchema.optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(AUDIT_PAGE_SIZE_MIN, `Minimal ${AUDIT_PAGE_SIZE_MIN} baris`)
      .max(AUDIT_PAGE_SIZE_MAX, `Maksimal ${AUDIT_PAGE_SIZE_MAX} baris`)
      .default(AUDIT_PAGE_SIZE_DEFAULT),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "Tanggal mulai tidak boleh setelah tanggal akhir",
      });
    }
  });

export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function validateAuditLogFilter(input: unknown): AuditLogFilter {
  return validate(auditLogFilterSchema, input ?? {});
}
