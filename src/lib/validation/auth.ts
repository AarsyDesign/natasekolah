import { z } from "zod";
import { emailSchema, slugSchema, validate } from "./common";

/**
 * Skema validasi input form login staf internal lembaga.
 *
 * Mengabaikan secara otomatis atribut-atribut keamanan sensitif seperti
 * `institutionId`, `role`, `roles`, `permissions`, atau `isSuperAdmin`
 * jika dikirimkan oleh klien.
 */
export const loginInputSchema = z
  .object({
    institutionSlug: slugSchema,
    email: emailSchema,
    password: z
      .string({ message: "Kata sandi wajib diisi" })
      .min(1, "Kata sandi tidak boleh kosong")
      .max(128, "Kata sandi maksimal 128 karakter"),
  })
  .strict(); // Menolak kunci payload tak dikenal yang mencoba menyusup

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Memvalidasi payload kredensial login sebelum diproses oleh Authentication Service.
 */
export function validateLoginInput(input: unknown): LoginInput {
  return validate(loginInputSchema, input);
}
