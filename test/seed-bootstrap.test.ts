import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { seedBootstrap } from "../scripts/seed-core";
import { prisma } from "../src/lib/prisma";
import { verifyPassword } from "../src/lib/auth/password";
import { authenticateCredentials, loginUser } from "../src/lib/auth/service";
import { validateSessionToken, revokeSession } from "../src/lib/auth/session";

/**
 * Pengujian bootstrap (pembuatan lembaga + akun SUPER_ADMIN).
 *
 * Latar: aplikasi sama sekali tidak punya jalur pembuatan akun — tidak ada
 * `institution.create` / `user.create` di `src/`, `hashPassword` tidak pernah
 * dipanggil, tidak ada halaman onboarding maupun seed bawaan. Tanpa skrip ini
 * database kosong mustahil dipakai. Pengujian ini menegaskan jalur baru itu
 * benar, idempoten, dan benar-benar menghasilkan akun yang bisa login.
 */

const stamp = Date.now();
const slug = `uji-seed-${stamp}`;
const email = `admin-${stamp}@uji.test`;
const password = "SandiBootstrap2026!";

async function cleanup(): Promise<void> {
  const inst = await prisma.institution.findUnique({ where: { slug } });
  if (inst) {
    await prisma.user.deleteMany({ where: { institutionId: inst.id } });
    await prisma.institution.delete({ where: { id: inst.id } });
  }
}

describe("seedBootstrap — pembuatan lembaga & SUPER_ADMIN", () => {
  after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("membuat lembaga dan akun SUPER_ADMIN pada database kosong", async () => {
    const res = await seedBootstrap({
      institutionName: "Lembaga Uji Seed",
      institutionSlug: slug,
      adminName: "Admin Uji",
      adminEmail: email,
      adminPassword: password,
    });

    assert.equal(res.institutionCreated, true, "lembaga harus dibuat baru");
    assert.equal(res.userCreated, true, "akun admin harus dibuat baru");
    assert.equal(res.skippedBecause, null);

    const inst = await prisma.institution.findUnique({ where: { slug } });
    assert.ok(inst, "lembaga tersimpan di database");
    assert.equal(inst.type, "SEKOLAH", "tipe baku SEKOLAH");
    assert.deepEqual(JSON.parse(inst.enabledPlugins), ["FORMAL_ACADEMIC"]);

    const user = await prisma.user.findUnique({
      where: { institutionId_email: { institutionId: inst.id, email } },
    });
    assert.ok(user, "akun tersimpan di database");
    assert.equal(user.institutionId, inst.id, "akun menempel pada lembaganya (tenant)");
    assert.equal(user.isActive, true);
    assert.deepEqual(JSON.parse(user.roles), ["SUPER_ADMIN"], "peran SUPER_ADMIN");
    assert.notEqual(user.passwordHash, password, "kata sandi disimpan ter-hash");
    assert.ok(user.passwordHash.startsWith("$2"), "format hash bcrypt");
    assert.equal(await verifyPassword(password, user.passwordHash), true);
  });

  it("idempoten: dijalankan ulang tidak menggandakan data dan tidak menimpa akun", async () => {
    const before = await prisma.user.count({
      where: { institution: { slug } },
    });

    const res = await seedBootstrap({
      institutionName: "Nama Baru Yang Diabaikan",
      institutionSlug: slug,
      adminName: "Admin Lain",
      adminEmail: email,
      adminPassword: "KataSandiBerbeda123!",
    });

    assert.equal(res.institutionCreated, false, "lembaga tidak dibuat lagi");
    assert.equal(res.userCreated, false, "akun tidak dibuat lagi");
    assert.equal(res.skippedBecause, "user-already-exists");
    assert.ok(res.userId, "mengembalikan id akun yang sudah ada");

    const afterCount = await prisma.user.count({ where: { institution: { slug } } });
    assert.equal(afterCount, before, "jumlah akun tidak berubah");
  });

  it("akun hasil bootstrap benar-benar bisa login lewat jalur autentikasi resmi", async () => {
    const result = await authenticateCredentials({
      institutionSlug: slug,
      email,
      plainPassword: password,
    });

    assert.equal(result.user.email, email);
    assert.equal(result.user.isActive, true);
    assert.equal(result.institution.slug, slug);
  });

  it("login lewat layanan menghasilkan sesi dan menyaring passwordHash", async () => {
    const { user, rawToken } = await loginUser({
      institutionSlug: slug,
      email,
      plainPassword: password,
    });

    assert.equal(rawToken.length, 64, "token mentah 256-bit (32 byte hex)");
    assert.equal("passwordHash" in user, false, "passwordHash tidak bolol ke pemanggil");
    assert.equal(user.email, email);

    // sesi benar-benar tercatat dan tervalidasi oleh jalur resmi
    const payload = await validateSessionToken(rawToken);
    assert.ok(payload, "sesi hasil login tervalidasi");
    assert.equal(payload.subjectType, "INTERNAL_USER");
    assert.equal(payload.user.id, user.id);

    await revokeSession(rawToken);
  });

  it("login ditolak untuk kata sandi yang salah (memastikan bukan tes semu)", async () => {
    await assert.rejects(
      () =>
        authenticateCredentials({
          institutionSlug: slug,
          email,
          plainPassword: "KataSandiSalah999!",
        }),
      /tidak valid|AuthenticationError|Invalid/i
    );
  });

  it("menolak kata sandi lemah tanpa membuat data apa pun", async () => {
    const weakSlug = `${slug}-lemah`;
    await assert.rejects(
      () =>
        seedBootstrap({
          institutionName: "Lembaga Lemah",
          institutionSlug: weakSlug,
          adminName: "Admin",
          adminEmail: `lemah-${stamp}@uji.test`,
          adminPassword: "pendek",
        }),
      (err: unknown) => {
        const name = (err as { name?: string }).name;
        return name === "ZodError";
      },
      "password <12 karakter harus ditolak Zod"
    );

    const inst = await prisma.institution.findUnique({ where: { slug: weakSlug } });
    assert.equal(inst, null, "lembaga tidak boleh terbuat bila validasi gagal");
  });

  it("menolak slug yang tidak sah", async () => {
    await assert.rejects(
      () =>
        seedBootstrap({
          institutionName: "Lembaga Slug Buruk",
          institutionSlug: "Slug Tidak Sah!!",
          adminName: "Admin",
          adminEmail: `slug-${stamp}@uji.test`,
          adminPassword: password,
        }),
      (err: unknown) => (err as { name?: string }).name === "ZodError"
    );
  });
});
