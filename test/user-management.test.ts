import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createManagedUser, listManagedUsers } from "../src/lib/settings/user-service";
import { authenticateCredentials } from "../src/lib/auth/service";
import { resolvePermissionsFromRoles } from "../src/lib/auth/permissions";
import type { TenantContext } from "../src/lib/tenant/context";

/**
 * Pengujian pembuatan akun staf/guru dari dalam aplikasi.
 *
 * Latar: sebelumnya `src/` sama sekali tidak berisi `user.create` — akun hanya
 * bisa lahir dari skrip bootstrap, sehingga admin tidak bisa menambah guru/staf
 * dari UI. Pengujian ini menegaskan jalur baru memenuhi DoD: validasi, RBAC,
 * isolasi tenant, anti-escalation, dan akun yang benar-benar bisa login.
 */

const stamp = Date.now();
const password = "SandiStafBaru2026!";

function ctxFor(institutionId: string, roles: string[], userId = "u_admin"): TenantContext {
  return {
    userId,
    institutionId,
    roles,
    permissions: resolvePermissionsFromRoles(roles),
    isSuperAdmin: roles.includes("SUPER_ADMIN"),
  };
}

describe("createManagedUser — pembuatan akun staf", () => {
  const slugA = `uji-staf-a-${stamp}`;
  const slugB = `uji-staf-b-${stamp}`;
  let instA: string;
  let instB: string;

  after(async () => {
    for (const id of [instA, instB]) {
      if (id) {
        await prisma.user.deleteMany({ where: { institutionId: id } });
        await prisma.institution.delete({ where: { id } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  async function ensureInstitutions(): Promise<void> {
    if (!instA) {
      instA = (
        await prisma.institution.create({
          data: { name: "Lembaga Staf A", slug: slugA },
        })
      ).id;
    }
    if (!instB) {
      instB = (
        await prisma.institution.create({
          data: { name: "Lembaga Staf B", slug: slugB },
        })
      ).id;
    }
  }

  it("membuat akun di lembaga SESI, bukan lembaga yang dikirim klien", async () => {
    await ensureInstitutions();
    const ctx = ctxFor(instA, ["SUPER_ADMIN"]);

    const created = await createManagedUser(ctx, {
      name: "Guru Matematika",
      email: `guru-${stamp}@uji.test`,
      password,
      roles: ["TEACHER"],
    });

    assert.equal(created.email, `guru-${stamp}@uji.test`);
    assert.deepEqual(created.roles, ["TEACHER"]);
    assert.equal(created.isActive, true);
    assert.equal(created.lastLoginAt, null);

    const row = await prisma.user.findUnique({ where: { id: created.id } });
    assert.ok(row, "akun tersimpan");
    assert.equal(row.institutionId, instA, "menempel pada lembaga sesi");
    assert.notEqual(row.passwordHash, password, "kata sandi ter-hash");
    assert.ok(row.passwordHash.startsWith("$2"), "format bcrypt");
  });

  it("menolak payload klien yang menyisipkan institutionId lain", async () => {
    await ensureInstitutions();
    const ctx = ctxFor(instA, ["SUPER_ADMIN"]);

    // Skema `.strict()`: kunci tak dikenal membuat seluruh payload ditolak,
    // sehingga mustahil memilih lembaga lain dari sisi klien.
    await assert.rejects(
      () =>
        createManagedUser(ctx, {
          name: "Penyusup Tenant",
          email: `susup-${stamp}@uji.test`,
          password,
          roles: ["TEACHER"],
          institutionId: instB,
        }),
      (err: unknown) => {
        const e = err as { name?: string; message?: string };
        // validate() membungkus ZodError menjadi ValidationError
        return e.name === "ValidationError" && /Unrecognized key/.test(e.message ?? "");
      }
    );

    const leak = await prisma.user.findFirst({
      where: { email: `susup-${stamp}@uji.test` },
    });
    assert.equal(leak, null, "tidak ada baris yang terbuat saat validasi gagal");
  });

  it("akun hasil pembuatan benar-benar bisa login", async () => {
    await ensureInstitutions();
    const ctx = ctxFor(instA, ["SUPER_ADMIN"]);

    const email = `login-staf-${stamp}@uji.test`;
    await createManagedUser(ctx, {
      name: "Staf Login",
      email,
      password,
      roles: ["ADMIN"],
    });

    const result = await authenticateCredentials({
      institutionSlug: slugA,
      email,
      plainPassword: password,
    });
    assert.equal(result.user.email, email);
    assert.equal(result.institution.slug, slugA);
    assert.equal(result.user.isActive, true);
  });

  it("menolak pembuat tanpa izin staff:manage (RBAC)", async () => {
    await ensureInstitutions();
    const teacherCtx = ctxFor(instA, ["TEACHER"], "u_guru");

    await assert.rejects(
      () =>
        createManagedUser(teacherCtx, {
          name: "Harus Gagal",
          email: `tanpa-izin-${stamp}@uji.test`,
          password,
          roles: ["TEACHER"],
        }),
      (err: unknown) => {
        const name = (err as { name?: string }).name ?? "";
        return name === "AuthorizationError" || /izin/i.test(String(err));
      },
      "guru tanpa staff:manage harus ditolak"
    );
  });

  it("menolak eskalasi hak: hanya SUPER_ADMIN yang boleh membuat akun SUPER_ADMIN", async () => {
    await ensureInstitutions();
    // FOUNDATION_HEAD punya staff:manage tetapi bukan superadmin —
    // jadi tes ini benar-benar menembus RBAC lalu berhenti di aturan eskalasi.
    const ctx = ctxFor(instA, ["FOUNDATION_HEAD", "PRINCIPAL"], "u_kabag");

    await assert.rejects(
      () =>
        createManagedUser(ctx, {
          name: "Naik Jabatan",
          email: `eskalasi-${stamp}@uji.test`,
          password,
          roles: ["SUPER_ADMIN"],
        }),
      /Hanya Super Admin/
    );
  });

  it("menolak email ganda dalam lembaga yang sama", async () => {
    await ensureInstitutions();
    const ctx = ctxFor(instA, ["SUPER_ADMIN"]);
    const email = `duplikat-${stamp}@uji.test`;

    await createManagedUser(ctx, { name: "Pertama", email, password, roles: ["TEACHER"] });

    await assert.rejects(
      () => createManagedUser(ctx, { name: "Kedua", email, password, roles: ["TEACHER"] }),
      /Email sudah terdaftar/
    );
  });

  it("menolak kata sandi lemah dan peran tak dikenal", async () => {
    await ensureInstitutions();
    const ctx = ctxFor(instA, ["SUPER_ADMIN"]);

    await assert.rejects(
      () =>
        createManagedUser(ctx, {
          name: "Sandi Lemah",
          email: `lemah-${stamp}@uji.test`,
          password: "abc123",
          roles: ["TEACHER"],
        }),
      /Kata sandi minimal 12 karakter/
    );

    await assert.rejects(
      () =>
        createManagedUser(ctx, {
          name: "Peran Ngawur",
          email: `peran-${stamp}@uji.test`,
          password,
          roles: ["SUPER_HERO"],
        }),
      /Peran harus salah satu dari/
    );
  });

  it("isolasi tenant: lembaga lain tidak melihat akun yang dibuat", async () => {
    await ensureInstitutions();
    const email = `tersembunyi-${stamp}@uji.test`;
    await createManagedUser(ctxFor(instA, ["SUPER_ADMIN"]), {
      name: "Tersembunyi",
      email,
      password,
      roles: ["TEACHER"],
    });

    const listA = await listManagedUsers(ctxFor(instA, ["ADMIN"]));
    const listB = await listManagedUsers(ctxFor(instB, ["ADMIN"]));

    assert.ok(listA.some((u) => u.email === email), "lembaga pemilik melihat akunnya");
    assert.ok(
      !listB.some((u) => u.email === email),
      "lembaga lain TIDAK melihat akun tersebut"
    );
  });
});
