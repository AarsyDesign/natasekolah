import { z } from "zod";
import { idSchema, validate } from "./common";

/**
 * Phase 9.3 — Student Full Profile (5 Kluster Dapodik/EMIS).
 *
 * Kluster 1–2 (identitas inti + relasi wali) sudah ada di model `Student`
 * dan `Guardian`. Tiga kluster terstruktur berikut divalidasi di sini:
 * - FAMILY   → data keluarga (ayah/ibu/kontak darurat)
 * - HEALTH   → kesehatan & disabilitas
 * - REGISTRY → berkas administratif (KK, Akta, BPJS, SKTM, kewarganegaraan)
 */

export const PROFILE_CLUSTERS = ["FAMILY", "HEALTH", "REGISTRY"] as const;
export type ProfileCluster = (typeof PROFILE_CLUSTERS)[number];

export const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;

export const DISABILITY_TYPES = [
  "NETRA",
  "RUNGU",
  "GRAHITA",
  "WICARA",
  "INTELEKTUAL",
  "FISIK",
  "PSIKOSOSIAL",
  "LAINNYA",
] as const;

export const NATIONALITIES = ["WNI", "WNA"] as const;

/** Nama orang opsional: "" (kosong) dinormalkan menjadi null. */
const nullableName = (label: string) =>
  z
    .union([z.literal(""), z.string({ message: `${label} wajib diisi` }).trim().min(1, `${label} tidak boleh kosong`).max(120, `${label} maksimal 120 karakter`)])
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

/** String opsional: "" (kosong) dinormalkan menjadi null. */
const nullableText = (label: string, max: number) =>
  z
    .string({ message: `${label} tidak boleh bertipe teks` })
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val));

/** Nomor identitas (NIK/KK/Akta/BPJS): digit saja, maksimal 32 karakter. */
const idNumberText = (label: string) =>
  z
    .string({ message: `${label} wajib diisi` })
    .trim()
    .max(32, `${label} maksimal 32 karakter`)
    .regex(/^[0-9]*$/, `${label} hanya boleh berisi angka`)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val));

/** Nomor telepon Indonesia longgar (opsional). */
const phoneText = (label: string) =>
  z
    .string({ message: `${label} wajib diisi` })
    .trim()
    .regex(/^(\+?62|0)?8[0-9]{7,13}$/, `Format ${label} tidak valid (contoh: 081234567890)`)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? null : val));

// ---------------------------------------------------------------------------
// Kluster FAMILY — data keluarga
// ---------------------------------------------------------------------------

export const familyDataInputSchema = z
  .object({
    fatherName: nullableName("Nama ayah"),
    fatherNik: idNumberText("NIK ayah"),
    fatherPhone: phoneText("Telepon ayah"),
    fatherOccupation: nullableText("Pekerjaan ayah", 120),
    motherName: nullableName("Nama ibu"),
    motherNik: idNumberText("NIK ibu"),
    motherPhone: phoneText("Telepon ibu"),
    motherOccupation: nullableText("Pekerjaan ibu", 120),
    parentAddress: nullableText("Alamat orang tua", 500),
    emergencyContactName: nullableName("Nama kontak darurat"),
    emergencyContactPhone: phoneText("Telepon kontak darurat"),
    emergencyContactRelation: nullableText("Hubungan kontak darurat", 60),
  })
  .strict()
  .superRefine((val, ctx) => {
    const filled = [
      "fatherName", "fatherNik", "fatherPhone", "fatherOccupation",
      "motherName", "motherNik", "motherPhone", "motherOccupation",
      "parentAddress", "emergencyContactName", "emergencyContactPhone",
      "emergencyContactRelation",
    ].some((f) => {
      const v = (val as Record<string, unknown>)[f];
      return v !== undefined && v !== null;
    });
    if (!filled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimal satu bidang data keluarga wajib diisi.",
      });
    }
  });

export type FamilyDataInput = z.infer<typeof familyDataInputSchema>;

// ---------------------------------------------------------------------------
// Kluster HEALTH — kesehatan & disabilitas
// ---------------------------------------------------------------------------

