import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  getGuardianProfile,
  getGuardianChildren,
  getGuardianStudentOverview,
  getGuardianStudentAttendance,
  getGuardianStudentFinance,
  getGuardianStudentAcademic,
  getGuardianStudentReportCard,
  getGuardianStudentTahfidz,
  getGuardianStudentDormitory,
  getGuardianNotifications,
} from "../src/lib/guardian/portal-service";
import { GuardianAccessDeniedError } from "../src/lib/auth/guardian-guard";
import { requirePermission, requireRole, AuthorizationError } from "../src/lib/auth/permissions";
import { activateGuardianAction } from "../src/actions/guardian";
import { GuardianInvitationError } from "../src/lib/auth/guardian";

describe("Phase 7 — Parent Experience / Portal Wali Tests", () => {
  const tenantAId = "inst_pesantren_al_falah";
  const tenantBId = "inst_smpit_darul_ilmi";

  const mockGuardianA1 = {
    id: "grd_ahmad_01",
    institutionId: tenantAId,
    fullName: "Ahmad Dahlan",
    phoneWa: "6281234567890",
    email: "ahmad@keluarga.id",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGuardianA2 = {
    id: "grd_hasan_02",
    institutionId: tenantAId,
    fullName: "Hasan Basri",
    phoneWa: "6281299998888",
    email: null,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudentA1 = {
    id: "std_fauzan_01",
    institutionId: tenantAId,
    nis: "2026001",
    nisn: "0012345678",
    fullName: "Fauzan Dahlan",
    status: "ACTIVE",
    gender: "L",
  };

  const mockStudentA2 = {
    id: "std_ali_02",
    institutionId: tenantAId,
    nis: "2026002",
    nisn: "0012345679",
    fullName: "Ali Basri",
    status: "ACTIVE",
    gender: "L",
  };

  const mockStudentB1 = {
    id: "std_zaki_b1",
    institutionId: tenantBId,
    nis: "2026999",
    nisn: "0099999999",
    fullName: "Zaki Mubarak",
    status: "ACTIVE",
    gender: "L",
  };

  describe("1. Guardian Profile & Linked Children Resolution (ReBAC)", () => {
    it("harus mengembalikan profil wali dan daftar santri asuh yang sah", async () => {
      const origGuardianFind = prisma.guardian.findUnique;
      (prisma.guardian as any).findUnique = async () => ({
        ...mockGuardianA1,
        institution: {
          id: tenantAId,
          name: "Pesantren Al-Falah",
          slug: "pesantren-al-falah",
          type: "PESANTREN",
          address: "Jawa Timur",
          phone: "031123456",
        },
        students: [
          {
            id: "gs_01",
            institutionId: tenantAId,
            guardianId: mockGuardianA1.id,
            studentId: mockStudentA1.id,
            relationship: "AYAH",
            isPrimary: true,
            student: {
              ...mockStudentA1,
              enrollments: [
                {
                  id: "enr_01",
                  status: "ENROLLED",
                  classroom: { id: "cls_01", name: "Kelas 7A" },
                  academicYear: { id: "ay_01", name: "2025/2026" },
                },
              ],
            },
          },
        ],
      });

      try {
        const profile = await getGuardianProfile(mockGuardianA1.id, tenantAId);
        assert.equal(profile.guardian.id, mockGuardianA1.id);
        assert.equal(profile.institution.id, tenantAId);
        assert.equal(profile.children.length, 1);
        assert.equal(profile.children[0].student.id, mockStudentA1.id);
        assert.equal(profile.children[0].relationship, "AYAH");
        assert.equal(profile.children[0].activeEnrollment?.classroom.name, "Kelas 7A");

        const children = await getGuardianChildren(mockGuardianA1.id, tenantAId);
        assert.equal(children.length, 1);
        assert.equal(children[0].student.fullName, "Fauzan Dahlan");
      } finally {
        prisma.guardian.findUnique = origGuardianFind;
      }
    });

    it("harus menolak pengambilan profil jika institusi sesi tidak cocok (cross-tenant)", async () => {
      const origGuardianFind = prisma.guardian.findUnique;
      (prisma.guardian as any).findUnique = async () => ({
        ...mockGuardianA1,
        institution: { id: tenantAId },
        students: [],
      });

      try {
        await assert.rejects(
          async () => {
            await getGuardianProfile(mockGuardianA1.id, tenantBId); // Sesi Tenant B mencoba akses wali Tenant A
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            return true;
          }
        );
      } finally {
        prisma.guardian.findUnique = origGuardianFind;
      }
    });
  });

  describe("2. Guardian Student Overview & Cross-Student ReBAC Isolation", () => {
    it("harus mengizinkan wali melihat ringkasan santri yang terhubung kepadanya", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origStudentFind = prisma.student.findUnique;
      const origAttFind = prisma.attendanceRecord.findMany;
      const origChargeFind = prisma.studentCharge.findMany;
      const origTxFind = prisma.paymentTransaction.findMany;
      const origReportFind = prisma.reportCard.findMany;
      const origScoreFind = prisma.assessmentScore.findMany;
      const origTahfidzFind = prisma.tahfidzRecord.findMany;
      const origDormFind = prisma.studentDormitoryAssignment.findFirst;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
        relationship: "AYAH",
        isPrimary: true,
      });

      (prisma.student as any).findUnique = async () => ({
        ...mockStudentA1,
        enrollments: [
          {
            id: "enr_01",
            status: "ENROLLED",
            classroom: { id: "cls_01", name: "Kelas 7A" },
            academicYear: { id: "ay_01", name: "2025/2026" },
          },
        ],
      });

      (prisma.attendanceRecord as any).findMany = async () => [
        {
          id: "att_01",
          status: "PRESENT",
          note: null,
          session: {
            attendanceDate: new Date("2026-09-20"),
            context: "ACADEMIC",
            teacherAssignment: { subject: { name: "Matematika" } },
            dormitoryRoom: null,
          },
        },
      ];

      (prisma.studentCharge as any).findMany = async () => [
        {
          id: "chg_01",
          amount: 500000,
          status: "PAID",
          dueDate: new Date("2026-09-10"),
          feeCategory: { name: "SPP September" },
          allocations: [{ amount: 500000 }],
        },
      ];

      (prisma.paymentTransaction as any).findMany = async () => [
        {
          id: "tx_01",
          transactionNumber: "TRX-2026-001",
          paymentDate: new Date("2026-09-05"),
          amount: 500000,
          receipt: { receiptNumber: "KW-001" },
          allocations: [{ studentCharge: { feeCategory: { name: "SPP September" } } }],
        },
      ];

      (prisma.reportCard as any).findMany = async () => [];
      (prisma.assessmentScore as any).findMany = async () => [];
      (prisma.tahfidzRecord as any).findMany = async () => [
        {
          id: "thf_01",
          surah: 78,
          surahName: "An-Naba'",
          startAyah: 1,
          endAyah: 15,
          type: "SETORAN",
          quality: "MUMTAZ",
          note: "Mumtaz",
          date: new Date("2026-09-18"),
        },
      ];
      (prisma.studentDormitoryAssignment as any).findFirst = async () => null;

      try {
        const overview = await getGuardianStudentOverview({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          requestedStudentId: mockStudentA1.id,
        });

        assert.equal(overview.student.id, mockStudentA1.id);
        assert.equal(overview.relationship, "AYAH");
        assert.equal(overview.attendance.attendanceRate, 100);
        assert.equal(overview.attendance.presentCount, 1);
        assert.equal(overview.finance.totalPaidAmount, 500000);
        assert.equal(overview.finance.unpaidChargesCount, 0);
        assert.equal(overview.tahfidz.totalZiyadahAyat, 15);
        assert.equal(overview.tahfidz.lastRecord?.surahName, "An-Naba'");
        assert.equal(overview.dormitory.isResident, false);
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.student.findUnique = origStudentFind;
        prisma.attendanceRecord.findMany = origAttFind;
        prisma.studentCharge.findMany = origChargeFind;
        prisma.paymentTransaction.findMany = origTxFind;
        prisma.reportCard.findMany = origReportFind;
        prisma.assessmentScore.findMany = origScoreFind;
        prisma.tahfidzRecord.findMany = origTahfidzFind;
        prisma.studentDormitoryAssignment.findFirst = origDormFind;
      }
    });

    it("harus menolak akses jika wali mencoba melihat santri milik wali lain di sekolah yang sama", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      // Wali A1 mencoba akses santri A2 (milik Wali A2) -> relasi di DB null
      (prisma.guardianStudent as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentOverview({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: mockStudentA2.id,
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            assert.equal(err.status, 403);
            assert.match(err.message, /tidak memiliki hubungan wali/i);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
      }
    });

    it("harus menolak akses jika wali mencoba melihat santri di lembaga lain (cross-tenant)", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_cross",
        institutionId: tenantBId, // Lembaga berbeda
        guardianId: mockGuardianA1.id,
        studentId: mockStudentB1.id,
        relationship: "AYAH",
      });

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentOverview({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: mockStudentB1.id,
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            assert.equal(err.status, 403);
            assert.match(err.message, /institusi yang berbeda/i);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
      }
    });
  });

  describe("3. Academic Domain & Strict Report Card DRAFT Protection", () => {
    it("hanya boleh mengembalikan raport yang berstatus PUBLISHED, DRAFT wajib tersembunyi", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origReportFind = prisma.reportCard.findMany;
      const origScoreFind = prisma.assessmentScore.findMany;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
        relationship: "AYAH",
      });

      let queryFilterCaptured: any = null;
      (prisma.reportCard as any).findMany = async (args: any) => {
        queryFilterCaptured = args.where;
        return [
          {
            id: "rep_published_01",
            status: "PUBLISHED",
            semester: "ODD",
            publishedAt: new Date("2026-09-21"),
            academicYear: { name: "2025/2026" },
            classroom: { name: "Kelas 7A" },
            subjects: [{ subjectId: "sub_01", finalScore: 90 }],
          },
        ];
      };

      (prisma.assessmentScore as any).findMany = async () => [];

      try {
        const academic = await getGuardianStudentAcademic({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          requestedStudentId: mockStudentA1.id,
        });

        // Verifikasi filter query mengunci status PUBLISHED
        assert.equal(queryFilterCaptured.status, "PUBLISHED");
        assert.equal(queryFilterCaptured.studentId, mockStudentA1.id);
        assert.equal(queryFilterCaptured.institutionId, tenantAId);

        assert.equal(academic.publishedReportCards.length, 1);
        assert.equal(academic.latestPublishedReportCard?.id, "rep_published_01");
        assert.equal(academic.latestPublishedReportCard?.averageScore, 90);
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.reportCard.findMany = origReportFind;
        prisma.assessmentScore.findMany = origScoreFind;
      }
    });

    it("harus mengizinkan pembacaan snapshot frozenData untuk raport berstatus PUBLISHED", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origReportFindUnique = prisma.reportCard.findUnique;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
      });

      const mockFrozenData = {
        frozenAt: "2026-09-21T10:00:00Z",
        publishedBy: "Ustadz Hamzah",
        semester: "ODD",
        student: { id: mockStudentA1.id, fullName: "Fauzan Dahlan", nis: "2026001", nisn: null, gender: "L" },
        classroom: { id: "cls_01", name: "Kelas 7A" },
        academicYear: { id: "ay_01", name: "2025/2026" },
        notes: "Sangat baik",
        subjects: [{ subjectId: "sub_01", subjectName: "Matematika", subjectCode: "MTK", finalScore: 92, letterGrade: "A", comments: "Bagus" }],
        attendance: { present: 50, sick: 1, excused: 2, absent: 0 },
      };

      (prisma.reportCard as any).findUnique = async () => ({
        id: "rep_published_01",
        institutionId: tenantAId,
        studentId: mockStudentA1.id,
        status: "PUBLISHED",
        frozenData: JSON.stringify(mockFrozenData),
      });

      try {
        const snapshot = await getGuardianStudentReportCard({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          requestedStudentId: mockStudentA1.id,
          reportCardId: "rep_published_01",
        });

        assert.equal(snapshot.student.fullName, "Fauzan Dahlan");
        assert.equal(snapshot.subjects[0].finalScore, 92);
        assert.equal(snapshot.attendance.present, 50);
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.reportCard.findUnique = origReportFindUnique;
      }
    });

    it("harus menolak pembacaan detail jika raport masih berstatus DRAFT", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origReportFindUnique = prisma.reportCard.findUnique;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
      });

      (prisma.reportCard as any).findUnique = async () => ({
        id: "rep_draft_01",
        institutionId: tenantAId,
        studentId: mockStudentA1.id,
        status: "DRAFT", // Masih DRAFT internal
        frozenData: null,
      });

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentReportCard({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: mockStudentA1.id,
              reportCardId: "rep_draft_01",
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            assert.equal(err.status, 403);
            assert.match(err.message, /masih berupa draf internal/i);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.reportCard.findUnique = origReportFindUnique;
      }
    });
  });

  describe("4. Attendance, Finance, Tahfidz & Dormitory Scoped Queries", () => {
    it("harus menolak query presensi untuk santri yang tidak terhubung", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentAttendance({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: "std_unlinked",
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
      }
    });

    it("harus menolak query keuangan untuk santri yang tidak terhubung", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentFinance({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: "std_unlinked",
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
      }
    });

    it("harus menolak query tahfidz untuk santri yang tidak terhubung", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      (prisma.guardianStudent as any).findUnique = async () => null;

      try {
        await assert.rejects(
          async () => {
            await getGuardianStudentTahfidz({
              sessionGuardianId: mockGuardianA1.id,
              sessionInstitutionId: tenantAId,
              requestedStudentId: "std_unlinked",
            });
          },
          (err: unknown) => {
            assert(err instanceof GuardianAccessDeniedError);
            return true;
          }
        );
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
      }
    });

    it("harus mengembalikan isResident: false dengan benar untuk santri non-mukim", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origDormFind = prisma.studentDormitoryAssignment.findFirst;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
      });

      (prisma.studentDormitoryAssignment as any).findFirst = async () => null;

      try {
        const dorm = await getGuardianStudentDormitory({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          requestedStudentId: mockStudentA1.id,
        });

        assert.equal(dorm.isResident, false);
        assert.equal(dorm.assignment, null);
        assert.deepEqual(dorm.recentLivingAttendance, []);
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.studentDormitoryAssignment.findFirst = origDormFind;
      }
    });

    it("harus mengembalikan detail kamar dan penghuni untuk santri mukim", async () => {
      const origGSFind = prisma.guardianStudent.findUnique;
      const origDormFind = prisma.studentDormitoryAssignment.findFirst;
      const origAttFind = prisma.attendanceRecord.findMany;

      (prisma.guardianStudent as any).findUnique = async () => ({
        id: "gs_01",
        institutionId: tenantAId,
        guardianId: mockGuardianA1.id,
        studentId: mockStudentA1.id,
      });

      (prisma.studentDormitoryAssignment as any).findFirst = async () => ({
        id: "sda_01",
        status: "ACTIVE",
        startDate: new Date("2026-07-15"),
        room: {
          id: "room_01",
          name: "Abu Bakar 01",
          capacity: 6,
          dormitory: { name: "Gedung Asrama Putra Al-Falah" },
          assignments: [{ id: "sda_01" }, { id: "sda_02" }, { id: "sda_03" }],
        },
      });

      (prisma.attendanceRecord as any).findMany = async () => [
        {
          id: "att_liv_01",
          status: "PRESENT",
          note: null,
          session: {
            attendanceDate: new Date("2026-09-22"),
          },
        },
      ];

      try {
        const dorm = await getGuardianStudentDormitory({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          requestedStudentId: mockStudentA1.id,
        });

        assert.equal(dorm.isResident, true);
        assert.equal(dorm.assignment?.dormitoryName, "Gedung Asrama Putra Al-Falah");
        assert.equal(dorm.assignment?.roomName, "Abu Bakar 01");
        assert.equal(dorm.assignment?.currentOccupants, 3);
        assert.equal(dorm.assignment?.capacity, 6);
        assert.equal(dorm.recentLivingAttendance.length, 1);
      } finally {
        prisma.guardianStudent.findUnique = origGSFind;
        prisma.studentDormitoryAssignment.findFirst = origDormFind;
        prisma.attendanceRecord.findMany = origAttFind;
      }
    });
  });

  describe("5. Notifications Outbox Read Scoping", () => {
    it("harus menyaring notifikasi WhatsApp hanya yang ditujukan ke nomor HP wali aktif", async () => {
      const origGuardianFind = prisma.guardian.findUnique;
      const origNotifFind = prisma.notificationOutbox.findMany;

      (prisma.guardian as any).findUnique = async () => ({
        id: mockGuardianA1.id,
        institutionId: tenantAId,
        phoneWa: "6281234567890",
      });

      let queryCaptured: any = null;
      (prisma.notificationOutbox as any).findMany = async (args: any) => {
        queryCaptured = args.where;
        return [
          {
            id: "notif_01",
            templateKey: "PAYMENT_RECEIPT",
            channel: "WHATSAPP",
            recipient: "6281234567890",
            payloadJson: JSON.stringify({
              studentName: "Fauzan Dahlan",
              receiptNo: "KW-001",
              amount: 500000,
            }),
            status: "DELIVERED",
            createdAt: new Date("2026-09-05"),
          },
        ];
      };

      try {
        const notifications = await getGuardianNotifications({
          sessionGuardianId: mockGuardianA1.id,
          sessionInstitutionId: tenantAId,
          phoneWa: "6281234567890",
        });

        assert.equal(queryCaptured.institutionId, tenantAId);
        assert.equal(notifications.length, 1);
        assert.equal(notifications[0].templateKey, "PAYMENT_RECEIPT");
        assert.equal(notifications[0].payload.receiptNo, "KW-001");
      } finally {
        prisma.guardian.findUnique = origGuardianFind;
        prisma.notificationOutbox.findMany = origNotifFind;
      }
    });
  });

  describe("6. Total Exclusion from Staff RBAC & Internal Mutations", () => {
    it("sesi wali (GUARDIAN) secara mutlak ditolak jika mencoba memanggil guard RBAC staf internal", () => {
      const guardianSession = {
        subjectType: "GUARDIAN",
        guardian: mockGuardianA1,
        institution: { id: tenantAId },
      };

      assert.throws(
        () => {
          requirePermission(guardianSession, "academic:view" as any);
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert.match(err.message, /Akses ditolak: Sesi wali \(GUARDIAN\)/i);
          return true;
        }
      );

      assert.throws(
        () => {
          requireRole(guardianSession, "TEACHER");
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert.match(err.message, /tidak memiliki peran staf internal/i);
          return true;
        }
      );
    });
  });

  describe("7. Guardian Activation Action Validation", () => {
    it("harus menolak token aktivasi yang kosong atau format tidak valid", async () => {
      const res = await activateGuardianAction({ token: "terlalupendek" });
      assert.equal(res.success, false);
      assert.match((res as any).error, /minimal 32 karakter/i);
    });
  });
});
