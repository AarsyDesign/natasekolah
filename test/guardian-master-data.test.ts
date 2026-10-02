import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  listGuardians,
  updateGuardianProfile,
  deactivateGuardian,
  issueGuardianInvitation,
  GuardianInactiveError,
} from "../src/lib/guardian/master-data-service";
import { INVITATION_LIFETIME_MS } from "../src/lib/auth/guardian";
import { ResourceNotFoundError } from "../src/lib/academic/types";
import { ValidationError } from "../src/lib/validation/common";
import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  isValidPermission,
} from "../src/lib/auth/permissions";

describe("Phase 9 — Guardian Master Data CRUD Staf + Wizard Undangan Tests", () => {
  const instAId = "inst_nusantara_a";
  const instBId = "inst_nusantara_b";

  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: ["guardian:view", "guardian:manage", "student:view"],
    isSuperAdmin: false,
  };

  const principalA: TenantContext = {
    userId: "usr_principal_a",
    institutionId: instAId,
    roles: ["PRINCIPAL"],
    permissions: ["guardian:view"],
    isSuperAdmin: false,
  };

  const teacherA: TenantContext = {
    userId: "usr_musrif_a",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "student:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: ["guardian:view", "guardian:manage"],
    isSuperAdmin: false,
  };

  const guardianCtx: TenantContext = {
    userId: undefined,
    guardianId: "gd_1",
    institutionId: instAId,
    roles: [],
    permissions: [],
    isSuperAdmin: false,
    subjectType: "GUARDIAN",
  } as unknown as TenantContext;

  // ---- In-memory data stores ----
  let inMemoryGuardians: any[] = [];
  let inMemoryLinks: any[] = [];
  let inMemoryInvitations: any[] = [];
  let inMemoryAuditLogs: any[] = [];
  let invitationAutoId = 1;

  beforeEach(() => {
    invitationAutoId = 1;
    inMemoryAuditLogs = [];

    inMemoryGuardians = [
      {
        id: "gd_1",
        institutionId: instAId,
        fullName: "Bapak Tsabit",
        phoneWa: "081234567891",
        email: "tsabit@example.com",
        status: "ACTIVE",
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: "gd_2",
        institutionId: instAId,
        fullName: "Ibu Fatimah",
        phoneWa: "081299988877",
        email: null,
        status: "INVITED",
        createdAt: new Date("2026-09-02"),
        updatedAt: new Date("2026-09-02"),
      },
      {
        id: "gd_3",
        institutionId: instAId,
        fullName: "Wali Nonaktif",
        phoneWa: "081200011122",
        email: null,
        status: "INACTIVE",
        createdAt: new Date("2026-09-03"),
        updatedAt: new Date("2026-09-03"),
      },
      {
        id: "gd_4",
        institutionId: instBId,
        fullName: "Guardian Lembaga B",
        phoneWa: "081255566677",
        email: null,
        status: "ACTIVE",
        createdAt: new Date("2026-09-04"),
        updatedAt: new Date("2026-09-04"),
      },
    ];

    inMemoryLinks = [
      {
        id: "gs_1",
        institutionId: instAId,
        guardianId: "gd_1",
        studentId: "std_1",
        relationship: "AYAH",
        isPrimary: true,
        student: { id: "std_1", fullName: "Zaid bin Tsabit", nis: "1001", status: "ACTIVE" },
      },
    ];

    inMemoryInvitations = [
      {
        id: "inv_pending",
        tokenHash: createHash("sha256").update("token-lama-mentah").digest("hex"),
        guardianId: "gd_2",
        institutionId: instAId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        redeemedAt: null,
        sentVia: "WHATSAPP",
        createdById: "usr_admin_a",
        createdAt: new Date(),
      },
    ];

    // ---- Mock prisma.guardian ----
    const attachGuardianIncludes = (g: any, include?: any) => {
      if (!g) return null;
      const result = { ...g };
      if (include?.students) {
        result.students = inMemoryLinks
          .filter((l) => l.guardianId === g.id && l.institutionId === g.institutionId)
          .map((l) => ({ ...l }));
      }
      if (include?.invitations) {
        const sel = include.invitations;
        result.invitations = inMemoryInvitations
          .filter(
            (inv) =>
              inv.guardianId === g.id &&
              inv.redeemedAt === null &&
              inv.expiresAt.getTime() > Date.now()
          )
          .map((inv) => ({
            id: inv.id,
            expiresAt: inv.expiresAt,
            sentVia: inv.sentVia,
          }));
        void sel;
      }
      return result;
    };

    (prisma.guardian as any).findUnique = async ({ where, include, select }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const g = inMemoryGuardians.find(
        (x) => x.id === id && (!instId || x.institutionId === instId)
      );
      if (!g) return null;
      if (select) {
        const picked: any = {};
        for (const key of Object.keys(select)) {
          if (select[key]) picked[key] = (g as any)[key];
        }
        return picked;
      }
      return attachGuardianIncludes(g, include);
    };

    (prisma.guardian as any).findMany = async ({ where, include }: any) => {
      const results = inMemoryGuardians.filter((g) => {
        if (where?.institutionId && g.institutionId !== where.institutionId) return false;
        if (where?.status && g.status !== where.status) return false;
        if (where?.OR) {
          const match = where.OR.some((cond: any) => {
            if (cond.fullName?.contains) {
              return g.fullName.toLowerCase().includes(String(cond.fullName.contains).toLowerCase());
            }
            if (cond.phoneWa?.contains) {
              return g.phoneWa.includes(String(cond.phoneWa.contains));
            }
            if (cond.email?.contains) {
              return (g.email || "").toLowerCase().includes(String(cond.email.contains).toLowerCase());
            }
            return false;
          });
          if (!match) return false;
        }
        return true;
      });
      return results.map((g) => attachGuardianIncludes(g, include));
    };

    (prisma.guardian as any).update = async ({ where, data }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const g = inMemoryGuardians.find(
        (x) => x.id === id && (!instId || x.institutionId === instId)
      );
      if (!g) throw new Error("P2025: Record not found");
      Object.assign(g, data, { updatedAt: new Date() });
      return { ...g };
    };

    // ---- Mock prisma.guardianInvitation ----
    (prisma.guardianInvitation as any).deleteMany = async ({ where }: any) => {
      const before = inMemoryInvitations.length;
      inMemoryInvitations = inMemoryInvitations.filter((inv) => {
        // deleteMany: hanya baris COCOK yang dihapus, sisanya dipertahankan
        if (where?.guardianId && inv.guardianId !== where.guardianId) return true;
        if (where?.institutionId && inv.institutionId !== where.institutionId) return true;
        if (where?.redeemedAt === null && inv.redeemedAt !== null) return true;
        return false;
      });
      return { count: before - inMemoryInvitations.length };
    };

    (prisma.guardianInvitation as any).create = async ({ data }: any) => {
      const row = {
        id: `inv_${invitationAutoId++}`,
        redeemedAt: null,
        createdAt: new Date(),
        ...data,
      };
      inMemoryInvitations.push(row);
      return { ...row };
    };

    // ---- Mock prisma.auditLog ----
    (prisma.auditLog as any).create = async ({ data }: any) => {
      const row = { id: `aud_${inMemoryAuditLogs.length + 1}`, ...data, createdAt: new Date() };
      inMemoryAuditLogs.push(row);
      return row;
    };
  });

  // -------------------------------------------------------------------------
  describe("1. Listing, Pencarian & Filter", () => {
    it("listGuardians mengembalikan wali lembaga A saja lengkap dengan relasi anak & undangan aktif", async () => {
      const guardians = await runWithTenantContext(adminA, () => listGuardians(adminA));

      assert.equal(guardians.length, 3, "lembaga A punya 3 wali, wali lembaga B tidak bocor");
      assert(
        guardians.every((g: any) => g.institutionId === instAId),
        "tenant isolation"
      );

      const father = guardians.find((g: any) => g.id === "gd_1");
      assert.equal(father.students.length, 1);
      assert.equal(father.students[0].student.fullName, "Zaid bin Tsabit");
      assert.equal(father.students[0].relationship, "AYAH");

      const invited = guardians.find((g: any) => g.id === "gd_2");
      assert.equal(invited.invitations.length, 1, "undangan belum kedaluwarsa & belum ditebus tampil");
    });

    it("filter status mempersempit hasil", async () => {
      const invited = await runWithTenantContext(adminA, () =>
        listGuardians(adminA, { status: "INVITED" })
      );
      assert.equal(invited.length, 1);
      assert.equal(invited[0].id, "gd_2");

      const active = await runWithTenantContext(adminA, () =>
        listGuardians(adminA, { status: "ACTIVE" })
      );
      assert.equal(active.length, 1);
      assert.equal(active[0].id, "gd_1");
    });

    it("pencarian q cocok nama (case-insensitive) dan nomor telepon", async () => {
      const byName = await runWithTenantContext(adminA, () =>
        listGuardians(adminA, { q: "fatimah" })
      );
      assert.equal(byName.length, 1);
      assert.equal(byName[0].id, "gd_2");

      const byPhone = await runWithTenantContext(adminA, () =>
        listGuardians(adminA, { q: "081234567891" })
      );
      assert.equal(byPhone.length, 1);
      assert.equal(byPhone[0].id, "gd_1");
    });

    it("filter status tidak valid ditolak Zod", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminA, () => listGuardians(adminA, { status: "MELEDAK" })),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("guru tanpa guardian:view ditolak; sesi wali ditolak total", async () => {
      await assert.rejects(
        () => runWithTenantContext(teacherA, () => listGuardians(teacherA)),
        (err: unknown) => err instanceof AuthorizationError
      );
      await assert.rejects(
        () => runWithTenantContext(guardianCtx, () => listGuardians(guardianCtx)),
        (err: unknown) => err instanceof AuthorizationError
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("2. Update Profil", () => {
    it("memperbarui nama, WA, dan email + menulis AuditLog UPDATE", async () => {
      const updated = await runWithTenantContext(adminA, () =>
        updateGuardianProfile(adminA, {
          guardianId: "gd_1",
          fullName: "Bapak Tsabit (Baru)",
          phoneWa: "081200022233",
          email: "",
        })
      );

      assert.equal(updated.fullName, "Bapak Tsabit (Baru)");
      assert.equal(updated.phoneWa, "081200022233");
      assert.equal(updated.email, null, 'email "" membersihkan email');

      const audit = inMemoryAuditLogs.find((a) => a.entityId === "gd_1");
      assert(audit, "AuditLog UPDATE tertulis");
      assert.equal(audit.action, "UPDATE");
      assert.equal(audit.entityType, "Guardian");
      const details = JSON.parse(audit.detailsJson);
      assert.deepEqual(details.changes.sort(), ["email", "fullName", "phoneWa"]);
    });

    it("pembaruan lintas lembaga ditolak 404", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminB, () =>
            updateGuardianProfile(adminB, { guardianId: "gd_1", fullName: "Hacked" })
          ),
        (err: unknown) => err instanceof ResourceNotFoundError
      );
      assert.equal(inMemoryGuardians.find((g) => g.id === "gd_1")!.fullName, "Bapak Tsabit");
    });

    it("payload tanpa bidang yang diubah ditolak Zod", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminA, () => updateGuardianProfile(adminA, { guardianId: "gd_1" })),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("status tidak valid ditolak Zod", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            updateGuardianProfile(adminA, { guardianId: "gd_1", status: "DISETUJUI" })
          ),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("PRINCIPAL (hanya guardian:view) tidak bisa mengubah profil", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(principalA, () =>
            updateGuardianProfile(principalA, { guardianId: "gd_1", fullName: "Boleh?" })
          ),
        (err: unknown) => err instanceof AuthorizationError
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("3. Penonaktifan", () => {
    it("menonaktifkan wali: status INACTIVE + undangan belum ditebus dicabut + AuditLog", async () => {
      const result = await runWithTenantContext(adminA, () =>
        deactivateGuardian(adminA, { guardianId: "gd_2", reason: "Wali pindah" })
      );

      assert.equal(result.status, "INACTIVE");
      assert.equal(result.revokedInvitations, 1, "undangan pending milik gd_2 dicabut");
      assert.equal(inMemoryInvitations.length, 0, "token lama mati di DB");

      const audit = inMemoryAuditLogs.find((a) => a.entityId === "gd_2");
      assert(audit, "AuditLog tertulis");
      const details = JSON.parse(audit.detailsJson);
      assert.equal(details.previousStatus, "INVITED");
      assert.equal(details.revokedInvitations, 1);
      assert.equal(details.reason, "Wali pindah");
    });

    it("penonaktifan lintas lembaga ditolak 404", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminB, () => deactivateGuardian(adminB, { guardianId: "gd_1" })),
        (err: unknown) => err instanceof ResourceNotFoundError
      );
      assert.equal(inMemoryGuardians.find((g) => g.id === "gd_1")!.status, "ACTIVE");
    });

    it("guru tanpa guardian:manage tidak bisa menonaktifkan", async () => {
      await assert.rejects(
        () => runWithTenantContext(teacherA, () => deactivateGuardian(teacherA, { guardianId: "gd_1" })),
        (err: unknown) => err instanceof AuthorizationError
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("4. Wizard Undangan Aktivasi (72 jam, 1x pakai)", () => {
    it("menerbitkan token 64 hex; DB hanya menyimpan hash SHA-256 (bukan token mentah)", async () => {
      const result = await runWithTenantContext(adminA, () =>
        issueGuardianInvitation(adminA, { guardianId: "gd_1", sentVia: "MANUAL" })
      );

      assert.match(result.rawToken, /^[0-9a-f]{64}$/, "token 256-bit hex");
      assert.equal(result.activationPath, `/wali/aktivasi?token=${result.rawToken}`);

      const stored = inMemoryInvitations.find((inv) => inv.id === result.invitationId);
      assert(stored, "baris undangan tersimpan");
      assert.notEqual(stored.tokenHash, result.rawToken, "hash ≠ token mentah");
      assert.equal(
        stored.tokenHash,
        createHash("sha256").update(result.rawToken).digest("hex")
      );

      const delta = stored.expiresAt.getTime() - Date.now();
      assert.ok(
        Math.abs(delta - INVITATION_LIFETIME_MS) < 5000,
        "berlaku 72 jam dari sekarang"
      );
      assert.equal(stored.sentVia, "MANUAL");
    });

    it("AuditLog CREATE mencatat jejak undangan TANPA token mentah", async () => {
      const result = await runWithTenantContext(adminA, () =>
        issueGuardianInvitation(adminA, { guardianId: "gd_1" })
      );

      const audit = inMemoryAuditLogs.find((a) => a.entityId === "gd_1");
      assert(audit, "AuditLog tertulis");
      assert.equal(audit.action, "CREATE");
      assert(!audit.detailsJson.includes(result.rawToken), "token mentah tidak bocor ke audit");
      const details = JSON.parse(audit.detailsJson);
      assert.equal(details.invitationId, result.invitationId);
      assert.equal(details.sentVia, "WHATSAPP");
    });

    it("menerbitkan undangan baru mencabut token lama yang belum ditebus", async () => {
      const first = await runWithTenantContext(adminA, () =>
        issueGuardianInvitation(adminA, { guardianId: "gd_2" })
      );
      const second = await runWithTenantContext(adminA, () =>
        issueGuardianInvitation(adminA, { guardianId: "gd_2" })
      );

      assert.notEqual(first.rawToken, second.rawToken);
      const rows = inMemoryInvitations.filter((inv) => inv.guardianId === "gd_2");
      assert.equal(rows.length, 1, "hanya 1 undangan aktif per wali");
      assert.equal(rows[0].id, second.invitationId, "token lama terhapus, token baru tersimpan");
    });

    it("wali INACTIVE ditolak dengan GuardianInactiveError", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminA, () => issueGuardianInvitation(adminA, { guardianId: "gd_3" })),
        (err: unknown) => err instanceof GuardianInactiveError
      );
      assert.equal(inMemoryInvitations.filter((i) => i.guardianId === "gd_3").length, 0);
    });

    it("undangan untuk wali lembaga lain ditolak 404", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminB, () => issueGuardianInvitation(adminB, { guardianId: "gd_1" })),
        (err: unknown) => err instanceof ResourceNotFoundError
      );
    });

    it("kanal undangan tidak valid ditolak Zod", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            issueGuardianInvitation(adminA, { guardianId: "gd_1", sentVia: "FAX" })
          ),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("guru tidak bisa menerbitkan undangan (RBAC)", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(teacherA, () =>
            issueGuardianInvitation(teacherA, { guardianId: "gd_1" })
          ),
        (err: unknown) => err instanceof AuthorizationError
      );
    });
  });

  // -------------------------------------------------------------------------
  describe("5. Matriks RBAC Guardian Domain", () => {
    it("guardian:view & guardian:manage terdaftar sebagai izin resmi", () => {
      assert.equal(isValidPermission("guardian:view"), true);
      assert.equal(isValidPermission("guardian:manage"), true);
    });

    it("guardian:manage hanya untuk SUPER_ADMIN & ADMIN; view untuk 4 peran pimpinan/admin", () => {
      for (const role of ["SUPER_ADMIN", "ADMIN"] as const) {
        assert(ROLE_PERMISSIONS[role].includes("guardian:manage"), `${role} harus bisa manage`);
        assert(ROLE_PERMISSIONS[role].includes("guardian:view"), `${role} harus bisa view`);
      }
      for (const role of ["FOUNDATION_HEAD", "PRINCIPAL"] as const) {
        assert(ROLE_PERMISSIONS[role].includes("guardian:view"), `${role} harus bisa view`);
        assert(!ROLE_PERMISSIONS[role].includes("guardian:manage"), `${role} tidak boleh manage`);
      }
      for (const role of ["TEACHER", "FINANCE_STAFF"] as const) {
        assert(!ROLE_PERMISSIONS[role].includes("guardian:view"), `${role} tanpa view`);
        assert(!ROLE_PERMISSIONS[role].includes("guardian:manage"), `${role} tanpa manage`);
      }
    });
  });
});
