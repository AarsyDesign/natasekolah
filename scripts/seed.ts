/**
 * Entry CLI bootstrap NataSekolah.
 *
 * Pakai:
 *   SEED_INSTITUTION_NAME="Ponpes Darul Quran" \
 *   SEED_INSTITUTION_SLUG="darul-quran" \
 *   SEED_ADMIN_NAME="Ustadz Ahmad" \
 *   SEED_ADMIN_EMAIL="admin@darul-quran.sch.id" \
 *   SEED_ADMIN_PASSWORD="<minimal 12 karakter>" \
 *   npm run seed
 *
 * Aturan keamanan:
 *   - Kata sandi HANYA diambil dari environment variable, tidak pernah dari argv
 *     (argv terlihat di `ps`), tidak pernah dicetak ke layar/log.
 *   - Skrip idempoten: jalankan sebanyak apa pun, data tidak akan terduplikasi.
 *   - Skrip tidak menyimpan kredensial apa pun ke file.
 */
import { seedBootstrap } from "./seed-core";

const ENV_MAP = {
  institutionName: "SEED_INSTITUTION_NAME",
  institutionSlug: "SEED_INSTITUTION_SLUG",
  institutionType: "SEED_INSTITUTION_TYPE",
  adminName: "SEED_ADMIN_NAME",
  adminEmail: "SEED_ADMIN_EMAIL",
  adminPassword: "SEED_ADMIN_PASSWORD",
} as const;

function readEnv(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, envName] of Object.entries(ENV_MAP)) {
    const value = process.env[envName];
    if (value && value.trim() !== "") out[key] = value;
  }
  const plugins = process.env.SEED_INSTITUTION_PLUGINS;
  if (plugins && plugins.trim() !== "") {
    out.institutionPlugins = plugins.split(",").map((p) => p.trim()).filter(Boolean);
  }
  return out;
}

function missingEnv(): string[] {
  const required = ["SEED_INSTITUTION_NAME", "SEED_INSTITUTION_SLUG",
                    "SEED_ADMIN_NAME", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"];
  return required.filter((n) => !(process.env[n] ?? "").trim());
}

async function main(): Promise<void> {
  const missing = missingEnv();
  if (missing.length > 0) {
    console.error("Bootstrap gagal: environment variable belum diisi:");
    for (const name of missing) console.error(`  - ${name}`);
    console.error("\nContoh pemakaian ada di komentar atas file scripts/seed.ts.");
    console.error("Catatan: kata sandi minimal 12 karakter dan TIDAK boleh ditulis di argv.");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await seedBootstrap(readEnv());
    // Hanya metadata non-rahasia yang dicetak — tanpa email, tanpa kata sandi.
    console.log("Bootstrap selesai.");
    console.log(`  lembaga : ${result.institutionSlug} (id ${result.institutionId})`);
    console.log(`            ${result.institutionCreated ? "dibuat baru" : "sudah ada, dipakai yang lama"}`);
    console.log(`  admin   : ${result.userCreated ? "akun SUPER_ADMIN dibuat" : "akun sudah ada, tidak diubah"}`);
    if (result.skippedBecause === "user-already-exists") {
      console.log("            (kata sandi TIDAK diubah — jalankan ulang tidak menimpa akun lama)");
    }
    console.log("\nLangkah berikutnya: buka /login, masuk memakai slug lembaga + email admin tersebut.");
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      const zod = err as unknown as { issues: { path: (string | number)[]; message: string }[] };
      console.error("Bootstrap gagal — input tidak valid:");
      for (const issue of zod.issues) {
        // Hanya lokasi + pesan yang dicetak, TIDAK pernah nilai input
        // (field adminPassword berisi kata sandi).
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }
    console.error("Bootstrap gagal:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await import("../src/lib/prisma").then((m) => m.prisma.$disconnect());
  }
}

void main();
