import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  createPermitRequest,
  approvePermitRequest,
  rejectPermitRequest,
  markPermitReturned,
  markPermitOverdue,
  listPermitRequests,
  getPermitRequestById,
} from "../src/lib/permit";
import {
  PermitNotFoundError,
  PermitStudentNotInDormitoryError,
  ActivePermitExistsError,
  PermitInvalidTransitionError,
  NoActiveAcademicYearError,
  PermitNotYetOverdueError,
  PERMIT_TRANSITIONS,
  isValidPermitTransition,
} from "../src/lib/permit/types";
import { ResourceNotFoundError } from "../src/lib/academic/types";
import { ValidationError } from "../src/lib/validation/common";
import {
  AuthorizationError,
  ROLE_PERMISSIONS,
  isValidPermission,
} from "../src/lib/auth/permissions";
import { renderNotificationMessage } from "../src/lib/notification/templates";
import { NOTIFICATION_TEMPLATE_KEYS } from "../src/lib/validation/notification";

describe("Phase 9 — Tasrih / Permit Engine Tests", () => {
  const instAId = "inst_pesantren_al_hikmah";
  const instBId = "inst_pesantren_darussalam";

  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: [
      "pesantren:view",
      "pesantren:manage",
      "dormitory:view",
      "dormitory:manage",
    ],
    isSuperAdmin: false,
  };

  const teacherA: TenantContext = {
    userId: "usr_musrif_a",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "dormitory:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: ["pesantren:view", "pesantren:manage", "dormitory:view"],
    isSuperAdmin: false,
  };

  const guardianCtx: TenantContext = {
    userId: undefined,
    guardianId: "gdw_1",
    institutionId: instAId,
    roles: [],
    permissions: [],
    isSuperAdmin: false,
    subjectType: "GUARDIAN",
  } as unknown as TenantContext;

  // In-Memory Data Stores
  let inMemoryPermits: any[] = [];
  let inMemoryStudents: any[] = [];
  let inMemoryAssignments: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryAuditLogs: any[] = [];
  let inMemoryOutbox: any[] = [];

  let permitAutoId = 1;

  const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
  const inTwoDays = () => new Date(Date.now() + 48 * 60 * 60 * 1000);
  const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeEach(() => {
    permitAutoId = 1;
    inMemoryPermits = [];
    inMemoryAuditLogs = [];
    inMemoryOutbox = [];

    inMemoryStudents = [
      {
        id: "std_santri_1",
        institutionId: instAId,
        nis: "1001",
        fullName: "Zaid bin Tsabit",
        gender: "L",
        status: "ACTIVE",
        parentWaPhone: "081234567890",
        guardians: [
          {
            isPrimary: true,
            createdAt: new Date(),
            guardian: { fullName: "Bapak Tsabit", phoneWa: "081234567891" },
          },
        ],
      },
      {
        id: "std_non_dorm",
        institutionId: instAId,
        nis: "1002",
        fullName: "Anas bin Malik",
        gender: "L",
        status: "ACTIVE",
        guardians: [],
      },
      {
        id: "std_santri_b",
        institutionId: instBId,
        nis: "9001",
        fullName: "Santri Luar B",
        gender: "L",
        status: "ACTIVE",
        guardians: [],
      },
    ];

    inMemoryAssignments = [
      {
        id: "sda_1",
        institutionId: instAId,
        studentId: "std_santri_1",
        roomId: "room_1",
        status: "ACTIVE",
      },
      {
        id: "sda_b",
        institutionId: instBId,
        studentId: "std_santri_b",
        roomId: "room_b",
        status: "ACTIVE",
      },
    ];

    inMemoryAcademicYears = [
      {
        id: "ay_2026a",
        institutionId: instAId,
        name: "2025/2026",
        isActive: true,
      },
      {
        id: "ay_2026b",
        institutionId: instBId,
        name: "2025/2026",
        isActive: true,
      },
    ];

    // ---- Mock prisma.permitRequest ----
    const attachIncludes = (permit: any, include?: any) => {
      if (!permit) return null;
      const result = { ...permit };
      if (include?.student) {
        result.student = inMemoryStudents.find((s) => s.id === permit.studentId) || null;
      }
      if (include?.academicYear) {
        result.academicYear =
          inMemoryAcademicYears.find((y) => y.id === permit.academicYearId) || null;
      }
      if (include?.approvedBy) {
        result.approvedBy = permit.approvedById
          ? { id: permit.approvedById, name: permit.approvedById === "usr_admin_a" ? "Admin A" : "Staf" }
          : null;
      }
      return result;
    };

    (prisma.permitRequest as any).findUnique = async ({ where, include }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const permit = inMemoryPermits.find(
        (p) => p.id === id && (!instId || p.institutionId === instId)
      );
      return attachIncludes(permit, include);
    };

    (prisma.permitRequest as any).findFirst = async ({ where, include }: any) => {
      const permit = inMemoryPermits.find((p) => {
        if (where?.institutionId && p.institutionId !== where.institutionId) return false;
        if (where?.studentId && p.studentId !== where.studentId) return false;
        if (where?.status?.in && !where.status.in.includes(p.status)) return false;
        if (typeof where?.status === "string" && p.status !== where.status) return false;
        return true;
      });
      return attachIncludes(permit, include);
    };

    (prisma.permitRequest as any).findMany = async ({ where, include }: any) => {
      const results = inMemoryPermits.filter((p) => {
        if (where?.institutionId && p.institutionId !== where.institutionId) return false;
        if (where?.status && p.status !== where.status) return false;
        if (where?.type && p.type !== where.type) return false;
        if (where?.studentId && p.studentId !== where.studentId) return false;
        return true;
      });
      return results.map((p) => attachIncludes(p, include));
    };

    (prisma.permitRequest as any).create = async ({ data, include }: any) => {
      const permit = {
        id: `permit_${permitAutoId++}`,
        ...data,
        approvedById: null,
        approvedAt: null,
        decidedAt: null,
        returnedAt: null,
        notes: null,
        requestedAt: data.requestedAt ?? new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryPermits.push(permit);
      return attachIncludes(permit, include);
    };

    (prisma.permitRequest as any).update = async ({ where, data, include }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const permit = inMemoryPermits.find(
        (p) => p.id === id && (!instId || p.institutionId === instId)
      );
      if (!permit) throw new Error("P2025: Record not found");
      Object.assign(permit, data, { updatedAt: new Date() });
      return attachIncludes(permit, include);
    };

    // ---- Mock prisma.student ----
    (prisma.student as any).findUnique = async ({ where, include }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const student = inMemoryStudents.find(
        (s) => s.id === id && (!instId || s.institutionId === instId)
      );
      if (!student) return null;
      const result: any = { ...student };
      if (include?.guardians) {
        result.guardians = (student.guardians || []).map((rel: any) => ({
          ...rel,
          institutionId: student.institutionId,
          guardian: rel.guardian,
        }));
      }
      return result;
    };

    // ---- Mock prisma.studentDormitoryAssignment ----
    (prisma.studentDormitoryAssignment as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAssignments.find((a) => {
          if (where?.institutionId && a.institutionId !== where.institutionId) return false;
          if (where?.studentId && a.studentId !== where.studentId) return false;
          if (where?.status && a.status !== where.status) return false;
          return true;
        }) || null
      );
    };

    // ---- Mock prisma.academicYear ----
    (prisma.academicYear as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      return (
        inMemoryAcademicYears.find(
          (y) => y.id === id && (!instId || y.institutionId === instId)
        ) || null
      );
    };

    (prisma.academicYear as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAcademicYears.find((y) => {
          if (where?.institutionId && y.institutionId !== where.institutionId) return false;
          if (typeof where?.isActive === "boolean" && y.isActive !== where.isActive) return false;
          return true;
        }) || null
      );
    };

    // ---- Mock prisma.auditLog ----
    (prisma.auditLog as any).create = async ({ data }: any) => {
      const row = { id: `aud_${inMemoryAuditLogs.length + 1}`, ...data, createdAt: new Date() };
      inMemoryAuditLogs.push(row);
      return row;
    };

    // ---- Mock prisma.notificationOutbox ----
    (prisma.notificationOutbox as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryOutbox.find((n) => {
          if (where?.id && n.id !== where.id) return false;
          if (where?.institutionId && n.institutionId !== where.institutionId) return false;
          return true;
        }) || null
      );
    };

    (prisma.notificationOutbox as any).create = async ({ data }: any) => {
      const row = { ...data, createdAt: new Date() };
      inMemoryOutbox.push(row);
      return row;
    };
  });

  // -------------------------------------------------------------------------
  describe("1. Skema & Lifecycle", () => {
    it("membuat permohonan izin PENDING dengan audit log CREATE", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
          returnAt: inTwoDays().toISOString(),
          reason: "Pulang menengok orang tua",
        })
      );

      assert.equal(permit.status, "PENDING");
      assert.equal(permit.studentId, "std_santri_1");
      assert.equal(permit.institutionId, instAId);
      assert.equal(permit.academicYearId, "ay_2026a", "memakai tahun ajaran aktif");
      assert.equal(permit.student.fullName, "Zaid bin Tsabit");

      const audit = inMemoryAuditLogs.find((a) => a.entityId === permit.id);
      assert(audit, "AuditLog CREATE harus tertulis");
      assert.equal(audit.action, "CREATE");
      assert.equal(audit.entityType, "PermitRequest");
    });

    it("menolak izin santri tanpa penempatan asrama aktif", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            createPermitRequest(adminA, {
              studentId: "std_non_dorm",
              type: "HOME_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof PermitStudentNotInDormitoryError
      );
    });

    it("menolak santri milik institusi lain (tenant isolation)", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            createPermitRequest(adminA, {
              studentId: "std_santri_b",
              type: "HOME_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof ResourceNotFoundError
      );
    });

    it("menolak izin ganda saat masih ada izin berjalan", async () => {
      await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            createPermitRequest(adminA, {
              studentId: "std_santri_1",
              type: "SICK_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof ActivePermitExistsError
      );
    });

    it("menolak waktu kembali sebelum waktu berangkat (Zod)", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            createPermitRequest(adminA, {
              studentId: "std_santri_1",
              type: "HOME_LEAVE",
              leaveAt: inTwoDays().toISOString(),
              returnAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("menolak pengajuan saat tidak ada tahun ajaran aktif", async () => {
      inMemoryAcademicYears = inMemoryAcademicYears.map((y) =>
        y.institutionId === instAId ? { ...y, isActive: false } : y
      );

      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () =>
            createPermitRequest(adminA, {
              studentId: "std_santri_1",
              type: "HOME_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof NoActiveAcademicYearError
      );
    });

    it("approve: PENDING -> APPROVED + AuditLog + antrean notifikasi wali", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
          returnAt: inTwoDays().toISOString(),
          reason: "Acara keluarga",
        })
      );

      const approved = await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id, notes: "Disetujui ustadz" })
      );

      assert.equal(approved.status, "APPROVED");
      assert.equal(approved.approvedById, "usr_admin_a");
      assert(approved.approvedAt, "approvedAt terisi");
      assert(approved.decidedAt, "decidedAt terisi");

      const audit = inMemoryAuditLogs.filter((a) => a.entityId === permit.id);
      assert.equal(audit.length, 2, "CREATE + UPDATE");

      assert.equal(inMemoryOutbox.length, 1, "notifikasi wali diantre");
      assert.equal(inMemoryOutbox[0].templateKey, "PERMIT_APPROVED");
      assert.equal(inMemoryOutbox[0].recipient, "6281234567891");
      assert.equal(inMemoryOutbox[0].status, "PENDING");
    });

    it("approve dua kali ditolak (status terminal/berjalan tidak boleh di-approve)", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );

      await assert.rejects(
        () => runWithTenantContext(adminA, () => approvePermitRequest(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
    });

    it("reject: PENDING -> REJECTED, lalu santri bisa diajukan izin baru", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      const rejected = await runWithTenantContext(adminA, () =>
        rejectPermitRequest(adminA, { permitId: permit.id, notes: "Berkas belum lengkap" })
      );
      assert.equal(rejected.status, "REJECTED");

      // Status terminal tidak menghalangi pengajuan baru
      const newPermit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );
      assert.equal(newPermit.status, "PENDING");
      assert.notEqual(newPermit.id, permit.id);
    });

    it("reject dari status APPROVED ditolak (transisi tidak valid)", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );
      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );

      await assert.rejects(
        () => runWithTenantContext(adminA, () => rejectPermitRequest(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
    });

    it("markReturned: APPROVED -> RETURNED dengan returnedAt terisi", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );
      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );

      const returned = await runWithTenantContext(adminA, () =>
        markPermitReturned(adminA, { permitId: permit.id })
      );

      assert.equal(returned.status, "RETURNED");
      assert(returned.returnedAt, "returnedAt terisi");
    });

    it("markReturned dari PENDING ditolak", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      await assert.rejects(
        () => runWithTenantContext(adminA, () => markPermitReturned(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
    });

    it("markOverdue: APPROVED lewat waktu kembali -> OVERDUE; sebelum waktu kembali -> ditolak", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: yesterday().toISOString(),
          returnAt: tomorrow().toISOString(),
        })
      );
      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );

      // Belum melewati waktu kembali
      await assert.rejects(
        () => runWithTenantContext(adminA, () => markPermitOverdue(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitNotYetOverdueError
      );

      // Lewat waktu kembali
      inMemoryPermits = inMemoryPermits.map((p) =>
        p.id === permit.id ? { ...p, returnAt: yesterday() } : p
      );

      const overdue = await runWithTenantContext(adminA, () =>
        markPermitOverdue(adminA, { permitId: permit.id })
      );
      assert.equal(overdue.status, "OVERDUE");
    });

    it("status terminal imut: RETURNED tidak bisa di-approve/diubah lagi", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );
      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );
      await runWithTenantContext(adminA, () =>
        markPermitReturned(adminA, { permitId: permit.id })
      );

      await assert.rejects(
        () => runWithTenantContext(adminA, () => approvePermitRequest(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
      await assert.rejects(
        () => runWithTenantContext(adminA, () => rejectPermitRequest(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
      await assert.rejects(
        () =>
          runWithTenantContext(adminA, () => markPermitReturned(adminA, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitInvalidTransitionError
      );
    });

    it("matriks transisi lifecycle konsisten (terminal = kosong)", () => {
      assert.deepEqual([...PERMIT_TRANSITIONS.PENDING], ["APPROVED", "REJECTED"]);
      assert.deepEqual([...PERMIT_TRANSITIONS.APPROVED], ["RETURNED", "OVERDUE"]);
      assert.equal(PERMIT_TRANSITIONS.REJECTED.length, 0);
      assert.equal(PERMIT_TRANSITIONS.RETURNED.length, 0);
      assert.equal(PERMIT_TRANSITIONS.OVERDUE.length, 0);

      assert(isValidPermitTransition("PENDING", "APPROVED"));
      assert(!isValidPermitTransition("PENDING", "RETURNED"));
      assert(!isValidPermitTransition("REJECTED", "APPROVED"));
      assert(!isValidPermitTransition("RETURNED", "OVERDUE"));
    });
  });

  // -------------------------------------------------------------------------
  describe("2. RBAC & Tenant Isolation", () => {
    it("guru tanpa pesantren:manage tidak bisa mengajukan/menyetujui izin", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(teacherA, () =>
            createPermitRequest(teacherA, {
              studentId: "std_santri_1",
              type: "HOME_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof AuthorizationError
      );

      await assert.rejects(
        () =>
          runWithTenantContext(teacherA, () =>
            approvePermitRequest(teacherA, { permitId: "permit_x" })
          ),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("guru tanpa pesantren:view tidak bisa melihat daftar izin", async () => {
      await assert.rejects(
        () => runWithTenantContext(teacherA, () => listPermitRequests(teacherA)),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("sesi wali (GUARDIAN) ditolak total dari RBAC internal", async () => {
      await assert.rejects(
        () => runWithTenantContext(guardianCtx, () => listPermitRequests(guardianCtx)),
        (err: unknown) => err instanceof AuthorizationError
      );
      await assert.rejects(
        () =>
          runWithTenantContext(guardianCtx, () =>
            createPermitRequest(guardianCtx, {
              studentId: "std_santri_1",
              type: "HOME_LEAVE",
              leaveAt: tomorrow().toISOString(),
            })
          ),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("admin lembaga lain tidak melihat/mengubah izin lembaga A", async () => {
      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      // Daftar B kosong
      const listB = await runWithTenantContext(adminB, () => listPermitRequests(adminB));
      assert.equal(listB.length, 0);

      // Approve silang -> tidak ditemukan
      await assert.rejects(
        () => runWithTenantContext(adminB, () => approvePermitRequest(adminB, { permitId: permit.id })),
        (err: unknown) => err instanceof PermitNotFoundError
      );

      // Detail silang -> tidak ditemukan
      await assert.rejects(
        () => runWithTenantContext(adminB, () => getPermitRequestById(adminB, permit.id)),
        (err: unknown) => err instanceof PermitNotFoundError
      );
    });

    it("matriks RBAC: pesantren:view/manage hanya untuk 4 peran pimpinan/admin", () => {
      assert.equal(isValidPermission("pesantren:view"), true);
      assert.equal(isValidPermission("pesantren:manage"), true);

      for (const role of ["SUPER_ADMIN", "FOUNDATION_HEAD", "PRINCIPAL", "ADMIN"] as const) {
        assert(
          ROLE_PERMISSIONS[role].includes("pesantren:view"),
          `${role} harus punya pesantren:view`
        );
        assert(
          ROLE_PERMISSIONS[role].includes("pesantren:manage"),
          `${role} harus punya pesantren:manage`
        );
      }

      assert(!ROLE_PERMISSIONS.TEACHER.includes("pesantren:view"));
      assert(!ROLE_PERMISSIONS.TEACHER.includes("pesantren:manage"));
      assert(!ROLE_PERMISSIONS.FINANCE_STAFF.includes("pesantren:view"));
      assert(!ROLE_PERMISSIONS.FINANCE_STAFF.includes("pesantren:manage"));
    });
  });

  // -------------------------------------------------------------------------
  describe("3. Listing, Filter & Notifikasi", () => {
    it("listPermitRequests memfilter per status dan tetap terisolasi tenant", async () => {
      const p1 = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );
      await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: p1.id })
      );

      const pending = await runWithTenantContext(adminA, () =>
        listPermitRequests(adminA, { status: "PENDING" })
      );
      assert.equal(pending.length, 0);

      const approved = await runWithTenantContext(adminA, () =>
        listPermitRequests(adminA, { status: "APPROVED" })
      );
      assert.equal(approved.length, 1);
      assert.equal(approved[0].id, p1.id);
      assert.equal(approved[0].student.fullName, "Zaid bin Tsabit");
      assert.equal(approved[0].academicYear.name, "2025/2026");
    });

    it("filter status tidak valid ditolak Zod", async () => {
      await assert.rejects(
        () => runWithTenantContext(adminA, () => listPermitRequests(adminA, { status: "MELEDAK" })),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("approve tanpa wali terdaftar tetap sukses (notifikasi dilewati dengan anggun)", async () => {
      inMemoryStudents = inMemoryStudents.map((s) =>
        s.id === "std_santri_1" ? { ...s, guardians: [], parentWaPhone: null } : s
      );

      const permit = await runWithTenantContext(adminA, () =>
        createPermitRequest(adminA, {
          studentId: "std_santri_1",
          type: "HOME_LEAVE",
          leaveAt: tomorrow().toISOString(),
        })
      );

      const approved = await runWithTenantContext(adminA, () =>
        approvePermitRequest(adminA, { permitId: permit.id })
      );

      assert.equal(approved.status, "APPROVED");
      assert.equal(inMemoryOutbox.length, 0, "tanpa penerima -> tanpa antrean");
    });

    it("template PERMIT_APPROVED terdaftar dan merender pesan berisi nama santri", () => {
      assert((NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes("PERMIT_APPROVED"));

      const message = renderNotificationMessage("PERMIT_APPROVED", {
        studentName: "Zaid bin Tsabit",
        permitType: "Izin Pulang",
        leaveAt: "1 Okt 2026, 08.00",
        returnAt: "2 Okt 2026, 16.00",
        approvedByName: "Admin A",
      });

      assert(message.includes("Zaid bin Tsabit"));
      assert(message.includes("DISETUJUI"));
      assert(message.includes("Admin A"));
    });
  });
});
