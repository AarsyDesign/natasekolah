import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TenantContext } from "../src/lib/tenant/context";
import {
  listAuditLog,
  getAuditLogFacets,
  buildAuditLogWhere,
} from "../src/lib/audit/audit-query";
import {
  validateAuditLogFilter,
  auditLogFilterSchema,
  AUDIT_PAGE_SIZE_MAX,
} from "../src/lib/validation/audit";
import { ValidationError } from "../src/lib/validation/common";
import { AuthorizationError } from "../src/lib/auth/permissions";

// ---------------------------------------------------------------------------
// Konteks & fake repository (listAuditLog menerima `tx` — tanpa DB nyata)
// ---------------------------------------------------------------------------

const instAId = "inst_audit_a";
const instBId = "inst_audit_b";

const superAdmin: TenantContext = {
  userId: "usr_super",
  institutionId: instAId,
  roles: ["SUPER_ADMIN"],
  permissions: ["institution:view", "institution:manage"],
  isSuperAdmin: true,
};

const principalA: TenantContext = {
  userId: "usr_principal",
  institutionId: instAId,
  roles: ["PRINCIPAL"],
  permissions: ["institution:view"],
  isSuperAdmin: false,
};

/** Guru tidak punya `institution:view` (alias legacy `audit:read`). */
const teacherA: TenantContext = {
  userId: "usr_teacher",
  institutionId: instAId,
  roles: ["TEACHER"],
  permissions: ["attendance:view", "student:view"],
  isSuperAdmin: false,
};

const waliCtx = {
  userId: undefined,
  guardianId: "gd_1",
  institutionId: instAId,
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  subjectType: "GUARDIAN",
} as unknown as TenantContext;

interface FakeRow {
  id: string;
  institutionId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: Date;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
}

function makeRows(): FakeRow[] {
  const t = (iso: string) => new Date(iso);
  return [
    {
      id: "log_1",
      institutionId: instAId,
      action: "CREATE",
      entityType: "Student",
      entityId: "stu_1",
      detailsJson: JSON.stringify({ fullName: "Ahmad" }),
      ipAddress: "10.0.0.1",
      createdAt: t("2026-10-02T10:00:00.000Z"),
      userId: "usr_admin",
      user: { id: "usr_admin", name: "Admin A", email: "a@x.id" },
    },
    {
      id: "log_2",
      institutionId: instAId,
      action: "UPDATE",
      entityType: "Guardian",
      entityId: "gd_1",
      detailsJson: "{bukan-json-valid",
      ipAddress: null,
      createdAt: t("2026-10-01T08:00:00.000Z"),
      userId: null,
      user: null,
    },
    {
      id: "log_3",
      institutionId: instAId,
      action: "DELETE",
      entityType: "Question",
      entityId: "q_1",
      detailsJson: JSON.stringify(["array", "bukan", "objek"]),
      ipAddress: "10.0.0.2",
      createdAt: t("2026-09-30T08:00:00.000Z"),
      userId: "usr_admin",
      user: { id: "usr_admin", name: "Admin A", email: "a@x.id" },
    },
    // Baris milik lembaga LAIN — wajib tidak pernah terbaca oleh ctx instA.
    {
      id: "log_x",
      institutionId: instBId,
      action: "CREATE",
      entityType: "Student",
      entityId: "stu_x",
      detailsJson: null,
      ipAddress: null,
      createdAt: t("2026-10-02T11:00:00.000Z"),
      userId: "usr_other",
      user: { id: "usr_other", name: "Admin B", email: "b@x.id" },
    },
  ];
}

/** Cocokkan where-clause AND sederhana yang dibangun `buildAuditLogWhere`. */
function matchesWhere(row: FakeRow, where: any): boolean {
  const clauses = where?.AND ?? [];
  return clauses.every((c: any) => {
    if (c.institutionId) return row.institutionId === c.institutionId;
    if (c.action) return row.action === c.action;
    if (c.entityType) return row.entityType === c.entityType;
    if (c.entityId) return row.entityId === c.entityId;
    if (c.userId) return row.userId === c.userId;
    if (c.createdAt) {
      if (c.createdAt.gte && !(row.createdAt >= c.createdAt.gte)) return false;
      if (c.createdAt.lte && !(row.createdAt <= c.createdAt.lte)) return false;
      return true;
    }
    return false;
  });
}

