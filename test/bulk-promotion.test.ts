import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  createStudent,
  createAcademicYear,
  createClassroom,
  enrollStudent,
  getStudentEnrollments,
  getPromotionCandidates,
  previewBulkPromotion,
  executeBulkPromotion,
  PromotionValidationError,
  AcademicYearMismatchError,
  DuplicateEnrollmentError,
  ResourceNotFoundError,
} from "../src/lib/academic";
import { ValidationError } from "../src/lib/validation";
import { AuthorizationError } from "../src/lib/auth/permissions";

describe("Phase 1 — Bulk Promotion Workflow Tests", () => {
  const instAId = "inst_pesantren_darul_ulum";
  const instBId = "inst_smpit_al_falah";

  // Contexts
  const adminA: TenantContext = {
    userId: "usr_admin_01",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
      "classroom:view",
      "classroom:manage",
    ],
    isSuperAdmin: false,
  };

  const teacherA: TenantContext = {
    userId: "usr_teacher_01",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: [
      "student:view",
      "classroom:view",
      "academic:view",
    ], // Tidak memiliki academic:manage
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_02",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
      "classroom:view",
      "classroom:manage",
    ],
    isSuperAdmin: false,
  };

  // In-Memory Mock Database
  let inMemoryStudents: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryClassrooms: any[] = [];
  let inMemoryEnrollments: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    inMemoryStudents = [];
    inMemoryAcademicYears = [];
    inMemoryClassrooms = [];
    inMemoryEnrollments = [];
    inMemoryAuditLogs = [];

    // Mock Prisma Student
    (prisma.student as any).create = async ({ data }: any) => {
      const record = {
        id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryStudents.push(record);
      return record;
    };

    (prisma.student as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryStudents.find(
            (s) =>
              s.id === where.id_institutionId.id &&
              s.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where.institutionId_nis) {
        return (
          inMemoryStudents.find(
            (s) =>
              s.institutionId === where.institutionId_nis.institutionId &&
              s.nis === where.institutionId_nis.nis
          ) || null
        );
      }
      return null;
    };

    (prisma.student as any).findMany = async ({ where }: any) => {
      return inMemoryStudents.filter((s) => {
        if (s.institutionId !== where.institutionId) return false;
        if (where.id && where.id.in && !where.id.in.includes(s.id)) return false;
        if (where.status && s.status !== where.status) return false;
        return true;
      });
    };

    (prisma.student as any).count = async ({ where }: any) => {
      const list = await (prisma.student as any).findMany({ where });
      return list.length;
    };

    // Mock Prisma AcademicYear
    (prisma.academicYear as any).create = async ({ data }: any) => {
      const record = {
        id: `ay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAcademicYears.push(record);
      return record;
    };

    (prisma.academicYear as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryAcademicYears.find(
            (y) =>
              y.id === where.id_institutionId.id &&
              y.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      return null;
    };

    (prisma.academicYear as any).findFirst = async ({ where }: any) => {
      return (
        inMemoryAcademicYears.find(
          (y) =>
            y.institutionId === where.institutionId &&
            (where.isActive === undefined || y.isActive === where.isActive)
        ) || null
      );
    };

    (prisma.academicYear as any).findMany = async ({ where }: any) => {
      return inMemoryAcademicYears.filter((y) => y.institutionId === where.institutionId);
    };

    (prisma.academicYear as any).updateMany = async ({ where, data }: any) => {
      let count = 0;
      for (let i = 0; i < inMemoryAcademicYears.length; i++) {
        const y = inMemoryAcademicYears[i];
        if (y.institutionId === where.institutionId && (where.isActive === undefined || y.isActive === where.isActive)) {
          inMemoryAcademicYears[i] = { ...y, ...data };
          count++;
        }
      }
      return { count };
    };

    // Mock Prisma Classroom
    (prisma.classroom as any).create = async ({ data }: any) => {
      const record = {
        id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryClassrooms.push(record);
      return record;
    };

    (prisma.classroom as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryClassrooms.find(
            (c) =>
              c.id === where.id_institutionId.id &&
              c.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      return null;
    };

    (prisma.classroom as any).findMany = async ({ where }: any) => {
      return inMemoryClassrooms.filter((c) => {
        if (c.institutionId !== where.institutionId) return false;
        if (where.id && where.id.in && !where.id.in.includes(c.id)) return false;
        if (where.academicYearId && c.academicYearId !== where.academicYearId) return false;
        return true;
      });
    };

    // Mock Prisma Enrollment
    (prisma.enrollment as any).create = async ({ data }: any) => {
      const student = inMemoryStudents.find((s) => s.id === data.studentId);
      const classroom = inMemoryClassrooms.find((c) => c.id === data.classroomId);
      const academicYear = inMemoryAcademicYears.find((y) => y.id === data.academicYearId);

      const record = {
        id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        student,
        classroom,
        academicYear,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryEnrollments.push(record);
      return record;
    };

    (prisma.enrollment as any).findUnique = async ({ where }: any) => {
      if (where.id_institutionId) {
        return (
          inMemoryEnrollments.find(
            (e) =>
              e.id === where.id_institutionId.id &&
              e.institutionId === where.id_institutionId.institutionId
          ) || null
        );
      }
      if (where.studentId_academicYearId) {
        return (
          inMemoryEnrollments.find(
            (e) =>
              e.studentId === where.studentId_academicYearId.studentId &&
              e.academicYearId === where.studentId_academicYearId.academicYearId
          ) || null
        );
      }
      return null;
    };

    (prisma.enrollment as any).findMany = async ({ where }: any) => {
      return inMemoryEnrollments.filter((e) => {
        if (e.institutionId !== where.institutionId) return false;
        if (where.academicYearId && e.academicYearId !== where.academicYearId) return false;
        if (where.classroomId) {
          if (where.classroomId.in && !where.classroomId.in.includes(e.classroomId)) return false;
          if (typeof where.classroomId === "string" && e.classroomId !== where.classroomId) return false;
        }
        if (where.studentId) {
          if (where.studentId.in && !where.studentId.in.includes(e.studentId)) return false;
          if (typeof where.studentId === "string" && e.studentId !== where.studentId) return false;
        }
        if (where.student && where.student.OR) {
          const s = inMemoryStudents.find((st) => st.id === e.studentId);
          if (!s) return false;
          const search = where.student.OR[0].fullName.contains.toLowerCase();
          const matchName = s.fullName.toLowerCase().includes(search);
          const matchNis = s.nis.toLowerCase().includes(search);
          return matchName || matchNis;
        }
        return true;
      }).map((e) => {
        const student = inMemoryStudents.find((s) => s.id === e.studentId);
        const classroom = inMemoryClassrooms.find((c) => c.id === e.classroomId);
        const academicYear = inMemoryAcademicYears.find((y) => y.id === e.academicYearId);
        return {
          ...e,
          student: student || e.student,
          classroom: classroom || e.classroom,
          academicYear: academicYear || e.academicYear,
        };
      });
    };

    (prisma.enrollment as any).count = async ({ where }: any) => {
      const list = await (prisma.enrollment as any).findMany({ where });
      return list.length;
    };

    // Mock Prisma AuditLog
    (prisma.auditLog as any).create = async ({ data }: any) => {
      const record = {
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...data,
        createdAt: new Date(),
      };
      inMemoryAuditLogs.push(record);
      return record;
    };

    // Mock $transaction
    (prisma as any).$transaction = async (fn: any) => {
      return fn(prisma);
    };
  });

  // -------------------------------------------------------------------------
  // 1. Unit & Validation Tests
  // -------------------------------------------------------------------------
  describe("1. Validation & Input Rules", () => {
    it("harus menolak jika tahun ajaran asal dan target sama", async () => {
      await assert.rejects(
        async () => {
          await previewBulkPromotion(adminA, {
            sourceAcademicYearId: "ay_2025",
            targetAcademicYearId: "ay_2025",
            classroomMappings: [
              { sourceClassroomId: "cls_7a", targetClassroomId: "cls_8a" },
            ],
          });
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /Tahun ajaran target harus berbeda/);
          return true;
        }
      );
    });

    it("harus menolak jika daftar pemetaan rombel kosong", async () => {
      await assert.rejects(
        async () => {
          await previewBulkPromotion(adminA, {
            sourceAcademicYearId: "ay_2025",
            targetAcademicYearId: "ay_2026",
            classroomMappings: [],
          });
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /Minimal satu pemetaan rombel/);
          return true;
        }
      );
    });

    it("harus menolak eksekusi jika daftar siswa promosi kosong", async () => {
      await assert.rejects(
        async () => {
          await executeBulkPromotion(adminA, {
            sourceAcademicYearId: "ay_2025",
            targetAcademicYearId: "ay_2026",
            promotions: [],
          });
        },
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert.match(err.message, /Minimal satu siswa/);
          return true;
        }
      );
    });

    it("harus menolak jika rombel asal tidak sesuai dengan tahun ajaran asal (Mismatch Error)", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });
      const year3 = await createAcademicYear(adminA, { name: "2026/2027" });

      const roomYear1 = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const roomYear3 = await createClassroom(adminA, { name: "VIII A", academicYearId: year3.id });

      // Gunakan rombel milik year1 tapi sourceAcademicYearId diset ke year2
      await assert.rejects(
        async () => {
          await previewBulkPromotion(adminA, {
            sourceAcademicYearId: year2.id,
            targetAcademicYearId: year3.id,
            classroomMappings: [
              { sourceClassroomId: roomYear1.id, targetClassroomId: roomYear3.id },
            ],
          });
        },
        (err: unknown) => {
          assert(err instanceof AcademicYearMismatchError);
          return true;
        }
      );
    });

    it("harus menolak jika rombel target tidak sesuai dengan tahun ajaran target", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });

      const roomYear1A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const roomYear1B = await createClassroom(adminA, { name: "VII B", academicYearId: year1.id });

      // Rombel target (roomYear1B) terdaftar di year1, bukan year2
      await assert.rejects(
        async () => {
          await previewBulkPromotion(adminA, {
            sourceAcademicYearId: year1.id,
            targetAcademicYearId: year2.id,
            classroomMappings: [
              { sourceClassroomId: roomYear1A.id, targetClassroomId: roomYear1B.id },
            ],
          });
        },
        (err: unknown) => {
          assert(err instanceof AcademicYearMismatchError);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Candidate Query & Preview Tests
  // -------------------------------------------------------------------------
  describe("2. Candidate Query & Preview Validation", () => {
    it("harus mengambil daftar calon siswa kenaikan kelas dengan status target yang akurat", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });

      const s1 = await createStudent(adminA, { fullName: "Ahmad Santoso", nis: "202401", gender: "L" });
      const s2 = await createStudent(adminA, { fullName: "Budi Pratama", nis: "202402", gender: "L" });

      await enrollStudent(adminA, { studentId: s1.id, academicYearId: year1.id, classroomId: room7A.id });
      await enrollStudent(adminA, { studentId: s2.id, academicYearId: year1.id, classroomId: room7A.id });

      // s2 sudah pernah didaftarkan duluan di target year2
      await enrollStudent(adminA, { studentId: s2.id, academicYearId: year2.id, classroomId: room8A.id });

      const candidates = await getPromotionCandidates(adminA, {
        sourceAcademicYearId: year1.id,
        sourceClassroomId: room7A.id,
        targetAcademicYearId: year2.id,
      });

      assert.equal(candidates.total, 2);
      const c1 = candidates.data.find((c) => c.studentId === s1.id);
      const c2 = candidates.data.find((c) => c.studentId === s2.id);

      assert.equal(c1?.isAlreadyEnrolledInTarget, false);
      assert.equal(c2?.isAlreadyEnrolledInTarget, true);
    });

    it("harus mengklasifikasikan siswa ke dalam status READY, WARNING, dan ERROR pada prapinjau", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });

      // s1: Siswa aktif biasa (READY)
      const s1 = await createStudent(adminA, { fullName: "Ahmad", nis: "202401", gender: "L", status: "ACTIVE" });
      // s2: Siswa nonaktif (WARNING)
      const s2 = await createStudent(adminA, { fullName: "Budi", nis: "202402", gender: "L", status: "INACTIVE" });
      // s3: Siswa yang sudah terdaftar di target (ERROR)
      const s3 = await createStudent(adminA, { fullName: "Citra", nis: "202403", gender: "P", status: "ACTIVE" });

      await enrollStudent(adminA, { studentId: s1.id, academicYearId: year1.id, classroomId: room7A.id });
      await enrollStudent(adminA, { studentId: s2.id, academicYearId: year1.id, classroomId: room7A.id });
      await enrollStudent(adminA, { studentId: s3.id, academicYearId: year1.id, classroomId: room7A.id });

      // Daftarkan s3 di tahun ajaran target
      await enrollStudent(adminA, { studentId: s3.id, academicYearId: year2.id, classroomId: room8A.id });

      const preview = await previewBulkPromotion(adminA, {
        sourceAcademicYearId: year1.id,
        targetAcademicYearId: year2.id,
        classroomMappings: [
          { sourceClassroomId: room7A.id, targetClassroomId: room8A.id },
        ],
      });

      assert.equal(preview.totalStudents, 3);
      assert.equal(preview.readyCount, 1, "Harus ada 1 siswa READY (Ahmad)");
      assert.equal(preview.warningCount, 1, "Harus ada 1 siswa WARNING (Budi - status INACTIVE)");
      assert.equal(preview.errorCount, 1, "Harus ada 1 siswa ERROR (Citra - sudah di target)");

      const rowAhmad = preview.rows.find((r) => r.studentId === s1.id);
      const rowBudi = preview.rows.find((r) => r.studentId === s2.id);
      const rowCitra = preview.rows.find((r) => r.studentId === s3.id);

      assert.equal(rowAhmad?.status, "READY");
      assert.equal(rowBudi?.status, "WARNING");
      assert.match(rowBudi?.message || "", /INACTIVE/);
      assert.equal(rowCitra?.status, "ERROR");
      assert.match(rowCitra?.message || "", /Target enrollment sudah ada/);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Integration & Execution Tests
  // -------------------------------------------------------------------------
  describe("3. Execution & Sacred Historical Integrity", () => {
    it("harus berhasil mempromosikan siswa secara massal dan mempertahankan histori lama utuh", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025", isActive: false });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026", isActive: true });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room7B = await createClassroom(adminA, { name: "VII B", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });
      const room8B = await createClassroom(adminA, { name: "VIII B", academicYearId: year2.id });

      const s1 = await createStudent(adminA, { fullName: "Ahmad", nis: "202401", gender: "L" });
      const s2 = await createStudent(adminA, { fullName: "Budi", nis: "202402", gender: "L" });
      const s3 = await createStudent(adminA, { fullName: "Citra", nis: "202403", gender: "P" });

      // Enroll awal di Tahun 1
      await enrollStudent(adminA, { studentId: s1.id, academicYearId: year1.id, classroomId: room7A.id });
      await enrollStudent(adminA, { studentId: s2.id, academicYearId: year1.id, classroomId: room7A.id });
      await enrollStudent(adminA, { studentId: s3.id, academicYearId: year1.id, classroomId: room7B.id });

      // Eksekusi Bulk Promotion dengan multi-classroom mapping:
      // VII A -> VIII A (Ahmad, Budi)
      // VII B -> VIII B (Citra)
      const result = await executeBulkPromotion(adminA, {
        sourceAcademicYearId: year1.id,
        targetAcademicYearId: year2.id,
        promotions: [
          { studentId: s1.id, targetClassroomId: room8A.id },
          { studentId: s2.id, targetClassroomId: room8A.id },
          { studentId: s3.id, targetClassroomId: room8B.id },
        ],
      });

      assert.equal(result.success, true);
      assert.equal(result.totalPromoted, 3);
      assert(result.auditLogId, "Audit log wajib terbuat");

      // Cek Sacred History untuk Ahmad:
      const historyS1 = await getStudentEnrollments(adminA, s1.id);
      assert.equal(historyS1.length, 2, "Ahmad harus memiliki 2 rekam jejak enrollment");

      const oldEnrollment = historyS1.find((h) => h.academicYearId === year1.id);
      const newEnrollment = historyS1.find((h) => h.academicYearId === year2.id);

      assert(oldEnrollment, "Histori enrollment lama di 2024/2025 tetap ada");
      assert.equal(oldEnrollment.classroomId, room7A.id, "Rombel lama tetap VII A");

      assert(newEnrollment, "Enrollment baru di 2025/2026 terbuat");
      assert.equal(newEnrollment.classroomId, room8A.id, "Rombel baru adalah VIII A");

      // Cek Citra di VIII B:
      const historyS3 = await getStudentEnrollments(adminA, s3.id);
      assert.equal(historyS3.length, 2);
      const newEnrollmentS3 = historyS3.find((h) => h.academicYearId === year2.id);
      assert.equal(newEnrollmentS3?.classroomId, room8B.id);

      // Cek AuditLog entry
      const audit = inMemoryAuditLogs.find((a) => a.id === result.auditLogId);
      assert(audit, "AuditLog harus tersimpan di database");
      assert.equal(audit.action, "BULK_PROMOTION");
      assert.equal(audit.institutionId, instAId);
      assert.equal(audit.userId, adminA.userId);
      const details = JSON.parse(audit.detailsJson);
      assert.equal(details.totalPromoted, 3);
      assert.equal(details.sourceAcademicYearId, year1.id);
      assert.equal(details.targetAcademicYearId, year2.id);
    });

    it("harus menolak eksekusi ganda (Idempotency) dan mencegah duplikasi enrollment", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });

      const student = await createStudent(adminA, { fullName: "Ahmad", nis: "202401", gender: "L" });
      await enrollStudent(adminA, { studentId: student.id, academicYearId: year1.id, classroomId: room7A.id });

      // Promosi pertama kali
      await executeBulkPromotion(adminA, {
        sourceAcademicYearId: year1.id,
        targetAcademicYearId: year2.id,
        promotions: [{ studentId: student.id, targetClassroomId: room8A.id }],
      });

      // Promosi kedua kali (misal double submit / double click)
      await assert.rejects(
        async () => {
          await executeBulkPromotion(adminA, {
            sourceAcademicYearId: year1.id,
            targetAcademicYearId: year2.id,
            promotions: [{ studentId: student.id, targetClassroomId: room8A.id }],
          });
        },
        (err: unknown) => {
          assert(err instanceof DuplicateEnrollmentError);
          return true;
        }
      );

      // Pastikan total enrollment untuk siswa ini tetap tepat 2
      const history = await getStudentEnrollments(adminA, student.id);
      assert.equal(history.length, 2, "Tidak boleh ada duplikasi enrollment di tahun target");
    });

    it("harus menolak promosi siswa nonaktif jika allowWarnings=false", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });

      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });

      const student = await createStudent(adminA, { fullName: "Budi Nonaktif", nis: "202499", gender: "L", status: "INACTIVE" });
      await enrollStudent(adminA, { studentId: student.id, academicYearId: year1.id, classroomId: room7A.id });

      // Default: allowWarnings false -> ditolak
      await assert.rejects(
        async () => {
          await executeBulkPromotion(adminA, {
            sourceAcademicYearId: year1.id,
            targetAcademicYearId: year2.id,
            promotions: [{ studentId: student.id, targetClassroomId: room8A.id }],
            allowWarnings: false,
          });
        },
        (err: unknown) => {
          assert(err instanceof PromotionValidationError);
          assert.match(err.message, /INACTIVE/);
          return true;
        }
      );

      // Jika allowWarnings true -> berhasil
      const res = await executeBulkPromotion(adminA, {
        sourceAcademicYearId: year1.id,
        targetAcademicYearId: year2.id,
        promotions: [{ studentId: student.id, targetClassroomId: room8A.id }],
        allowWarnings: true,
      });

      assert.equal(res.success, true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Security & RBAC Tests
  // -------------------------------------------------------------------------
  describe("4. Security, RBAC & Tenant Isolation", () => {
    it("harus menolak eksekusi promosi oleh user tanpa izin academic:manage (RBAC)", async () => {
      const year1 = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2 = await createAcademicYear(adminA, { name: "2025/2026" });
      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2.id });
      const student = await createStudent(adminA, { fullName: "Ahmad", nis: "202401", gender: "L" });

      // teacherA tidak memiliki academic:manage
      await assert.rejects(
        async () => {
          await executeBulkPromotion(teacherA, {
            sourceAcademicYearId: year1.id,
            targetAcademicYearId: year2.id,
            promotions: [{ studentId: student.id, targetClassroomId: room8A.id }],
          });
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.code, "FORBIDDEN_INSUFFICIENT_PERMISSION");
          return true;
        }
      );
    });

    it("harus menolak cross-tenant promotion (Admin A mencoba mempromosikan siswa milik Sekolah B)", async () => {
      const year1A = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2A = await createAcademicYear(adminA, { name: "2025/2026" });
      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1A.id });
      const room8A = await createClassroom(adminA, { name: "VIII A", academicYearId: year2A.id });

      // Siswa didaftarkan di institusi B
      const studentB = await createStudent(adminB, { fullName: "Siswa Sekolah B", nis: "2024B01", gender: "L" });

      // Admin A mencoba mempromosikan studentB
      await assert.rejects(
        async () => {
          await executeBulkPromotion(adminA, {
            sourceAcademicYearId: year1A.id,
            targetAcademicYearId: year2A.id,
            promotions: [{ studentId: studentB.id, targetClassroomId: room8A.id }],
          });
        },
        (err: unknown) => {
          assert(err instanceof PromotionValidationError);
          assert.match(err.message, /tidak ditemukan di lembaga ini/);
          return true;
        }
      );
    });

    it("harus menolak promosi jika rombel target milik lembaga lain", async () => {
      const year1A = await createAcademicYear(adminA, { name: "2024/2025" });
      const year2A = await createAcademicYear(adminA, { name: "2025/2026" });
      const room7A = await createClassroom(adminA, { name: "VII A", academicYearId: year1A.id });

      // Rombel target dibuat oleh Sekolah B
      const year2B = await createAcademicYear(adminB, { name: "2025/2026" });
      const room8B_Foreign = await createClassroom(adminB, { name: "VIII B Sekolah B", academicYearId: year2B.id });

      const studentA = await createStudent(adminA, { fullName: "Ahmad", nis: "202401", gender: "L" });
      await enrollStudent(adminA, { studentId: studentA.id, academicYearId: year1A.id, classroomId: room7A.id });

      // Admin A mencoba memetakan ke rombel milik Sekolah B
      await assert.rejects(
        async () => {
          await previewBulkPromotion(adminA, {
            sourceAcademicYearId: year1A.id,
            targetAcademicYearId: year2A.id,
            classroomMappings: [
              { sourceClassroomId: room7A.id, targetClassroomId: room8B_Foreign.id },
            ],
          });
        },
        (err: unknown) => {
          assert(err instanceof ResourceNotFoundError);
          assert.match(err.message, /Rombel Target/);
          return true;
        }
      );
    });
  });
});
