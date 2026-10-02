import { z } from "zod";
import { idSchema, validate } from "./common";
import { PERMIT_STATUSES, PERMIT_TYPES } from "../permit/types";

/**
 * Skema validasi pembuatan permohonan izin pulang (tasrih).
 *
 * `academicYearId` opsional — bila kosong, layanan memakai tahun ajaran
 * aktif institusi.
 */
export const createPermitRequestInputSchema = z
  .object({
    studentId: idSchema,
    academicYearId: idSchema.optional(),
    type: z.enum(PERMIT_TYPES, {
      message: "Jenis izin harus HOME_LEAVE, SICK_LEAVE, atau EXCUSED",
    }),
    leaveAt: z.coerce.date({
      message: "Waktu berangkat wajib diisi",
    }),
    returnAt: z.coerce.date().optional().nullable(),
    reason: z
      .string()
      .trim()
      .min(3, "Alasan izin minimal 3 karakter")
      .max(500, "Alasan izin maksimal 500 karakter")
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
  })
  .superRefine((val, ctx) => {
    if (val.returnAt && val.returnAt.getTime() < val.leaveAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["returnAt"],
        message: "Waktu kembali tidak boleh sebelum waktu berangkat",
      });
    }
  });

export type CreatePermitRequestInput = z.infer<typeof createPermitRequestInputSchema>;

export function validateCreatePermitRequestInput(data: unknown): CreatePermitRequestInput {
  return validate(createPermitRequestInputSchema, data);
}

/**
 * Skema persetujuan / penolakan izin (approve / reject).
 */
export const decidePermitInputSchema = z.object({
  permitId: idSchema,
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val)),
});

export type DecidePermitInput = z.infer<typeof decidePermitInputSchema>;

export function validateDecidePermitInput(data: unknown): DecidePermitInput {
  return validate(decidePermitInputSchema, data);
}

/**
 * Skema penandaiannya santri telah kembali ke asrama.
 */
export const returnPermitInputSchema = decidePermitInputSchema;

export type ReturnPermitInput = z.infer<typeof returnPermitInputSchema>;

export function validateReturnPermitInput(data: unknown): ReturnPermitInput {
  return validate(returnPermitInputSchema, data);
}

/**
 * Skema penandaan izin terlambat kembali (OVERDUE).
 */
export const markOverduePermitInputSchema = z.object({
  permitId: idSchema,
});

export type MarkOverduePermitInput = z.infer<typeof markOverduePermitInputSchema>;

export function validateMarkOverduePermitInput(data: unknown): MarkOverduePermitInput {
  return validate(markOverduePermitInputSchema, data);
}

/**
 * Filter daftar permohonan izin.
 */
export const permitFilterSchema = z.object({
  status: z.enum(PERMIT_STATUSES).optional(),
  type: z.enum(PERMIT_TYPES).optional(),
  studentId: idSchema.optional(),
});

export type PermitFilter = z.infer<typeof permitFilterSchema>;

export function validatePermitFilter(data: unknown): PermitFilter {
  return validate(permitFilterSchema, data);
}