function makeFakeTx(rows: FakeRow[]) {
  return {
    auditLog: {
      count: async ({ where }: any) => rows.filter((r) => matchesWhere(r, where)).length,
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        const filtered = rows
          .filter((r) => matchesWhere(r, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return filtered.slice(skip, skip + take).map((r) => ({
          id: r.id,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          detailsJson: r.detailsJson,
          ipAddress: r.ipAddress,
          createdAt: r.createdAt,
          user: r.user,
        }));
      },
      findManyDistinct: async () => [],
    },
  };
}

/** Fake tx untuk facets (distinct query). */
function makeFacetTx(actions: string[], entityTypes: string[]) {
  return {
    auditLog: {
      findMany: async (args: any) => {
        if (args?.distinct?.includes("action")) {
          return actions.map((a) => ({ action: a }));
        }
        return entityTypes.map((t) => ({ entityType: t }));
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Phase 12.3 — AuditLog Query API + UI Filter Tests", () => {
  describe("1. Validasi filter (Zod)", () => {
    it("default: page=1, pageSize=20", () => {
      const f = validateAuditLogFilter(undefined);
      assert.equal(f.page, 1);
      assert.equal(f.pageSize, 20);
    });

    it("menerima filter lengkap dengan rentang tanggal valid", () => {
      const f = validateAuditLogFilter({
        action: "CREATE",
        entityType: "Student",
        from: "2026-10-01",
        to: "2026-10-02",
        page: "3",
        pageSize: "50",
      });
      assert.equal(f.action, "CREATE");
      assert.equal(f.page, 3);
      assert.equal(f.pageSize, 50);
    });

    it("menolak `from` setelah `to`", () => {
      assert.throws(
        () => validateAuditLogFilter({ from: "2026-10-05", to: "2026-10-01" }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("menolak format tanggal salah", () => {
      assert.throws(
        () => validateAuditLogFilter({ from: "05/10/2026" }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it(`menolak pageSize > ${AUDIT_PAGE_SIZE_MAX}`, () => {
      assert.throws(
        () => validateAuditLogFilter({ pageSize: AUDIT_PAGE_SIZE_MAX + 1 }),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateAuditLogFilter({ pageSize: 0 }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("menolak key tak dikenal (skema strict)", () => {
      assert.throws(
        () => validateAuditLogFilter({ institutionId: instBId }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("menolak aksi/entitas terlalu panjang", () => {
      assert.throws(
        () => validateAuditLogFilter({ action: "X".repeat(65) }),
        (err: unknown) => err instanceof ValidationError
      );
      assert.throws(
        () => validateAuditLogFilter({ entityType: "X".repeat(65) }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("skema diekspor dari registry validasi pusat", () => {
      assert.ok(auditLogFilterSchema);
    });
  });

  describe("2. Where-clause & tenant boundary", () => {
    it("institutionId SELALU ditanam (bukan dari klien)", () => {
      const where = buildAuditLogWhere(instAId, validateAuditLogFilter({}));
      assert.equal((where.AND as any[])[0].institutionId, instAId);
    });

    it("filter aksi/entitas/pelaku ikut terpasang", () => {
      const where = buildAuditLogWhere(
        instAId,
        validateAuditLogFilter({ action: "CREATE", entityType: "Student", userId: "usr_1" })
      );
      const and = where.AND as any[];
      assert.ok(and.some((c) => c.action === "CREATE"));
      assert.ok(and.some((c) => c.entityType === "Student"));
      assert.ok(and.some((c) => c.userId === "usr_1"));
    });

    it("`to` inklusif sampai akhir hari", () => {
      const where = buildAuditLogWhere(
        instAId,
        validateAuditLogFilter({ to: "2026-10-02" })
      );
      const range = (where.AND as any[]).find((c) => c.createdAt)?.createdAt;
      assert.ok(range.lte instanceof Date);
      assert.equal(
        (range.lte as Date).toISOString(),
        "2026-10-02T23:59:59.999Z"
      );
    });

    it("tanpa filter tanggal → tidak ada clausa createdAt", () => {
      const where = buildAuditLogWhere(instAId, validateAuditLogFilter({}));
      assert.ok(!(where.AND as any[]).some((c) => c.createdAt));
    });
  });

  describe("3. RBAC (guard institution:view)", () => {
    it("SUPER_ADMIN diperbolehkan", async () => {
      const page = await listAuditLog(superAdmin, {}, makeFakeTx(makeRows()));
      assert.equal(page.total, 3); // baris lembaga B tidak ikut
      assert.equal(page.items.length, 3);
    });

    it("PRINCIPAL (institution:view) diperbolehkan", async () => {
      const page = await listAuditLog(principalA, {}, makeFakeTx(makeRows()));
      assert.equal(page.total, 3);
    });

    it("TEACHER tanpa institution:view DITOLAK 403", async () => {
      await assert.rejects(
        () => listAuditLog(teacherA, {}, makeFakeTx(makeRows())),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("sesi wali murid (GUARDIAN) DITOLAK", async () => {
      await assert.rejects(
        () => listAuditLog(waliCtx, {}, makeFakeTx(makeRows())),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("facets juga terguard", async () => {
      await assert.rejects(
        () => getAuditLogFacets(teacherA, makeFacetTx([], [])),
        (err: unknown) => err instanceof AuthorizationError
      );
    });
  });

  describe("4. Isolasi lintas lembaga & bentuk data", () => {
    it("baris lembaga lain tidak pernah terbaca", async () => {
      const page = await listAuditLog(superAdmin, {}, makeFakeTx(makeRows()));
      const ids = page.items.map((i) => i.id);
      assert.ok(!ids.includes("log_x"), "baris lembaga B tidak boleh bocor");
      assert.equal(page.total, 3);
    });

    it("detailsJson bukan JSON valid → null (raw string tidak bocor)", async () => {
      const page = await listAuditLog(superAdmin, {}, makeFakeTx(makeRows()));
      const broken = page.items.find((i) => i.id === "log_2");
      assert.ok(broken);
      assert.equal(broken.details, null);
    });

    it("detailsJson berupa array → null (hanya objek yang diteruskan)", async () => {
      const page = await listAuditLog(superAdmin, {}, makeFakeTx(makeRows()));
      const arr = page.items.find((i) => i.id === "log_3");
      assert.ok(arr);
      assert.equal(arr.details, null);
    });

    it("pelaku NULL dilaporkan sebagai actor null (UI menampilkan 'Sistem')", async () => {
      const page = await listAuditLog(superAdmin, {}, makeFakeTx(makeRows()));
      const system = page.items.find((i) => i.id === "log_2");
      assert.ok(system);
      assert.equal(system.actor, null);
    });

    it("urutan terbaru dahulu + paginasi benar", async () => {
      const page = await listAuditLog(
        superAdmin,
        { page: 1, pageSize: 10 },
        makeFakeTx(makeRows())
      );
      const times = page.items.map((i) => i.createdAt.getTime());
      assert.deepEqual(times, [...times].sort((a, b) => b - a));
      assert.equal(page.totalPages, 1);
      assert.equal(page.page, 1);
      assert.equal(page.pageSize, 10);
    });

    it("filter aksi bekerja pada query", async () => {
      const page = await listAuditLog(
        superAdmin,
        { action: "CREATE" },
        makeFakeTx(makeRows())
      );
      assert.equal(page.total, 1);
      assert.equal(page.items[0].action, "CREATE");
    });

    it("filter rentang tanggal bekerja", async () => {
      const page = await listAuditLog(
        superAdmin,
        { from: "2026-10-02", to: "2026-10-02" },
        makeFakeTx(makeRows())
      );
      assert.equal(page.total, 1);
      assert.equal(page.items[0].id, "log_1");
    });
  });

  describe("5. Facets (opsi dropdown UI)", () => {
    it("mengembalikan aksi & entitas unik", async () => {
      const facets = await getAuditLogFacets(
        principalA,
        makeFacetTx(["CREATE", "UPDATE"], ["Student", "Guardian"])
      );
      assert.deepEqual(facets.actions, ["CREATE", "UPDATE"]);
      assert.deepEqual(facets.entityTypes, ["Student", "Guardian"]);
    });
  });
});
