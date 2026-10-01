/**
 * Bootstrap NataSekolah — inti logika pembuatan lembaga pertama + akun SUPER_ADMIN.
 *
 * Mengapa ada skrip ini: aplikasi tidak memiliki halaman pendaftaran, onboarding,
 * maupun seed bawaan — tidak ada satu pun `institution.create` / `user.create`
 * di `src/`. Akibatnya pada database kosong tidak mungkin login (temuan audit
 * 2026-10-01). Skrip ini menutup celah tersebut dengan jalur sekali-jalan yang:
 *   - idempoten: dijalankan ulang tidak pernah menggandakan data;
 *   - tervalidasi Zod (password minimal 12 karakter, slug format ketat);
 *   - TIDAK PERNAH mencetak kata sandi — hanya slug, id, dan bendera hasil.
 *
 * Dipakai oleh `scripts/seed.ts` (CLI) dan diuji oleh `test/seed-bootstrap.test.ts`.
 */
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";

/** Plugin yang diaktifkan pada lembaga baru bila tidak dispesifikkan. */
const DEFAULT_PLUGINS = ["FORMAL_ACADEMIC"];

export const INSTITUTION_TYPES = [
  "SEKOLAH",
  "PESANTREN",
  "PESANTREN_TERPADU",
  "RUMAH_TAHFIDZ",
  "PKBM",
] as const;

const seedSchema = z.object({
  institutionName: z.string().trim().min(2, "Nama lembaga minimal 2 karakter").max(120),
  institutionSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug minimal 2 karakter")
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  institutionType: z.enum(INSTITUTION_TYPES).default("SEKOLAH"),
  institutionPlugins: z.array(z.string().min(1)).min(1).optional(),
  adminName: z.string().trim().min(2, "Nama admin minimal 2 karakter").max(120),
  adminEmail: z.string().trim().toLowerCase().email("Email admin tidak valid"),
  adminPassword: z
    .string()
    .min(12, "Kata sandi minimal 12 karakter")
    .max(128, "Kata sandi maksimal 128 karakter"),
});

export type SeedInput = z.input<typeof seedSchema>;

export interface SeedResult {
  institutionId: string;
  institutionSlug: string;
  institutionCreated: boolean;
  userId: string | null;
  userCreated: boolean;
  /** Mengapa user tidak dibuat (mis. sudah ada dari run sebelumnya). */
  skippedBecause: "user-already-exists" | null;
}

/**
 * Menjalankan bootstrap. Aman dipanggil berulang (idempoten).
 * Melempar ZodError bila input tidak valid — pemanggil CLI menangkap dan
 * menampilkan pesan tanpa menyertakan kata sandi.
 */
export async function seedBootstrap(raw: unknown): Promise<SeedResult> {
  const input = seedSchema.parse(raw);

  // 1. Lembaga: buat hanya bila slug belum dipakai (slug unik di skema).
  const existingInstitution = await prisma.institution.findUnique({
    where: { slug: input.institutionSlug },
  });

  let institutionId: string;
  let institutionCreated = false;

  if (existingInstitution) {
    institutionId = existingInstitution.id;
  } else {
    const created = await prisma.institution.create({
      data: {
        name: input.institutionName,
        slug: input.institutionSlug,
        type: input.institutionType,
        enabledPlugins: JSON.stringify(input.institutionPlugins ?? DEFAULT_PLUGINS),
      },
    });
    institutionId = created.id;
    institutionCreated = true;
  }

  // 2. Akun SUPER_ADMIN: hanya bila belum ada di lembaga tersebut.
  const email = input.adminEmail;
  const existingUser = await prisma.user.findUnique({
    where: { institutionId_email: { institutionId, email } },
  });

  if (existingUser) {
    return {
      institutionId,
      institutionSlug: input.institutionSlug,
      institutionCreated,
      userId: existingUser.id,
      userCreated: false,
      skippedBecause: "user-already-exists",
    };
  }

  const passwordHash = await hashPassword(input.adminPassword);
  const user = await prisma.user.create({
    data: {
      institutionId,
      name: input.adminName,
      email,
      passwordHash,
      roles: JSON.stringify(["SUPER_ADMIN"]),
      isActive: true,
    },
  });

  return {
    institutionId,
    institutionSlug: input.institutionSlug,
    institutionCreated,
    userId: user.id,
    userCreated: true,
    skippedBecause: null,
  };
}
