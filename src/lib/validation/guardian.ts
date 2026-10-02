import { z } from "zod";
import { GUARDIAN_RELATIONSHIPS, GUARDIAN_STATUSES } from "../auth/domain";
import {
  emailSchema,
  idSchema,
  nameSchema,
  phoneSchema,
  searchQuerySchema,
  validate,
} from "./common";

/**
 * Skema validasi pembuatan data profil wali murid oleh staf lembaga.
 * Menggunakan konstanta tunggal GUARDIAN_RELATIONSHIPS dari auth/domain.ts tanpa duplikasi.
 */
export const createGuardianInputSchema = z
  .object({
    fullName: nameSchema,
    phoneWa: phoneSchema,
    email: emailSchema
      .optional()
      .or(z.literal(""))
      .transform((val) => (val === "" ? undefined : val)),
    relationship: z.enum(GUARDIAN_RELATIONSHIPS, {
      message: `Hubungan wali harus salah satu dari: ${GUARDIAN_RELATIONSHIPS.join(", ")}`,
    }),
  })
  .strict();

export type CreateGuardianInput = z.infer<typeof createGuardianInputSchema>;

/**
 * Skema validasi pengaitan wali murid dengan santri asuh (GuardianStudent).
 */
export const linkGuardianStudentInputSchema = z
  .object({
    guardianId: idSchema,
    studentId: idSchema,
    relationship: z.enum(GUARDIAN_RELATIONSHIPS, {
      message: `Hubungan wali harus salah satu dari: ${GUARDIAN_RELATIONSHIPS.join(", ")}`,
    }),
    isPrimary: z.boolean().optional().default(false),
  })
  .strict();

export type LinkGuardianStudentInput = z.infer<typeof linkGuardianStudentInputSchema>;

/**
 * Skema validasi aktivasi akun wali murid via one-time token.
 */
export const guardianActivationInputSchema = z
  .object({
    token: z
      .string({ message: "Token aktivasi wajib diisi" })
      .trim()
      .min(32, "Token aktivasi minimal 32 karakter hex")
      .max(128, "Token aktivasi maksimal 128 karakter"),
  })
  .strict();

export type GuardianActivationInput = z.infer<typeof guardianActivationInputSchema>;

// ---------------------------------------------------------------------------
// Phase 9.2 — Guardian Master Data CRUD oleh Staf + Wizard Undangan
// ---------------------------------------------------------------------------

/**
 * Skema filter daftar wali murid (pencarian + status) untuk staf lembaga.
 */
export const guardianFilterSchema = z
  .object({
    q: searchQuerySchema,
    status: z
      .enum(GUARDIAN_STATUSES, {
        message: `Status wali harus salah satu dari: ${GUARDIAN_STATUSES.join(", ")}`,
      })
      .optional(),
  })
  .strict();

export type GuardianFilter = z.infer<typeof guardianFilterSchema>;

/**
 * Skema pembaruan profil wali murid oleh staf (minimal satu bidang diubah).
 * Email kosong ("") berarti membersihkan email.
 */
export const updateGuardianInputSchema = z
  .object({
    guardianId: idSchema,
    fullName: nameSchema.optional(),
    phoneWa: phoneSchema.optional(),
    email: z
      .union([emailSchema, z.literal("")])
      .optional()
      .transform((val) => (val === "" ? null : val)),
    status: z
      .enum(GUARDIAN_STATUSES, {
        message: `Status wali harus salah satu dari: ${GUARDIAN_STATUSES.join(", ")}`,
      })
      .optional(),
  })
  .strict()
  .refine(
    (val) =>
      val.fullName !== undefined ||
      val.phoneWa !== undefined ||
      val.email !== undefined ||
      val.status !== undefined,
    { message: "Minimal satu bidang (nama, WhatsApp, email, atau status) wajib diubah." }
  );

export type UpdateGuardianInput = z.infer<typeof updateGuardianInputSchema>;

/**
 * Skema penonaktifan wali murid oleh staf (mencabut undangan belum ditebus).
 */
export const deactivateGuardianInputSchema = z
  .object({
    guardianId: idSchema,
    reason: z
      .string()
      .trim()
      .max(200, "Alasan penonaktifan maksimal 200 karakter")
      .optional(),
  })
  .strict();

export type DeactivateGuardianInput = z.infer<typeof deactivateGuardianInputSchema>;

/**
 * Skema pembuatan undangan aktivasi wali (token 1x pakai, berlaku 72 jam).
 */
export const createGuardianInvitationStaffInputSchema = z
  .object({
    guardianId: idSchema,
    sentVia: z
      .enum(["WHATSAPP", "SMS", "MANUAL"], {
        message: "Kanal undangan harus WHATSAPP, SMS, atau MANUAL",
      })
      .default("WHATSAPP"),
  })
  .strict();

export type CreateGuardianInvitationStaffInput = z.infer<
  typeof createGuardianInvitationStaffInputSchema
>;

/**
 * Helper validasi data wali murid.
 */
export function validateCreateGuardianInput(input: unknown): CreateGuardianInput {
  return validate(createGuardianInputSchema, input);
}

export function validateGuardianFilter(input: unknown): GuardianFilter {
  return validate(guardianFilterSchema, input ?? {});
}

export function validateUpdateGuardianInput(input: unknown): UpdateGuardianInput {
  return validate(updateGuardianInputSchema, input);
}

export function validateDeactivateGuardianInput(input: unknown): DeactivateGuardianInput {
  return validate(deactivateGuardianInputSchema, input);
}

export function validateCreateGuardianInvitationStaffInput(
  input: unknown
): CreateGuardianInvitationStaffInput {
  return validate(createGuardianInvitationStaffInputSchema, input);
}

export function validateLinkGuardianStudentInput(input: unknown): LinkGuardianStudentInput {
  return validate(linkGuardianStudentInputSchema, input);
}

export function validateGuardianActivationInput(input: unknown): GuardianActivationInput {
  return validate(guardianActivationInputSchema, input);
}