export const healthDataInputSchema = z
  .object({
    bloodType: z
      .enum(BLOOD_TYPES, {
        message: `Golongan darah harus salah satu dari: ${BLOOD_TYPES.join(", ")}`,
      })
      .optional()
      .nullable(),
    heightCm: z.coerce
      .number({ message: "Tinggi badan harus angka" })
      .int("Tinggi badan harus bilangan bulat (cm)")
      .min(40, "Tinggi badan minimal 40 cm")
      .max(250, "Tinggi badan maksimal 250 cm")
      .optional()
      .nullable(),
    weightKg: z.coerce
      .number({ message: "Berat badan harus angka" })
      .int("Berat badan harus bilangan bulat (kg)")
      .min(2, "Berat badan minimal 2 kg")
      .max(300, "Berat badan maksimal 300 kg")
      .optional()
      .nullable(),
    hasDisability: z.boolean().optional().default(false),
    disabilityType: z
      .enum(DISABILITY_TYPES, {
        message: `Jenis disabilitas harus salah satu dari: ${DISABILITY_TYPES.join(", ")}`,
      })
      .optional()
      .nullable(),
    disabilityNotes: nullableText("Keterangan disabilitas", 500),
    chronicIllness: nullableText("Penyakit menahun", 300),
    allergies: nullableText("Riwayat alergi", 300),
    lastCheckupAt: z.coerce
      .date({ message: "Tanggal medical check-up tidak valid" })
      .optional()
      .nullable(),
    healthNotes: nullableText("Catatan kesehatan", 500),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.hasDisability && !val.disabilityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disabilityType"],
        message: "Jenis disabilitas wajib dipilih bila status disabilitas aktif.",
      });
    }
    if (!val.hasDisability && val.disabilityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disabilityType"],
        message: "Jenis disabilitas hanya boleh diisi bila status disabilitas aktif.",
      });
    }
    if (!["bloodType", "heightCm", "weightKg", "disabilityType", "disabilityNotes", "chronicIllness", "allergies", "lastCheckupAt", "healthNotes"]
      .some((f) => {
        const v = (val as Record<string, unknown>)[f];
        return v !== undefined && v !== null;
      })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimal satu bidang data kesehatan wajib diisi.",
      });
    }
  });

export type HealthDataInput = z.infer<typeof healthDataInputSchema>;

// ---------------------------------------------------------------------------
// Kluster REGISTRY — berkas administratif
// ---------------------------------------------------------------------------

export const registryDataInputSchema = z
  .object({
    familyCardNo: idNumberText("Nomor Kartu Keluarga"),
    birthCertificateNo: idNumberText("Nomor Akta Kelahiran"),
    bpjsNumber: idNumberText("Nomor BPJS/KIS"),
    bpjsProvider: nullableText("Provider BPJS", 120),
    sktmNumber: idNumberText("Nomor SKTM"),
    nationality: z
      .enum(NATIONALITIES, {
        message: `Kewarganegaraan harus WNI atau WNA`,
      })
      .optional()
      .default("WNI"),
    previousSchool: nullableText("Asal sekolah", 200),
    registryNotes: nullableText("Catatan registry", 500),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!["familyCardNo", "birthCertificateNo", "bpjsNumber", "bpjsProvider", "sktmNumber", "previousSchool", "registryNotes"]
      .some((f) => {
        const v = (val as Record<string, unknown>)[f];
        return v !== undefined && v !== null;
      })) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimal satu bidang data registry wajib diisi.",
      });
    }
  });

export type RegistryDataInput = z.infer<typeof registryDataInputSchema>;

// ---------------------------------------------------------------------------
// Wrapper upsert per kluster
// ---------------------------------------------------------------------------

const baseClusterInput = { studentId: idSchema };

export const upsertStudentClusterInputSchema = z.discriminatedUnion("cluster", [
  z.object({ ...baseClusterInput, cluster: z.literal("FAMILY"), data: familyDataInputSchema }),
  z.object({ ...baseClusterInput, cluster: z.literal("HEALTH"), data: healthDataInputSchema }),
  z.object({ ...baseClusterInput, cluster: z.literal("REGISTRY"), data: registryDataInputSchema }),
]);

export type UpsertStudentClusterInput = z.infer<typeof upsertStudentClusterInputSchema>;

/** Skema pengambilan ketiga kluster profil siswa. */
export const getStudentProfileInputSchema = z.object({ studentId: idSchema }).strict();

export type GetStudentProfileInput = z.infer<typeof getStudentProfileInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function validateUpsertStudentClusterInput(input: unknown): UpsertStudentClusterInput {
  return validate(upsertStudentClusterInputSchema, input);
}

export function validateGetStudentProfileInput(input: unknown): GetStudentProfileInput {
  return validate(getStudentProfileInputSchema, input);
}
