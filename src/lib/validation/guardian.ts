import { z } from "zod";
import { GUARDIAN_RELATIONSHIPS } from "../auth/domain";
import { emailSchema, idSchema, nameSchema, phoneSchema, validate } from "./common";

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

/**
 * Helper validasi data wali murid.
 */
export function validateCreateGuardianInput(input: unknown): CreateGuardianInput {
  return validate(createGuardianInputSchema, input);
}

export function validateLinkGuardianStudentInput(input: unknown): LinkGuardianStudentInput {
  return validate(linkGuardianStudentInputSchema, input);
}

export function validateGuardianActivationInput(input: unknown): GuardianActivationInput {
  return validate(guardianActivationInputSchema, input);
}
