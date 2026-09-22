import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  createAttendanceSession,
  getAttendanceSession,
  listAttendanceSessions,
  closeAttendanceSession,
  getAttendanceRoster,
  markAttendance,
  markAttendanceBatch,
  getAttendanceRecords,
  normalizeAttendanceDate,
  formatAttendanceDate,
  AttendanceSessionAlreadyExistsError,
  AttendanceSessionClosedError,
  AttendanceIncompleteError,
  AttendanceAccessDeniedError,
  InvalidAttendanceContextError,
} from "../src/lib/attendance";
import { ResourceNotFoundError } from "../src/lib/academic";
import { ValidationError } from "../src/lib/validation";

describe("Phase 3 — Attendance Core Tests", () => {
  const instAId = "inst_pesantren_al_hikmah";
  const instBId = "inst_smpit_nurul_iman";

  // Contexts
  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "attendance:view", "attendance:manage", "staff:view"],
    isSuperAdmin: false,
  };

  const teacherA1: TenantContext = {
    userId: "usr_teacher_a1",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "academic:view"], // Without academic:manage
    isSuperAdmin: false,
  };

  const teacherA2: TenantContext = {
    userId: "usr_teacher_a2",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "academic:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "attendance:view", "attendance:manage", "staff:view"],
    isSuperAdmin: false,
  };

  // In-Memory Data Store
  let inMemoryUsers: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryClassrooms: any[] = [];
  let inMemorySubjects: any[] = [];
  let inMemoryAssignments: any[] = [];
  let inMemoryStudents: any[] = [];
  let inMemoryEnrollments: any[] = [];
  let inMemorySessions: any[] = [];
  let inMemoryRecords: any[] = [];

  beforeEach(() => {
    // 1. Users
    inMemoryUsers = [
      {
        id: "usr_teacher_a1",
        institutionId: instAId,
        name: "Ust. Ahmad Fauzi",
        email: "ahmad.fauzi@alhikmah.sch.id",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
      },
      {
        id: "usr_teacher_a2",
        institutionId: instAId,
        name: "Ustzh. Siti Aminah",
        email: "siti.aminah@alhikmah.sch.id",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
      },
      {
        id: "usr_admin_a",
        institutionId: instAId,
        name: "Admin Al-Hikmah",
        email: "admin@alhikmah.sch.id",
        roles: JSON.stringify(["ADMIN"]),
        isActive: true,
      },
      {
        id: "usr_admin_b",
        institutionId: instBId,
        name: "Admin Nurul Iman",
        email: "admin@nuruliman.sch.id",
        roles: JSON.stringify(["ADMIN"]),
        isActive: true,
      },
    ];

    // 2. Academic Years
    inMemoryAcademicYears = [
      {
        id: "ay_2025_a",
        institutionId: instAId,
        name: "2025/2026 Ganjil",
        isActive: true,
      },
      {
        id: "ay_2026_a",
        institutionId: instAId,
        name: "2026/2027 Ganjil",
        isActive: false,
      },
      {
        id: "ay_2025_b",
        institutionId: instBId,
        name: "2025/2026 Ganjil B",
        isActive: true,
      },
    ];

    // 3. Classrooms
    inMemoryClassrooms = [
      {
        id: "cls_7a",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII A",
      },
      {
        id: "cls_7b",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII B",
      },
      {
        id: "cls_8a",
        institutionId: instAId,
        academicYearId: "ay_2026_a",
        name: "VIII A",
      },
      {
        id: "cls_7a_b",
        institutionId: instBId,
        academicYearId: "ay_2025_b",
        name: "VII A (Inst B)",
      },
    ];

    // 4. Subjects
    inMemorySubjects = [
      {
        id: "sub_mtk_a",
        institutionId: instAId,
        name: "Matematika",
        code: "MAT",
      },
      {
        id: "sub_ipa_a",
        institutionId: instAId,
        name: "IPA",
        code: "IPA",
      },
    ];

    // 5. Teacher Assignments
    inMemoryAssignments = [
      {
        id: "asg_mtk_7a",
        institutionId: instAId,
        teacherId: "usr_teacher_a1",
        subjectId: "sub_mtk_a",
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      },
      {
        id: "asg_ipa_7b",
        institutionId: instAId,
        teacherId: "usr_teacher_a2",
        subjectId: "sub_ipa_a",
        classroomId: "cls_7b",
        academicYearId: "ay_2025_a",
      },
      {
        id: "asg_b",
        institutionId: instBId,
        teacherId: "usr_teacher_b",
        subjectId: "sub_b",
        classroomId: "cls_7a_b",
        academicYearId: "ay_2025_b",
      },
    ];

    // 6. Students
    inMemoryStudents = [
      {
        id: "std_1",
        institutionId: instAId,
        nis: "1001",
        nisn: "0010010001",
        fullName: "Ahmad Dahlan",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_2",
        institutionId: instAId,
        nis: "1002",
        nisn: "0010010002",
        fullName: "Budi Santoso",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_3_cls7b",
        institutionId: instAId,
        nis: "1003",
        nisn: "0010010003",
        fullName: "Citra Dewi",
        gender: "P",
        status: "ACTIVE",
      },
      {
        id: "std_4_inactive",
        institutionId: instAId,
        nis: "1004",
        nisn: "0010010004",
        fullName: "Doni Alamsyah",
        gender: "L",
        status: "INACTIVE", // inactive student
      },
      {
        id: "std_inst_b",
        institutionId: instBId,
        nis: "9001",
        nisn: "0090010001",
        fullName: "Fajar Pratama (Tenant B)",
        gender: "L",
        status: "ACTIVE",
      },
    ];

    // 7. Enrollments (Sacred History Engine)
    inMemoryEnrollments = [
      {
        id: "enr_1",
        institutionId: instAId,
        studentId: "std_1",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7a",
        status: "ENROLLED",
      },
      {
        id: "enr_2",
        institutionId: instAId,
        studentId: "std_2",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7a",
        status: "ENROLLED",
      },
      {
        id: "enr_3_cls7b",
        institutionId: instAId,
        studentId: "std_3_cls7b",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7b", // Different classroom
        status: "ENROLLED",
      },
      {
        id: "enr_4_inactive",
        institutionId: instAId,
        studentId: "std_4_inactive",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7a",
        status: "ENROLLED",
      },
      {
        id: "enr_inst_b",
        institutionId: instBId,
        studentId: "std_inst_b",
        academicYearId: "ay_2025_b",
        classroomId: "cls_7a_b",
        status: "ENROLLED",
      },
    ];

    // 8. Sessions & Records
    inMemorySessions = [];
    inMemoryRecords = [];

    // ---------------------------------------------------------
    // PRISMA MOCKS
    // ---------------------------------------------------------

    // Mock TeacherAssignment
    (prisma.teacherAssignment as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const item = inMemoryAssignments.find((a) => a.id === id && (!instId || a.institutionId === instId));
      if (!item) return null;

      return {
        ...item,
        teacher: inMemoryUsers.find((u) => u.id === item.teacherId) || { name: "Guru", email: "" },
        subject: inMemorySubjects.find((s) => s.id === item.subjectId) || { name: "Mapel", code: "M" },
        classroom: inMemoryClassrooms.find((c) => c.id === item.classroomId) || { name: "Kelas" },
        academicYear: inMemoryAcademicYears.find((y) => y.id === item.academicYearId) || { name: "2025/2026" },
      };
    };

    (prisma.teacherAssignment as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemoryAssignments];
      if (where?.institutionId) filtered = filtered.filter((a) => a.institutionId === where.institutionId);
      if (where?.teacherId) filtered = filtered.filter((a) => a.teacherId === where.teacherId);
      if (where?.id?.in) filtered = filtered.filter((a) => where.id.in.includes(a.id));

      return filtered.map((item) => ({
        ...item,
        teacher: inMemoryUsers.find((u) => u.id === item.teacherId) || { name: "Guru", email: "" },
        subject: inMemorySubjects.find((s) => s.id === item.subjectId) || { name: "Mapel", code: "M" },
        classroom: inMemoryClassrooms.find((c) => c.id === item.classroomId) || { name: "Kelas" },
        academicYear: inMemoryAcademicYears.find((y) => y.id === item.academicYearId) || { name: "2025/2026" },
      }));
    };

    (prisma.teacherAssignment as any).count = async ({ where }: any) => {
      let filtered = [...inMemoryAssignments];
      if (where?.institutionId) filtered = filtered.filter((a) => a.institutionId === where.institutionId);
      if (where?.teacherId) filtered = filtered.filter((a) => a.teacherId === where.teacherId);
      return filtered.length;
    };

    // Mock Enrollment
    (prisma.enrollment as any).findFirst = async ({ where }: any) => {
      const match = inMemoryEnrollments.find((e) => {
        if (where?.institutionId && e.institutionId !== where.institutionId) return false;
        if (where?.studentId && e.studentId !== where.studentId) return false;
        if (where?.academicYearId && e.academicYearId !== where.academicYearId) return false;
        if (where?.classroomId && e.classroomId !== where.classroomId) return false;
        if (where?.status && e.status !== where.status) return false;
        return true;
      });
      if (!match) return null;
      const student = inMemoryStudents.find((s) => s.id === match.studentId);
      return { ...match, student };
    };

    (prisma.enrollment as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemoryEnrollments];
      if (where?.institutionId) filtered = filtered.filter((e) => e.institutionId === where.institutionId);
      if (where?.academicYearId) filtered = filtered.filter((e) => e.academicYearId === where.academicYearId);
      if (where?.classroomId) filtered = filtered.filter((e) => e.classroomId === where.classroomId);
      if (where?.status) filtered = filtered.filter((e) => e.status === where.status);
      if (where?.student?.status) {
        filtered = filtered.filter((e) => {
          const student = inMemoryStudents.find((s) => s.id === e.studentId);
          return student && student.status === where.student.status;
        });
      }

      return filtered.map((e) => {
        const student = inMemoryStudents.find((s) => s.id === e.studentId);
        return {
          ...e,
          student: student || { id: e.studentId, nis: "0", fullName: "Unknown", gender: "L" },
        };
      });
    };

    // Mock AttendanceSession
    (prisma.attendanceSession as any).findUnique = async ({ where }: any) => {
      let session: any = null;
      if (where?.id_institutionId) {
        session = inMemorySessions.find(
          (s) => s.id === where.id_institutionId.id && s.institutionId === where.id_institutionId.institutionId
        );
      } else if (where?.teacherAssignmentId_attendanceDate) {
        const targetDate = new Date(where.teacherAssignmentId_attendanceDate.attendanceDate).getTime();
        session = inMemorySessions.find(
          (s) =>
            s.teacherAssignmentId === where.teacherAssignmentId_attendanceDate.teacherAssignmentId &&
            new Date(s.attendanceDate).getTime() === targetDate
        );
      } else if (where?.id) {
        session = inMemorySessions.find((s) => s.id === where.id);
      }

      if (!session) return null;

      const assignment = inMemoryAssignments.find((a) => a.id === session.teacherAssignmentId);
      const records = inMemoryRecords.filter((r) => r.attendanceSessionId === session.id);

      return {
        ...session,
        teacherAssignment: assignment
          ? {
              ...assignment,
              teacher: inMemoryUsers.find((u) => u.id === assignment.teacherId) || { name: "Guru", email: "" },
              subject: inMemorySubjects.find((s) => s.id === assignment.subjectId) || { name: "Mapel" },
              classroom: inMemoryClassrooms.find((c) => c.id === assignment.classroomId) || { name: "Kelas" },
              academicYear: inMemoryAcademicYears.find((y) => y.id === assignment.academicYearId) || { name: "2025/2026" },
            }
          : null,
        records: records.map((r) => ({
          ...r,
          student: inMemoryStudents.find((s) => s.id === r.studentId) || { fullName: "Siswa", nis: "0" },
        })),
      };
    };

    (prisma.attendanceSession as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemorySessions];
      if (where?.institutionId) filtered = filtered.filter((s) => s.institutionId === where.institutionId);
      if (where?.status) filtered = filtered.filter((s) => s.status === where.status);
      if (where?.teacherAssignmentId) filtered = filtered.filter((s) => s.teacherAssignmentId === where.teacherAssignmentId);
      if (where?.teacherAssignmentId?.in) filtered = filtered.filter((s) => where.teacherAssignmentId.in.includes(s.teacherAssignmentId));
      if (where?.attendanceDate) {
        const targetDate = new Date(where.attendanceDate).getTime();
        filtered = filtered.filter((s) => new Date(s.attendanceDate).getTime() === targetDate);
      }
      if (where?.teacherAssignment) {
        filtered = filtered.filter((s) => {
          const assignment = inMemoryAssignments.find((a) => a.id === s.teacherAssignmentId);
          if (!assignment) return false;
          if (where.teacherAssignment.institutionId && assignment.institutionId !== where.teacherAssignment.institutionId) return false;
          if (where.teacherAssignment.teacherId && assignment.teacherId !== where.teacherAssignment.teacherId) return false;
          if (where.teacherAssignment.academicYearId && assignment.academicYearId !== where.teacherAssignment.academicYearId) return false;
          if (where.teacherAssignment.classroomId && assignment.classroomId !== where.teacherAssignment.classroomId) return false;
          if (where.teacherAssignment.subjectId && assignment.subjectId !== where.teacherAssignment.subjectId) return false;
          return true;
        });
      }

      return filtered.map((s) => {
        const assignment = inMemoryAssignments.find((a) => a.id === s.teacherAssignmentId);
        const records = inMemoryRecords.filter((r) => r.attendanceSessionId === s.id);
        return {
          ...s,
          teacherAssignment: assignment
            ? {
                ...assignment,
                teacher: inMemoryUsers.find((u) => u.id === assignment.teacherId) || { name: "Guru" },
                subject: inMemorySubjects.find((s) => s.id === assignment.subjectId) || { name: "Mapel" },
                classroom: inMemoryClassrooms.find((c) => c.id === assignment.classroomId) || { name: "Kelas" },
                academicYear: inMemoryAcademicYears.find((y) => y.id === assignment.academicYearId) || { name: "2025/2026" },
              }
            : null,
          records,
        };
      });
    };

    (prisma.attendanceSession as any).count = async ({ where }: any) => {
      let filtered = [...inMemorySessions];
      if (where?.institutionId) filtered = filtered.filter((s) => s.institutionId === where.institutionId);
      if (where?.status) filtered = filtered.filter((s) => s.status === where.status);
      if (where?.teacherAssignment) {
        filtered = filtered.filter((s) => {
          const assignment = inMemoryAssignments.find((a) => a.id === s.teacherAssignmentId);
          if (!assignment) return false;
          if (where.teacherAssignment.institutionId && assignment.institutionId !== where.teacherAssignment.institutionId) return false;
          if (where.teacherAssignment.teacherId && assignment.teacherId !== where.teacherAssignment.teacherId) return false;
          return true;
        });
      }
      return filtered.length;
    };

    (prisma.attendanceSession as any).create = async ({ data }: any) => {
      const record = {
        id: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        status: "OPEN",
        openedAt: new Date(),
        closedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      inMemorySessions.push(record);

      const assignment = inMemoryAssignments.find((a) => a.id === record.teacherAssignmentId);
      return {
        ...record,
        teacherAssignment: assignment
          ? {
              ...assignment,
              teacher: inMemoryUsers.find((u) => u.id === assignment.teacherId) || { name: "Guru" },
              subject: inMemorySubjects.find((s) => s.id === assignment.subjectId) || { name: "Mapel" },
              classroom: inMemoryClassrooms.find((c) => c.id === assignment.classroomId) || { name: "Kelas" },
              academicYear: inMemoryAcademicYears.find((y) => y.id === assignment.academicYearId) || { name: "2025/2026" },
            }
          : null,
      };
    };

    (prisma.attendanceSession as any).update = async ({ where, data }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const idx = inMemorySessions.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error("Session not found");
      inMemorySessions[idx] = {
        ...inMemorySessions[idx],
        ...data,
        updatedAt: new Date(),
      };
      const assignment = inMemoryAssignments.find((a) => a.id === inMemorySessions[idx].teacherAssignmentId);
      return {
        ...inMemorySessions[idx],
        teacherAssignment: assignment
          ? {
              ...assignment,
              teacher: inMemoryUsers.find((u) => u.id === assignment.teacherId) || { name: "Guru" },
              subject: inMemorySubjects.find((s) => s.id === assignment.subjectId) || { name: "Mapel" },
              classroom: inMemoryClassrooms.find((c) => c.id === assignment.classroomId) || { name: "Kelas" },
              academicYear: inMemoryAcademicYears.find((y) => y.id === assignment.academicYearId) || { name: "2025/2026" },
            }
          : null,
      };
    };

    // Mock AttendanceRecord
    (prisma.attendanceRecord as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemoryRecords];
      if (where?.institutionId) filtered = filtered.filter((r) => r.institutionId === where.institutionId);
      if (where?.attendanceSessionId) filtered = filtered.filter((r) => r.attendanceSessionId === where.attendanceSessionId);

      return filtered.map((r) => ({
        ...r,
        student: inMemoryStudents.find((s) => s.id === r.studentId) || { fullName: "Siswa", nis: "0" },
        enrollment: inMemoryEnrollments.find((e) => e.id === r.enrollmentId),
      }));
    };

    (prisma.attendanceRecord as any).upsert = async ({ where, create, update }: any) => {
      const sessionId = where?.attendanceSessionId_studentId?.attendanceSessionId;
      const studentId = where?.attendanceSessionId_studentId?.studentId;

      const existingIdx = inMemoryRecords.findIndex(
        (r) => r.attendanceSessionId === sessionId && r.studentId === studentId
      );

      if (existingIdx !== -1) {
        inMemoryRecords[existingIdx] = {
          ...inMemoryRecords[existingIdx],
          ...update,
          updatedAt: new Date(),
        };
        const student = inMemoryStudents.find((s) => s.id === inMemoryRecords[existingIdx].studentId);
        const enrollment = inMemoryEnrollments.find((e) => e.id === inMemoryRecords[existingIdx].enrollmentId);
        return { ...inMemoryRecords[existingIdx], student, enrollment };
      } else {
        const record = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        inMemoryRecords.push(record);
        const student = inMemoryStudents.find((s) => s.id === record.studentId);
        const enrollment = inMemoryEnrollments.find((e) => e.id === record.enrollmentId);
        return { ...record, student, enrollment };
      }
    };

    // Mock $transaction
    (prisma as any).$transaction = async (actions: any[]) => {
      const results = [];
      for (const action of actions) {
        results.push(await action);
      }
      return results;
    };
  });

  // -------------------------------------------------------------
  // 1. ATTENDANCE SESSION CREATION & INVARIANTS
  // -------------------------------------------------------------
  describe("1. Attendance Session Creation & Scope", () => {
    it("should allow teacher to create a valid attendance session for own assignment", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      assert.ok(session.id);
      assert.equal(session.institutionId, instAId);
      assert.equal(session.teacherAssignmentId, "asg_mtk_7a");
      assert.equal(session.status, "OPEN");
      assert.equal(formatAttendanceDate(session.attendanceDate), "2026-09-20");
    });

    it("should allow admin to create attendance session for any teacher assignment within tenant", async () => {
      const session = await createAttendanceSession(adminA, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-21",
      });

      assert.ok(session.id);
      assert.equal(session.status, "OPEN");
    });

    it("should reject duplicate session for same assignment and same date (One session per assignment per day)", async () => {
      await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      await assert.rejects(
        createAttendanceSession(teacherA1, {
          teacherAssignmentId: "asg_mtk_7a",
          attendanceDate: "2026-09-20",
        }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceSessionAlreadyExistsError);
          assert.equal(err.status, 409);
          return true;
        }
      );
    });

    it("should allow same assignment to have sessions on different dates", async () => {
      const ses1 = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });
      const ses2 = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-21",
      });

      assert.notEqual(ses1.id, ses2.id);
      assert.equal(formatAttendanceDate(ses1.attendanceDate), "2026-09-20");
      assert.equal(formatAttendanceDate(ses2.attendanceDate), "2026-09-21");
    });

    it("should reject teacher creating session for another teacher's assignment (Teacher Scope Enforcement)", async () => {
      // teacherA1 attempts to open session for teacherA2's assignment asg_ipa_7b
      await assert.rejects(
        createAttendanceSession(teacherA1, {
          teacherAssignmentId: "asg_ipa_7b",
          attendanceDate: "2026-09-20",
        }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceAccessDeniedError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("should reject creating session using assignment from another tenant (Tenant Isolation)", async () => {
      // teacherA1 attempts to open session for assignment belonging to inst_b
      await assert.rejects(
        createAttendanceSession(teacherA1, {
          teacherAssignmentId: "asg_b",
          attendanceDate: "2026-09-20",
        }),
        (err: unknown) => {
          assert.ok(err instanceof ResourceNotFoundError);
          assert.equal(err.status, 404);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------
  // 2. ROSTER INTEGRATION & SACRED ENROLLMENT DERIVATION
  // -------------------------------------------------------------
  describe("2. Roster Integration & Sacred Enrollment Derivation", () => {
    it("should load roster strictly from active Enrollments of assignment classroom and academic year", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      const rosterData = await getAttendanceRoster(teacherA1, session.id);

      assert.equal(rosterData.sessionId, session.id);
      assert.equal(rosterData.status, "OPEN");
      // std_1 and std_2 are enrolled in cls_7a and ay_2025_a.
      // std_3_cls7b is enrolled in cls_7b (excluded).
      // std_4_inactive has student.status INACTIVE (excluded).
      // std_inst_b belongs to Tenant B (excluded).
      assert.equal(rosterData.roster.length, 2);
      const studentIds = rosterData.roster.map((s) => s.studentId);
      assert.ok(studentIds.includes("std_1"));
      assert.ok(studentIds.includes("std_2"));
      assert.ok(!studentIds.includes("std_3_cls7b"), "Siswa dari rombel lain tidak boleh masuk roster");
      assert.ok(!studentIds.includes("std_4_inactive"), "Siswa non-aktif tidak boleh masuk roster");
      assert.ok(!studentIds.includes("std_inst_b"), "Siswa tenant lain tidak boleh masuk roster");

      // Verify Enrollment IDs are correctly linked
      const std1Roster = rosterData.roster.find((s) => s.studentId === "std_1")!;
      assert.equal(std1Roster.enrollmentId, "enr_1");
      assert.equal(std1Roster.status, "UNRECORDED");
    });

    it("should reject teacher loading roster for another teacher's session", async () => {
      const session2 = await createAttendanceSession(teacherA2, {
        teacherAssignmentId: "asg_ipa_7b",
        attendanceDate: "2026-09-20",
      });

      await assert.rejects(
        getAttendanceRoster(teacherA1, session2.id),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceAccessDeniedError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------
  // 3. ATTENDANCE RECORDING & BATCH MARKING
  // -------------------------------------------------------------
  describe("3. Attendance Recording & Batch Marking", () => {
    it("should successfully mark PRESENT, EXCUSED, SICK, and ABSENT", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      // Mark Student 1 as PRESENT
      const rec1 = await markAttendance(teacherA1, {
        attendanceSessionId: session.id,
        studentId: "std_1",
        status: "PRESENT",
      });
      assert.equal(rec1.status, "PRESENT");
      assert.equal(rec1.enrollmentId, "enr_1");

      // Mark Student 2 as SICK with note
      const rec2 = await markAttendance(teacherA1, {
        attendanceSessionId: session.id,
        studentId: "std_2",
        status: "SICK",
        note: "Demam berdarah",
      });
      assert.equal(rec2.status, "SICK");
      assert.equal(rec2.note, "Demam berdarah");

      // Verify updated roster reflects statuses
      const rosterData = await getAttendanceRoster(teacherA1, session.id);
      assert.equal(rosterData.summary.present, 1);
      assert.equal(rosterData.summary.sick, 1);
      assert.equal(rosterData.summary.totalUnrecorded, 0);
    });

    it("should allow batch marking for rapid attendance entry ('Semua Hadir')", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      const batchResult = await markAttendanceBatch(teacherA1, {
        attendanceSessionId: session.id,
        records: [
          { studentId: "std_1", status: "PRESENT" },
          { studentId: "std_2", status: "PRESENT" },
        ],
      });

      assert.equal(batchResult.count, 2);

      const records = await getAttendanceRecords(teacherA1, session.id);
      assert.equal(records.length, 2);
      assert.ok(records.every((r) => r.status === "PRESENT"));
    });

    it("should reject marking attendance for student from another classroom or tenant", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      // Student 3 is enrolled in VII B, not VII A
      await assert.rejects(
        markAttendance(teacherA1, {
          attendanceSessionId: session.id,
          studentId: "std_3_cls7b",
          status: "PRESENT",
        }),
        (err: unknown) => {
          assert.ok(err instanceof InvalidAttendanceContextError);
          assert.equal(err.status, 400);
          return true;
        }
      );

      // Student from Tenant B
      await assert.rejects(
        markAttendance(teacherA1, {
          attendanceSessionId: session.id,
          studentId: "std_inst_b",
          status: "PRESENT",
        }),
        (err: unknown) => {
          assert.ok(err instanceof InvalidAttendanceContextError);
          return true;
        }
      );
    });

    it("should reject invalid attendance status using Zod validation", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      await assert.rejects(
        markAttendance(teacherA1, {
          attendanceSessionId: session.id,
          studentId: "std_1",
          status: "BOLOS_TANPA_KABAR",
        }),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------
  // 4. SESSION CLOSING & IMMUTABILITY (CLOSED IS SACRED)
  // -------------------------------------------------------------
  describe("4. Session Closing & Immutability", () => {
    it("should reject closing session if eligible students are not yet fully marked", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      // Mark only std_1, leaving std_2 unrecorded
      await markAttendance(teacherA1, {
        attendanceSessionId: session.id,
        studentId: "std_1",
        status: "PRESENT",
      });

      await assert.rejects(
        closeAttendanceSession(teacherA1, { attendanceSessionId: session.id }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceIncompleteError);
          assert.equal(err.status, 400);
          assert.equal(err.missingCount, 1);
          return true;
        }
      );
    });

    it("should successfully close session when all eligible students are recorded", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      // Mark both std_1 and std_2
      await markAttendanceBatch(teacherA1, {
        attendanceSessionId: session.id,
        records: [
          { studentId: "std_1", status: "PRESENT" },
          { studentId: "std_2", status: "EXCUSED", note: "Izin lomba tahfidz" },
        ],
      });

      const closed = await closeAttendanceSession(teacherA1, { attendanceSessionId: session.id });
      assert.equal(closed.status, "CLOSED");
      assert.ok(closed.closedAt);
    });

    it("should reject closing a session that is already CLOSED", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      await markAttendanceBatch(teacherA1, {
        attendanceSessionId: session.id,
        records: [
          { studentId: "std_1", status: "PRESENT" },
          { studentId: "std_2", status: "PRESENT" },
        ],
      });

      await closeAttendanceSession(teacherA1, { attendanceSessionId: session.id });

      // Second close attempt must be rejected
      await assert.rejects(
        closeAttendanceSession(teacherA1, { attendanceSessionId: session.id }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceSessionClosedError);
          assert.equal(err.status, 400);
          return true;
        }
      );
    });

    it("should strictly enforce IMMUTABILITY: cannot edit or add records to a CLOSED session", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      await markAttendanceBatch(teacherA1, {
        attendanceSessionId: session.id,
        records: [
          { studentId: "std_1", status: "PRESENT" },
          { studentId: "std_2", status: "PRESENT" },
        ],
      });

      await closeAttendanceSession(teacherA1, { attendanceSessionId: session.id });

      // Attempt to modify an existing record in CLOSED session must be rejected
      await assert.rejects(
        markAttendance(teacherA1, {
          attendanceSessionId: session.id,
          studentId: "std_1",
          status: "ABSENT",
        }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceSessionClosedError);
          assert.equal(err.status, 400);
          return true;
        }
      );

      // Attempt batch marking on CLOSED session must be rejected
      await assert.rejects(
        markAttendanceBatch(teacherA1, {
          attendanceSessionId: session.id,
          records: [{ studentId: "std_1", status: "SICK" }],
        }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceSessionClosedError);
          return true;
        }
      );
    });

    it("should allow records of a CLOSED session to remain readable", async () => {
      const session = await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });

      await markAttendanceBatch(teacherA1, {
        attendanceSessionId: session.id,
        records: [
          { studentId: "std_1", status: "PRESENT" },
          { studentId: "std_2", status: "EXCUSED" },
        ],
      });

      await closeAttendanceSession(teacherA1, { attendanceSessionId: session.id });

      const records = await getAttendanceRecords(teacherA1, session.id);
      assert.equal(records.length, 2);

      const roster = await getAttendanceRoster(teacherA1, session.id);
      assert.equal(roster.status, "CLOSED");
      assert.equal(roster.summary.present, 1);
      assert.equal(roster.summary.excused, 1);
    });
  });

  // -------------------------------------------------------------
  // 5. SESSION HISTORY & RBAC FILTERING
  // -------------------------------------------------------------
  describe("5. Session History & RBAC Filtering", () => {
    it("should allow teacher to list only their own attendance sessions", async () => {
      // teacherA1 creates 2 sessions
      await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });
      await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-21",
      });

      // teacherA2 creates 1 session
      await createAttendanceSession(teacherA2, {
        teacherAssignmentId: "asg_ipa_7b",
        attendanceDate: "2026-09-20",
      });

      const listA1 = await listAttendanceSessions(teacherA1);
      assert.equal(listA1.total, 2);
      assert.ok(listA1.items.every((s: any) => s.teacherAssignment.teacherId === "usr_teacher_a1"));
    });

    it("should forbid teacher from explicitly filtering or querying another teacher's sessions", async () => {
      await assert.rejects(
        listAttendanceSessions(teacherA1, { teacherId: "usr_teacher_a2" }),
        (err: unknown) => {
          assert.ok(err instanceof AttendanceAccessDeniedError);
          assert.equal(err.status, 403);
          return true;
        }
      );
    });

    it("should allow admin to view all sessions across all teachers within the tenant", async () => {
      await createAttendanceSession(teacherA1, {
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: "2026-09-20",
      });
      await createAttendanceSession(teacherA2, {
        teacherAssignmentId: "asg_ipa_7b",
        attendanceDate: "2026-09-20",
      });

      const adminList = await listAttendanceSessions(adminA);
      assert.equal(adminList.total, 2);
    });

    it("should strictly enforce tenant isolation: Tenant A cannot see Tenant B sessions", async () => {
      // Create session in Tenant B
      (inMemoryAssignments.find((a) => a.id === "asg_b") as any).teacherId = "usr_admin_b";
      await createAttendanceSession(adminB, {
        teacherAssignmentId: "asg_b",
        attendanceDate: "2026-09-20",
      });

      const listA = await listAttendanceSessions(adminA);
      assert.equal(listA.total, 0, "Admin A must not see Tenant B sessions");

      const listB = await listAttendanceSessions(adminB);
      assert.equal(listB.total, 1, "Admin B sees Tenant B session");
    });
  });
});
