import { z } from "zod";
import { validate } from "./common";
import { DKAS_QUERY_MAX } from "../dkas/catalog";

/**
 * Validasi input server action DKAS Bot (Phase 12.7).
 * Query dipotong spasi luar, panjang dibatasi (1–300 karakter) — di luar itu
 * bukan pertanyaan manusiawi dan hanya membuang token model.
 */

export const DKAS_QUERY_MIN = 3;

export const dkasQueryInputSchema = z
  .object({
    query: z
      .string({ message: "Pertanyaan wajib diisi." })
      .trim()
      .min(
        DKAS_QUERY_MIN,
        `Pertanyaan minimal ${DKAS_QUERY_MIN} karakter. Contoh: "siswa yang alpha hari ini".`
      )
      .max(DKAS_QUERY_MAX, `Pertanyaan maksimal ${DKAS_QUERY_MAX} karakter.`),
  })
  .strict();

export type DkasQueryInput = z.infer<typeof dkasQueryInputSchema>;

export function validateDkasQueryInput(raw: unknown): DkasQueryInput {
  return validate(dkasQueryInputSchema, raw);
}
