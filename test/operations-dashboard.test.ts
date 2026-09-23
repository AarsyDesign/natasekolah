import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import { getOperationalDashboard } from "../src/lib/operations/dashboard-service";
import { searchGlobalEntities } from "../src/lib/operations/search-service";

describe("Milestone — Operational Admin Experience / Daily Operations Tests", () => {
  const tenantAId = "inst_pesantren_al_falah";
  const tenantBId = "inst_smpit_darul_ilmi";

  // Contexts
  const adminCtxA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: tenantAId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "academic:view",
      "academic:manage",
      "attendance:view",
      "attendance:manage",
      "finance:view",
      "finance:manage",
      "staff:view",
      "classroom:view",
      "classroom:manage",
      "report:view",
      "tahfidz:view",
      "tahfidz:manage",
      "dormitory:view",
      "dormitory:manage",
      "guardian:view",
      "guardian:manage",
      "institution:view",
      "settings:view",
    ],
    isSuperAdmin: false,
  };

  const teacherCtxA: TenantContext = {
    userId: "usr_teacher_a",
    institutionId: tenantAId,
    roles: ["TEACHER"],
    permissions: [
      "student:view",
      "academic:view",
      "attendance:view",
      "attendance:manage",
      "classroom:view",
      "report:view",
      "tahfidz:view",
      "tahfidz:manage",
      "dormitory:view",
    ],
    isSuperAdmin: false,
  };

  const financeCtxA: TenantContext = {
    userId: "usr_finance_a",
    institutionId: tenantAId,
    roles: ["FINANCE_STAFF"],
    permissions: [
      "student:view",
      "finance:view",
      "finance:manage",
      "report:view",
    ],
    isSuperAdmin: false,
  };

  const adminCtxB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: tenantBId,
    roles: ["ADMIN"],
    permissions: adminCtxA.permissions,
    isSuperAdmin: false,
  };

  // Mock Institution A with all plugins enabled
  const mockInstitutionA = {
    id: tenantAId,
    name: "Pesantren Al-Falah",
    slug: "pesantren-al-falah",
    type: "PESANTREN_TERPADU",
    enabledPlugins: JSON.stringify(["FORMAL_ACADEMIC", "PESANTREN_LIVING", "TAHFIDZ"]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Institution B with ONLY FORMAL_ACADEMIC (no tahfidz, no living)
  const mockInstitutionB = {
    id: tenantBId,
    name: "SMPIT Darul Ilmi",
    slug: "smpit-darul-ilmi",
    type: "SEKOLAH",
    enabledPlugins: JSON.stringify(["FORMAL_ACADEMIC"]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * Helper untuk mengisolasi seluruh panggilan basis data Prisma dengan stubs terkontrol.
   */
  function setupDashboardMocks(overrides: Record<string, any> = {}) {
    const originals = {
      institutionFindUnique: prisma.institution.findUnique,
      userFindUnique: prisma.user.findUnique,
      studentCount: prisma.student.count,
      attendanceSessionFindMany: prisma.attendanceSession.findMany,
      attendanceSessionCount: prisma.attendanceSession.count,
      attendanceRecordGroupBy: prisma.attendanceRecord.groupBy,
      studentChargeAggregate: prisma.studentCharge.aggregate,
      paymentTransactionAggregate: prisma.paymentTransaction.aggregate,
      assessmentCount: prisma.assessment.count,
      reportCardCount: prisma.reportCard.count,
      academicYearFindFirst: prisma.academicYear.findFirst,
      classroomFindMany: prisma.classroom.findMany,
      tahfidzRecordCount: prisma.tahfidzRecord.count,
      studentDormitoryAssignmentCount: prisma.studentDormitoryAssignment.count,
      notificationOutboxCount: prisma.notificationOutbox.count,
    };

    // Default implementations
    (prisma.institution as any).findUnique =
      overrides.institutionFindUnique ||
      (async ({ where }: any) => {
        if (where.id === tenantAId) return mockInstitutionA;
        if (where.id === tenantBId) return mockInstitutionB;
        return null;
      });

    (prisma.user as any).findUnique =
      overrides.userFindUnique ||
      (async ({ where }: any) => ({
        id: where.id,
        name: "Pengguna Uji",
        email: "uji@nata.id",
        roles: '["ADMIN"]',
      }));

    (prisma.student as any).count = overrides.studentCount || (async () => 0);
    (prisma.attendanceSession as any).findMany =
      overrides.attendanceSessionFindMany || (async () => []);
    (prisma.attendanceSession as any).count =
      overrides.attendanceSessionCount || (async () => 0);
    (prisma.attendanceRecord as any).groupBy =
      overrides.attendanceRecordGroupBy || (async () => []);
    (prisma.studentCharge as any).aggregate =
      overrides.studentChargeAggregate ||
      (async () => ({ _count: { id: 0 }, _sum: { amount: 0 } }));
    (prisma.paymentTransaction as any).aggregate =
      overrides.paymentTransactionAggregate ||
      (async () => ({ _count: { id: 0 }, _sum: { amount: 0 } }));
    (prisma.assessment as any).count = overrides.assessmentCount || (async () => 0);
    (prisma.reportCard as any).count = overrides.reportCardCount || (async () => 0);
    (prisma.academicYear as any).findFirst =
      overrides.academicYearFindFirst || (async () => null);
    (prisma.classroom as any).findMany = overrides.classroomFindMany || (async () => []);
    (prisma.tahfidzRecord as any).count = overrides.tahfidzRecordCount || (async () => 0);
    (prisma.studentDormitoryAssignment as any).count =
      overrides.studentDormitoryAssignmentCount || (async () => 0);
    (prisma.notificationOutbox as any).count =
      overrides.notificationOutboxCount || (async () => 0);

    return function restore() {
      prisma.institution.findUnique = originals.institutionFindUnique;
      prisma.user.findUnique = originals.userFindUnique;
      prisma.student.count = originals.studentCount;
      prisma.attendanceSession.findMany = originals.attendanceSessionFindMany;
      prisma.attendanceSession.count = originals.attendanceSessionCount;
      prisma.attendanceRecord.groupBy = originals.attendanceRecordGroupBy;
      prisma.studentCharge.aggregate = originals.studentChargeAggregate;
      prisma.paymentTransaction.aggregate = originals.paymentTransactionAggregate;
      prisma.assessment.count = originals.assessmentCount;
      prisma.reportCard.count = originals.reportCardCount;
      prisma.academicYear.findFirst = originals.academicYearFindFirst;
      prisma.classroom.findMany = originals.classroomFindMany;
      prisma.tahfidzRecord.count = originals.tahfidzRecordCount;
      prisma.studentDormitoryAssignment.count = originals.studentDormitoryAssignmentCount;
      prisma.notificationOutbox.count = originals.notificationOutboxCount;
    };
  }

  describe("1. Dashboard Tenant Isolation", () => {
    it("harus mengisolasi metrik siswa dan sesi presensi sesuai institusi aktif", async () => {
      const restore = setupDashboardMocks({
        studentCount: async ({ where }: any) => {
          if (where.institutionId === tenantAId) return 150;
          if (where.institutionId === tenantBId) return 75;
          return 0;
        },
        attendanceSessionFindMany: async ({ where }: any) => {
          if (where.institutionId === tenantAId) {
            return [{ id: "sess_a1", status: "OPEN" }, { id: "sess_a2", status: "CLOSED" }];
          }
          return [];
        },
        attendanceSessionCount: async ({ where }: any) => {
          if (where.institutionId === tenantAId) return 1;
          return 0;
        },
      });

      try {
        // Query Tenant A
        const dashA = await getOperationalDashboard(adminCtxA);
        assert.equal(dashA.institution.id, tenantAId);
        assert.equal(dashA.stats.students?.totalActive, 150);
        assert.equal(dashA.stats.attendance?.todaySessionsTotal, 2);
        assert.equal(dashA.stats.attendance?.openSessionsCount, 1);

        // Query Tenant B
        const dashB = await getOperationalDashboard(adminCtxB);
        assert.equal(dashB.institution.id, tenantBId);
        assert.equal(dashB.stats.students?.totalActive, 75);
        assert.equal(dashB.stats.attendance?.todaySessionsTotal, 0);
      } finally {
        restore();
      }
    });
  });

  describe("2. Dashboard Permission Isolation (RBAC)", () => {
    it("harus menyembunyikan data keuangan dari akun Guru (TEACHER) tanpa izin finance:view", async () => {
      const restore = setupDashboardMocks({
        studentCount: async () => 100,
        userFindUnique: async () => ({
          id: teacherCtxA.userId,
          name: "Ustadz Guru",
          email: "guru@pesantren.id",
        }),
      });

      try {
        const dashTeacher = await getOperationalDashboard(teacherCtxA);

        // Guru berhak melihat siswa dan presensi
        assert.notEqual(dashTeacher.stats.students, null);
        assert.notEqual(dashTeacher.stats.attendance, null);

        // Guru TIDAK berhak melihat keuangan
        assert.equal(dashTeacher.stats.finance, null);

        // Guru TIDAK melihat notifikasi outbox sistem
        assert.equal(dashTeacher.stats.notifications, null);
      } finally {
        restore();
      }
    });

    it("harus menyembunyikan data presensi dari staf keuangan tanpa izin attendance:view", async () => {
      const restore = setupDashboardMocks({
        studentCount: async () => 100,
        userFindUnique: async () => ({
          id: financeCtxA.userId,
          name: "Bendahara",
          email: "finance@pesantren.id",
        }),
        studentChargeAggregate: async () => ({
          _count: { id: 10 },
          _sum: { amount: 5000000 },
        }),
        paymentTransactionAggregate: async () => ({
          _count: { id: 3 },
          _sum: { amount: 1500000 },
        }),
      });

      try {
        const dashFinance = await getOperationalDashboard(financeCtxA);

        // Finance berhak melihat keuangan
        assert.notEqual(dashFinance.stats.finance, null);
        assert.equal(dashFinance.stats.finance?.unpaidChargesCount, 10);
        assert.equal(dashFinance.stats.finance?.unpaidChargesSum, 5000000);
        assert.equal(dashFinance.stats.finance?.todayPaymentsCount, 3);
        assert.equal(dashFinance.stats.finance?.todayPaymentsSum, 1500000);

        // Finance TIDAK berhak melihat presensi
        assert.equal(dashFinance.stats.attendance, null);
      } finally {
        restore();
      }
    });
  });

  describe("3. Quick Action Permission & Plugin Enforcement", () => {
    it("harus membatasi quick actions sesuai permission pengguna", async () => {
      const restore = setupDashboardMocks();

      try {
        // Admin: Punya akses ke berbagai quick actions
        const dashAdmin = await getOperationalDashboard(adminCtxA);
        const adminActionIds = dashAdmin.quickActions.map((a) => a.id);
        assert.ok(adminActionIds.includes("qa-student-create"));
        assert.ok(adminActionIds.includes("qa-classroom-manage"));
        assert.ok(adminActionIds.includes("qa-attendance-record"));
        assert.ok(adminActionIds.includes("qa-finance-charge"));
        assert.ok(adminActionIds.includes("qa-finance-payment"));
        assert.ok(adminActionIds.includes("qa-tahfidz-record"));
        assert.ok(adminActionIds.includes("qa-dormitory-manage"));

        // Finance: Hanya aksi keuangan dan profil siswa, tidak ada buat kelas / presensi / tahfidz
        const dashFinance = await getOperationalDashboard(financeCtxA);
        const financeActionIds = dashFinance.quickActions.map((a) => a.id);
        assert.ok(financeActionIds.includes("qa-finance-charge"));
        assert.ok(financeActionIds.includes("qa-finance-payment"));
        assert.ok(!financeActionIds.includes("qa-student-create"));
        assert.ok(!financeActionIds.includes("qa-classroom-manage"));
        assert.ok(!financeActionIds.includes("qa-attendance-record"));
        assert.ok(!financeActionIds.includes("qa-tahfidz-record"));
        assert.ok(!financeActionIds.includes("qa-dormitory-manage"));
      } finally {
        restore();
      }
    });

    it("harus menyembunyikan metrik dan quick actions plugin yang dinonaktifkan lembaga", async () => {
      const restore = setupDashboardMocks({
        institutionFindUnique: async () => mockInstitutionB,
        studentCount: async () => 50,
        assessmentCount: async () => 5,
      });

      try {
        const dashB = await getOperationalDashboard(adminCtxB);

        // Formal academic aktif
        assert.notEqual(dashB.stats.academic, null);
        assert.equal(dashB.stats.academic?.totalAssessments, 5);

        // Tahfidz & Asrama dinonaktifkan di Institution B
        assert.equal(dashB.stats.tahfidz, null);
        assert.equal(dashB.stats.living, null);

        // Quick action Tahfidz & Asrama tidak boleh muncul
        const actionIds = dashB.quickActions.map((a) => a.id);
        assert.ok(!actionIds.includes("qa-tahfidz-record"));
        assert.ok(!actionIds.includes("qa-dormitory-manage"));
      } finally {
        restore();
      }
    });
  });

  describe("4. Operational Attention Items Aggregation", () => {
    it("harus mendeteksi sesi gantung, outbox gagal, tagihan jatuh tempo, dan rombel tanpa guru", async () => {
      const restore = setupDashboardMocks({
        attendanceSessionCount: async () => 3, // 3 Sesi presensi gantung/OPEN
        notificationOutboxCount: async ({ where }: any) => {
          if (where.status === "FAILED") return 4;
          return 0;
        },
        studentChargeAggregate: async ({ where }: any) => {
          if (where.dueDate) {
            return { _count: { id: 5 }, _sum: { amount: 2500000 } };
          }
          return { _count: { id: 10 }, _sum: { amount: 5000000 } };
        },
        assessmentCount: async ({ where }: any) => {
          if (where?.isPublished === false) return 2;
          return 10;
        },
        reportCardCount: async () => 1,
        academicYearFindFirst: async () => ({
          id: "ay_2026",
          name: "2025/2026",
          isActive: true,
        }),
        classroomFindMany: async () => [{ id: "cls_unassigned_1" }],
      });

      try {
        const dashboard = await getOperationalDashboard(adminCtxA);

        const attentionIds = dashboard.attentionItems.map((item) => item.id);
        assert.ok(attentionIds.includes("ATTENDANCE_OPEN_SESSIONS"));
        assert.ok(attentionIds.includes("NOTIFICATION_OUTBOX_FAILED"));
        assert.ok(attentionIds.includes("FINANCE_OVERDUE_CHARGES"));
        assert.ok(attentionIds.includes("ACADEMIC_DRAFT_ASSESSMENTS"));
        assert.ok(attentionIds.includes("REPORT_DRAFT_CARDS"));
        assert.ok(attentionIds.includes("CLASSROOM_UNASSIGNED_TEACHERS"));

        const openItem = dashboard.attentionItems.find((i) => i.id === "ATTENDANCE_OPEN_SESSIONS");
        assert.equal(openItem?.count, 3);
        assert.equal(openItem?.actionHref, "/attendance");

        const failedItem = dashboard.attentionItems.find((i) => i.id === "NOTIFICATION_OUTBOX_FAILED");
        assert.equal(failedItem?.count, 4);
        assert.equal(failedItem?.severity, "CRITICAL");
        assert.equal(failedItem?.actionHref, "/notifications");

        const overdueItem = dashboard.attentionItems.find((i) => i.id === "FINANCE_OVERDUE_CHARGES");
        assert.equal(overdueItem?.count, 5);
        assert.equal(overdueItem?.actionHref, "/finance");
      } finally {
        restore();
      }
    });

    it("harus mengembalikan daftar attention kosong bila seluruh operasional selesai", async () => {
      const restore = setupDashboardMocks({
        attendanceSessionCount: async () => 0,
        notificationOutboxCount: async () => 0,
        studentChargeAggregate: async () => ({ _count: { id: 0 }, _sum: { amount: 0 } }),
        assessmentCount: async () => 0,
        reportCardCount: async () => 0,
        academicYearFindFirst: async () => null,
        classroomFindMany: async () => [],
      });

      try {
        const dashboard = await getOperationalDashboard(adminCtxA);
        assert.equal(dashboard.attentionItems.length, 0);
      } finally {
        restore();
      }
    });
  });

  describe("5. Global Search / Quick Navigation Tests", () => {
    it("harus menolak query kurang dari 2 karakter dan mengembalikan array kosong", async () => {
      const resShort = await searchGlobalEntities(adminCtxA, "a");
      assert.deepEqual(resShort, []);

      const resEmpty = await searchGlobalEntities(adminCtxA, "   ");
      assert.deepEqual(resEmpty, []);
    });

    it("harus mencari siswa, rombel, guru, dan wali murid dengan batas tenant yang ketat", async () => {
      const origStudentFind = prisma.student.findMany;
      const origClassroomFind = prisma.classroom.findMany;
      const origUserFind = prisma.user.findMany;
      const origGuardianFind = prisma.guardian.findMany;

      try {
        (prisma.student as any).findMany = async ({ where }: any) => {
          assert.equal(where.institutionId, tenantAId, "Wajib query dengan tenant A");
          return [
            {
              id: "std_1",
              fullName: "Ahmad Dahlan",
              nis: "2026001",
              nisn: "0011223344",
              status: "ACTIVE",
            },
          ];
        };

        (prisma.classroom as any).findMany = async ({ where }: any) => {
          assert.equal(where.institutionId, tenantAId);
          return [
            {
              id: "cls_1",
              name: "Kelas 7A Ahmad",
              gradeLevel: "7",
              academicYear: { name: "2025/2026" },
            },
          ];
        };

        (prisma.user as any).findMany = async ({ where }: any) => {
          assert.equal(where.institutionId, tenantAId);
          return [
            {
              id: "usr_1",
              name: "Ustadz Ahmad Fuad",
              email: "ahmad.fuad@pesantren.id",
              roles: '["TEACHER"]',
            },
          ];
        };

        (prisma.guardian as any).findMany = async ({ where }: any) => {
          assert.equal(where.institutionId, tenantAId);
          return [
            {
              id: "grd_1",
              fullName: "Ahmad Santoso (Wali)",
              phoneWa: "6281234567890",
              status: "ACTIVE",
            },
          ];
        };

        const results = await searchGlobalEntities(adminCtxA, "ahmad");
        assert.equal(results.length, 4);

        const studentResult = results.find((r) => r.type === "STUDENT");
        assert.ok(studentResult);
        assert.equal(studentResult?.title, "Ahmad Dahlan");
        assert.ok(studentResult?.subtitle.includes("NIS: 2026001"));
        assert.equal(studentResult?.href, "/students?search=2026001");

        const classroomResult = results.find((r) => r.type === "CLASSROOM");
        assert.ok(classroomResult);
        assert.equal(classroomResult?.title, "Kelas 7A Ahmad");
        assert.equal(classroomResult?.href, "/classrooms");

        const teacherResult = results.find((r) => r.type === "TEACHER");
        assert.ok(teacherResult);
        assert.equal(teacherResult?.title, "Ustadz Ahmad Fuad");
        assert.equal(teacherResult?.subtitle, "ahmad.fuad@pesantren.id");
        assert.equal(teacherResult?.href, "/teachers");

        const guardianResult = results.find((r) => r.type === "GUARDIAN");
        assert.ok(guardianResult);
        assert.equal(guardianResult?.title, "Ahmad Santoso (Wali)");
        assert.ok(guardianResult?.subtitle.includes("6281234567890"));
        assert.equal(guardianResult?.href, "/students");
      } finally {
        prisma.student.findMany = origStudentFind;
        prisma.classroom.findMany = origClassroomFind;
        prisma.user.findMany = origUserFind;
        prisma.guardian.findMany = origGuardianFind;
      }
    });

    it("harus memfilter kategori pencarian sesuai RBAC (Guru tidak dapat mencari akun staf)", async () => {
      const origStudentFind = prisma.student.findMany;
      const origClassroomFind = prisma.classroom.findMany;
      const origUserFind = prisma.user.findMany;
      const origGuardianFind = prisma.guardian.findMany;

      let userFindCalled = false;

      try {
        (prisma.student as any).findMany = async () => [];
        (prisma.classroom as any).findMany = async () => [];
        (prisma.guardian as any).findMany = async () => [];
        (prisma.user as any).findMany = async () => {
          userFindCalled = true;
          return [];
        };

        // Guru (teacherCtxA) tidak memiliki izin staff:view
        await searchGlobalEntities(teacherCtxA, "guru");
        assert.equal(userFindCalled, false, "prisma.user.findMany tidak boleh dipanggil untuk akun tanpa staff:view");
      } finally {
        prisma.student.findMany = origStudentFind;
        prisma.classroom.findMany = origClassroomFind;
        prisma.user.findMany = origUserFind;
        prisma.guardian.findMany = origGuardianFind;
      }
    });

    it("harus menjamin tidak ada kebocoran data pencarian antar lembaga (Cross-Tenant Search Leakage)", async () => {
      const origStudentFind = prisma.student.findMany;
      const origClassroomFind = prisma.classroom.findMany;
      const origUserFind = prisma.user.findMany;
      const origGuardianFind = prisma.guardian.findMany;

      try {
        (prisma.student as any).findMany = async ({ where }: any) => {
          // Hanya kembalikan data jika institusi cocok
          if (where.institutionId === tenantBId) {
            return [{ id: "std_b", fullName: "Santri Tenant B", nis: "999", status: "ACTIVE" }];
          }
          return [];
        };
        (prisma.classroom as any).findMany = async () => [];
        (prisma.user as any).findMany = async () => [];
        (prisma.guardian as any).findMany = async () => [];

        // Pencarian dengan konteks Tenant A tidak boleh menghasilkan data Tenant B
        const resultsA = await searchGlobalEntities(adminCtxA, "santri");
        assert.equal(resultsA.length, 0);

        // Pencarian dengan konteks Tenant B menghasilkan datanya sendiri
        const resultsB = await searchGlobalEntities(adminCtxB, "santri");
        assert.equal(resultsB.length, 1);
        assert.equal(resultsB[0].title, "Santri Tenant B");
      } finally {
        prisma.student.findMany = origStudentFind;
        prisma.classroom.findMany = origClassroomFind;
        prisma.user.findMany = origUserFind;
        prisma.guardian.findMany = origGuardianFind;
      }
    });
  });
});
