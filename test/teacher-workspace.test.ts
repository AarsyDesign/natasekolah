import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  getTeacherWorkspaceSummary,
  getTeacherClassDetail,
  getTeacherStudentAcademicSummary,
} from "../src/lib/teaching/workspace-service";
import {
  createAttendanceSession,
  getAttendanceSession,
  closeAttendanceSession,
} from "../src/lib/attendance";
import {
  createAssessment,
  getAssessment,
} from "../src/lib/formal-academic";
import {
  TeacherAssignmentAccessDeniedError,
  ResourceNotFoundError,
} from "../src/lib/teaching/types";
import {
  AttendanceAccessDeniedError,
  AttendanceSessionClosedError,
} from "../src/lib/attendance/types";
import {
  AssessmentOwnershipError,
  FormalAcademicError,
} from "../src/lib/formal-academic/types";
import { DomainFeatureDisabledError } from "../src/lib/plugins/guard";
import { PLUGINS } from "../src/lib/plugins/registry";
import { normalizeAttendanceDate } from "../src/lib/attendance/types";

function createMockPrismaTeacherWorkspace() {
  const usersStore = new Map<string, any>();
  const institutionsStore = new Map<string, any>();
  const academicYearsStore = new Map<string, any>();
  const classroomsStore = new Map<string, any>();
  const subjectsStore = new Map<string, any>();
  const assignmentsStore = new Map<string, any>();
  const enrollmentsStore = new Map<string, any>();
  const studentsStore = new Map<string, any>();
  const attendanceSessionsStore = new Map<string, any>();
  const attendanceRecordsStore = new Map<string, any>();
  const assessmentsStore = new Map<string, any>();
  const scoresStore = new Map<string, any>();

  // Pre-seed Institutions
  institutionsStore.set("inst_a", {
    id: "inst_a",
    name: "Pesantren A",
    enabledPlugins: JSON.stringify([PLUGINS.FORMAL_ACADEMIC, PLUGINS.TAHFIDZ]),
  });

  institutionsStore.set("inst_no_academic", {
    id: "inst_no_academic",
    name: "Pesantren Salaf (No Formal Academic)",
    enabledPlugins: JSON.stringify([PLUGINS.PESANTREN_LIVING, PLUGINS.TAHFIDZ]),
  });

  institutionsStore.set("inst_b", {
    id: "inst_b",
    name: "SMP B",
    enabledPlugins: JSON.stringify([PLUGINS.FORMAL_ACADEMIC]),
  });

  // Pre-seed Academic Years
  academicYearsStore.set("ay_2026_a", {
    id: "ay_2026_a",
    institutionId: "inst_a",
    name: "2026/2027",
    isActive: true,
  });

  academicYearsStore.set("ay_2026_b", {
    id: "ay_2026_b",
    institutionId: "inst_b",
    name: "2026/2027",
    isActive: true,
  });

  academicYearsStore.set("ay_2025_past", {
    id: "ay_2025_past",
    institutionId: "inst_a",
    name: "2025/2026",
    isActive: false,
  });

  // Pre-seed Classrooms
  classroomsStore.set("cls_7a", {
    id: "cls_7a",
    institutionId: "inst_a",
    name: "Kelas 7A",
    academicYearId: "ay_2026_a",
  });

  classroomsStore.set("cls_7b", {
    id: "cls_7b",
    institutionId: "inst_a",
    name: "Kelas 7B",
    academicYearId: "ay_2026_a",
  });

  classroomsStore.set("cls_b1", {
    id: "cls_b1",
    institutionId: "inst_b",
    name: "Kelas 8A",
    academicYearId: "ay_2026_b",
  });

  // Pre-seed Subjects
  subjectsStore.set("sbj_mtk", {
    id: "sbj_mtk",
    institutionId: "inst_a",
    name: "Matematika",
    code: "MTK",
    category: "UMUM",
  });

  subjectsStore.set("sbj_ipa", {
    id: "sbj_ipa",
    institutionId: "inst_a",
    name: "Ilmu Pengetahuan Alam",
    code: "IPA",
    category: "UMUM",
  });

  // Pre-seed Teachers (Users)
  usersStore.set("usr_teacher_1", {
    id: "usr_teacher_1",
    institutionId: "inst_a",
    name: "Ustadz Zaid",
    email: "zaid@example.com",
    roles: JSON.stringify(["TEACHER"]),
    isActive: true,
  });

  usersStore.set("usr_teacher_2", {
    id: "usr_teacher_2",
    institutionId: "inst_a",
    name: "Ustadz Umar",
    email: "umar@example.com",
    roles: JSON.stringify(["TEACHER"]),
    isActive: true,
  });

  usersStore.set("usr_teacher_empty", {
    id: "usr_teacher_empty",
    institutionId: "inst_a",
    name: "Ustadz Baru",
    email: "baru@example.com",
    roles: JSON.stringify(["TEACHER"]),
    isActive: true,
  });

  usersStore.set("usr_teacher_b", {
    id: "usr_teacher_b",
    institutionId: "inst_b",
    name: "Guru B",
    email: "gurub@example.com",
    roles: JSON.stringify(["TEACHER"]),
    isActive: true,
  });

  // Pre-seed Assignments
  // Teacher 1 teaches MTK in 7A and IPA in 7A
  assignmentsStore.set("asg_t1_mtk_7a", {
    id: "asg_t1_mtk_7a",
    institutionId: "inst_a",
    teacherId: "usr_teacher_1",
    subjectId: "sbj_mtk",
    classroomId: "cls_7a",
    academicYearId: "ay_2026_a",
  });

  assignmentsStore.set("asg_t1_ipa_7a", {
    id: "asg_t1_ipa_7a",
    institutionId: "inst_a",
    teacherId: "usr_teacher_1",
    subjectId: "sbj_ipa",
    classroomId: "cls_7a",
    academicYearId: "ay_2026_a",
  });

  // Teacher 2 teaches MTK in 7B
  assignmentsStore.set("asg_t2_mtk_7b", {
    id: "asg_t2_mtk_7b",
    institutionId: "inst_a",
    teacherId: "usr_teacher_2",
    subjectId: "sbj_mtk",
    classroomId: "cls_7b",
    academicYearId: "ay_2026_a",
  });

  // Pre-seed Students & Enrollments in 7A
  studentsStore.set("std_1", {
    id: "std_1",
    institutionId: "inst_a",
    fullName: "Ahmad Santri",
    nis: "1001",
    nisn: "0011223344",
    gender: "MALE",
    status: "ACTIVE",
  });

  studentsStore.set("std_2", {
    id: "std_2",
    institutionId: "inst_a",
    fullName: "Bilal Santri",
    nis: "1002",
    nisn: "0011223355",
    gender: "MALE",
    status: "ACTIVE",
  });

  // Student in 7B
  studentsStore.set("std_3", {
    id: "std_3",
    institutionId: "inst_a",
    fullName: "Cahyo Santri",
    nis: "1003",
    nisn: null,
    gender: "MALE",
    status: "ACTIVE",
  });

  enrollmentsStore.set("std_1_ay_2026_a", {
    id: "enr_1",
    institutionId: "inst_a",
    studentId: "std_1",
    classroomId: "cls_7a",
    academicYearId: "ay_2026_a",
    status: "ENROLLED",
  });

  enrollmentsStore.set("std_2_ay_2026_a", {
    id: "enr_2",
    institutionId: "inst_a",
    studentId: "std_2",
    classroomId: "cls_7a",
    academicYearId: "ay_2026_a",
    status: "ENROLLED",
  });

  enrollmentsStore.set("std_3_ay_2026_a", {
    id: "enr_3",
    institutionId: "inst_a",
    studentId: "std_3",
    classroomId: "cls_7b",
    academicYearId: "ay_2026_a",
    status: "ENROLLED",
  });

  // Helper to populate assignment relations
  const populateAssignment = (asg: any) => {
    if (!asg) return null;
    return {
      ...asg,
      subject: subjectsStore.get(asg.subjectId) || { id: asg.subjectId, name: "Subj", code: null, category: "UMUM" },
      classroom: classroomsStore.get(asg.classroomId) || { id: asg.classroomId, name: "Class" },
      academicYear: academicYearsStore.get(asg.academicYearId) || { id: asg.academicYearId, name: "AY" },
      teacher: usersStore.get(asg.teacherId) || { id: asg.teacherId, name: "Teacher", email: "t@ex.com" },
    };
  };

  const mock: any = {
    institution: {
      findUnique: async ({ where }: any) => institutionsStore.get(where.id) || null,
    },
    academicYear: {
      findFirst: async ({ where }: any) => {
        for (const ay of academicYearsStore.values()) {
          if (
            ay.institutionId === where.institutionId &&
            (where.isActive === undefined || ay.isActive === where.isActive)
          ) {
            return ay;
          }
        }
        return null;
      },
    },
    user: {
      findUnique: async ({ where }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const instId = where.id_institutionId ? where.id_institutionId.institutionId : undefined;
        const u = usersStore.get(id);
        if (u && (!instId || u.institutionId === instId)) return u;
        return null;
      },
    },
    teacherAssignment: {
      findUnique: async ({ where }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const instId = where.id_institutionId ? where.id_institutionId.institutionId : undefined;
        const asg = assignmentsStore.get(id);
        if (asg && (!instId || asg.institutionId === instId)) {
          return populateAssignment(asg);
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const results: any[] = [];
        for (const asg of assignmentsStore.values()) {
          if (where.institutionId && asg.institutionId !== where.institutionId) continue;
          if (where.teacherId && asg.teacherId !== where.teacherId) continue;
          results.push(populateAssignment(asg));
        }
        return results;
      },
    },
    enrollment: {
      count: async ({ where }: any) => {
        let count = 0;
        for (const enr of enrollmentsStore.values()) {
          if (where.institutionId && enr.institutionId !== where.institutionId) continue;
          if (where.classroomId && enr.classroomId !== where.classroomId) continue;
          if (where.academicYearId && enr.academicYearId !== where.academicYearId) continue;
          if (where.status && enr.status !== where.status) continue;
          count++;
        }
        return count;
      },
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const enr of enrollmentsStore.values()) {
          if (where.institutionId && enr.institutionId !== where.institutionId) continue;
          if (where.classroomId && enr.classroomId !== where.classroomId) continue;
          if (where.academicYearId && enr.academicYearId !== where.academicYearId) continue;
          if (where.status && enr.status !== where.status) continue;

          const std = studentsStore.get(enr.studentId);
          list.push({
            ...enr,
            student: std,
          });
        }
        return list;
      },
      findUnique: async ({ where }: any) => {
        const key = `${where.studentId_academicYearId?.studentId}_${where.studentId_academicYearId?.academicYearId}`;
        const enr = enrollmentsStore.get(key);
        if (!enr) return null;
        return {
          ...enr,
          student: studentsStore.get(enr.studentId),
          classroom: classroomsStore.get(enr.classroomId),
          academicYear: academicYearsStore.get(enr.academicYearId),
        };
      },
      findFirst: async ({ where }: any) => {
        for (const enr of enrollmentsStore.values()) {
          if (where.institutionId && enr.institutionId !== where.institutionId) continue;
          if (where.studentId && enr.studentId !== where.studentId) continue;
          if (where.classroomId && enr.classroomId !== where.classroomId) continue;
          if (where.academicYearId && enr.academicYearId !== where.academicYearId) continue;
          return {
            ...enr,
            student: studentsStore.get(enr.studentId),
          };
        }
        return null;
      },
    },
    attendanceSession: {
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const s of attendanceSessionsStore.values()) {
          if (where.institutionId && s.institutionId !== where.institutionId) continue;
          if (where.teacherAssignmentId) {
            if (typeof where.teacherAssignmentId === "string" && s.teacherAssignmentId !== where.teacherAssignmentId) continue;
            if (where.teacherAssignmentId.in && !where.teacherAssignmentId.in.includes(s.teacherAssignmentId)) continue;
          }
          const recs: any[] = [];
          for (const r of attendanceRecordsStore.values()) {
            if (r.sessionId === s.id) {
              if (where.records?.where?.studentId && r.studentId !== where.records.where.studentId) continue;
              recs.push(r);
            }
          }
          list.push({ ...s, records: recs });
        }
        return list;
      },
      findUnique: async ({ where }: any) => {
        if (where.id_institutionId) {
          const s = attendanceSessionsStore.get(where.id_institutionId.id);
          if (s && s.institutionId === where.id_institutionId.institutionId) {
            const recs: any[] = [];
            for (const r of attendanceRecordsStore.values()) {
              if (r.sessionId === s.id) recs.push(r);
            }
            return {
              ...s,
              teacherAssignment: populateAssignment(assignmentsStore.get(s.teacherAssignmentId)),
              records: recs,
            };
          }
        }
        if (where.teacherAssignmentId_attendanceDate) {
          for (const s of attendanceSessionsStore.values()) {
            if (
              s.teacherAssignmentId === where.teacherAssignmentId_attendanceDate.teacherAssignmentId &&
              s.attendanceDate.getTime() === where.teacherAssignmentId_attendanceDate.attendanceDate.getTime()
            ) {
              return s;
            }
          }
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = `att_sess_${Date.now()}_${Math.random()}`;
        const newSess = {
          id,
          ...data,
          status: data.status || "OPEN",
          records: [],
        };
        attendanceSessionsStore.set(id, newSess);
        return {
          ...newSess,
          teacherAssignment: populateAssignment(assignmentsStore.get(data.teacherAssignmentId)),
        };
      },
      update: async ({ where, data }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const s = attendanceSessionsStore.get(id);
        if (!s) return null;
        Object.assign(s, data);
        return s;
      },
    },
    assessment: {
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const asm of assessmentsStore.values()) {
          if (where.institutionId && asm.institutionId !== where.institutionId) continue;
          if (where.teacherAssignmentId) {
            if (typeof where.teacherAssignmentId === "string" && asm.teacherAssignmentId !== where.teacherAssignmentId) continue;
            if (where.teacherAssignmentId.in && !where.teacherAssignmentId.in.includes(asm.teacherAssignmentId)) continue;
          }
          const scs: any[] = [];
          for (const sc of scoresStore.values()) {
            if (sc.assessmentId === asm.id) {
              if (where.scores?.where?.studentId && sc.studentId !== where.scores.where.studentId) continue;
              scs.push(sc);
            }
          }
          list.push({
            ...asm,
            scores: scs,
            _count: { scores: scs.length },
          });
        }
        return list;
      },
      findUnique: async ({ where }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const asm = assessmentsStore.get(id);
        if (!asm) return null;
        return {
          ...asm,
          teacherAssignment: populateAssignment(assignmentsStore.get(asm.teacherAssignmentId)),
          _count: { scores: 0 },
        };
      },
      create: async ({ data }: any) => {
        const id = `asm_${Date.now()}_${Math.random()}`;
        const newAsm = {
          id,
          ...data,
          scores: [],
          _count: { scores: 0 },
        };
        assessmentsStore.set(id, newAsm);
        return newAsm;
      },
    },
    attendanceRecord: {
      create: async ({ data }: any) => {
        const id = `rec_${Date.now()}_${Math.random()}`;
        const newRec = { id, ...data };
        attendanceRecordsStore.set(id, newRec);
        return newRec;
      },
    },
    assessmentScore: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.assessmentId_studentId.assessmentId}_${where.assessmentId_studentId.studentId}`;
        const existing = scoresStore.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        } else {
          const id = `sc_${Date.now()}`;
          const newSc = { id, ...create };
          scoresStore.set(key, newSc);
          return newSc;
        }
      },
    },
  };

  return {
    mockPrisma: mock,
    stores: {
      usersStore,
      institutionsStore,
      academicYearsStore,
      classroomsStore,
      subjectsStore,
      assignmentsStore,
      enrollmentsStore,
      studentsStore,
      attendanceSessionsStore,
      attendanceRecordsStore,
      assessmentsStore,
      scoresStore,
    },
  };
}

describe("Milestone — Teacher Workspace & Academic Operations Tests", () => {
  const teacher1Ctx: TenantContext = {
    userId: "usr_teacher_1",
    institutionId: "inst_a",
    roles: ["TEACHER"],
    permissions: ["academic:view", "attendance:view", "attendance:manage"],
    isSuperAdmin: false,
  };

  const teacher2Ctx: TenantContext = {
    userId: "usr_teacher_2",
    institutionId: "inst_a",
    roles: ["TEACHER"],
    permissions: ["academic:view", "attendance:view", "attendance:manage"],
    isSuperAdmin: false,
  };

  const teacherEmptyCtx: TenantContext = {
    userId: "usr_teacher_empty",
    institutionId: "inst_a",
    roles: ["TEACHER"],
    permissions: ["academic:view", "attendance:view"],
    isSuperAdmin: false,
  };

  const teacherTenantBCtx: TenantContext = {
    userId: "usr_teacher_b",
    institutionId: "inst_b",
    roles: ["TEACHER"],
    permissions: ["academic:view", "attendance:view"],
    isSuperAdmin: false,
  };

  const adminCtx: TenantContext = {
    userId: "usr_admin_a",
    institutionId: "inst_a",
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "attendance:view", "attendance:manage"],
    isSuperAdmin: false,
  };

  describe("1. Teacher Workspace Summary & Resource Scope", () => {
    it("harus menyajikan ringkasan penugasan mengajar milik guru yang login", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const summary = await getTeacherWorkspaceSummary(teacher1Ctx, mockPrisma);

      assert.equal(summary.teacher.name, "Ustadz Zaid");
      assert.equal(summary.activeAcademicYear?.name, "2026/2027");
      assert.equal(summary.metrics.totalAssignments, 2); // MTK 7A & IPA 7A
      assert.equal(summary.metrics.totalClasses, 1); // Only 7A
      assert.equal(summary.metrics.totalSubjects, 2); // MTK & IPA
      assert.equal(summary.metrics.totalStudentsTaught, 4); // 2 in MTK + 2 in IPA
      assert.equal(summary.isFormalAcademicEnabled, true);

      // Verify assignments items
      assert.equal(summary.assignments.length, 2);
      const subjectNames = summary.assignments.map((a) => a.subjectName);
      assert.ok(subjectNames.includes("Matematika"));
      assert.ok(subjectNames.includes("Ilmu Pengetahuan Alam"));
    });

    it("guru tidak boleh melihat assignment milik guru lain dalam ringkasan", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const summaryT2 = await getTeacherWorkspaceSummary(teacher2Ctx, mockPrisma);

      assert.equal(summaryT2.teacher.name, "Ustadz Umar");
      assert.equal(summaryT2.metrics.totalAssignments, 1); // Only MTK 7B
      assert.equal(summaryT2.assignments[0].classroomName, "Kelas 7B");

      // Pastikan assignment milik Teacher 1 (7A) tidak bocor ke Teacher 2
      const t2AssignmentIds = summaryT2.assignments.map((a) => a.id);
      assert.ok(!t2AssignmentIds.includes("asg_t1_mtk_7a"));
      assert.ok(!t2AssignmentIds.includes("asg_t1_ipa_7a"));
    });

    it("harus menangani guru tanpa penugasan mengajar secara aman (empty state)", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const summary = await getTeacherWorkspaceSummary(teacherEmptyCtx, mockPrisma);

      assert.equal(summary.teacher.name, "Ustadz Baru");
      assert.equal(summary.metrics.totalAssignments, 0);
      assert.equal(summary.metrics.totalClasses, 0);
      assert.equal(summary.metrics.totalSubjects, 0);
      assert.equal(summary.metrics.totalStudentsTaught, 0);
      assert.deepEqual(summary.assignments, []);
    });

    it("harus menegakkan isolasi tenant: guru Tenant B tidak melihat data Tenant A", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const summaryB = await getTeacherWorkspaceSummary(teacherTenantBCtx, mockPrisma);

      assert.equal(summaryB.metrics.totalAssignments, 0);
      assert.deepEqual(summaryB.assignments, []);
    });
  });

  describe("2. Student Class View & Enrollment Scope", () => {
    it("guru dapat melihat daftar santri di rombel assignment miliknya", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const detail = await getTeacherClassDetail(teacher1Ctx, "asg_t1_mtk_7a", mockPrisma);

      assert.equal(detail.assignment.classroomName, "Kelas 7A");
      assert.equal(detail.assignment.subjectName, "Matematika");
      assert.equal(detail.summary.totalStudents, 2);

      // Siswa kelas 7A
      const studentNames = detail.students.map((s) => s.fullName);
      assert.ok(studentNames.includes("Ahmad Santri"));
      assert.ok(studentNames.includes("Bilal Santri"));

      // Siswa kelas 7B tidak boleh masuk
      assert.ok(!studentNames.includes("Cahyo Santri"));
    });

    it("menolak keras guru mengakses detail kelas dari assignment guru lain", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // Teacher 1 mencoba mengakses assignment milik Teacher 2 (asg_t2_mtk_7b)
      await assert.rejects(
        async () => {
          await getTeacherClassDetail(teacher1Ctx, "asg_t2_mtk_7b", mockPrisma);
        },
        (err: any) => {
          assert.equal(err.code, "TEACHER_ASSIGNMENT_ACCESS_DENIED");
          return true;
        }
      );
    });

    it("menolak keras akses kelas jika assignment berasal dari tenant lain", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // Teacher dari Tenant B mencoba mengakses assignment Tenant A
      await assert.rejects(
        async () => {
          await getTeacherClassDetail(teacherTenantBCtx, "asg_t1_mtk_7a", mockPrisma);
        },
        (err: any) => {
          assert.equal(err.code, "NOT_FOUND");
          return true;
        }
      );
    });
  });

  describe("3. Student Academic Summary (Privacy & Invariant Guard)", () => {
    it("guru dapat melihat rekap santri yang sah di rombelnya tanpa kebocoran data sensitif", async () => {
      const { mockPrisma, stores } = createMockPrismaTeacherWorkspace();

      // Buat satu sesi presensi untuk assignment ini
      stores.attendanceSessionsStore.set("sess_1", {
        id: "sess_1",
        institutionId: "inst_a",
        teacherAssignmentId: "asg_t1_mtk_7a",
        attendanceDate: normalizeAttendanceDate(new Date()),
        status: "CLOSED",
      });

      // Catat record hadir untuk std_1
      stores.attendanceRecordsStore.set("rec_1", {
        id: "rec_1",
        sessionId: "sess_1",
        studentId: "std_1",
        status: "PRESENT",
        note: "Tertib dan aktif",
      });

      const summary = await getTeacherStudentAcademicSummary(
        teacher1Ctx,
        "asg_t1_mtk_7a",
        "std_1",
        mockPrisma
      );

      assert.equal(summary.student.fullName, "Ahmad Santri");
      assert.equal(summary.student.nis, "1001");
      assert.equal(summary.attendance.totalSessions, 1);
      assert.equal(summary.attendance.present, 1);
      assert.equal(summary.attendance.attendanceRate, 100);

      // Pastikan TIDAK ADA field keuangan atau nomor wali
      assert.equal((summary.student as any).phoneWa, undefined);
      assert.equal((summary as any).finance, undefined);
      assert.equal((summary as any).charges, undefined);
    });

    it("menolak rekap jika siswa bukan anggota rombel dari assignment tersebut (Cross-Classroom Rejection)", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // std_3 terdaftar di 7B, dicoba diakses lewat assignment 7A
      await assert.rejects(
        async () => {
          await getTeacherStudentAcademicSummary(
            teacher1Ctx,
            "asg_t1_mtk_7a",
            "std_3",
            mockPrisma
          );
        },
        (err: any) => {
          assert.equal(err.code, "NOT_FOUND");
          return true;
        }
      );
    });

    it("menolak jika guru mencoba mengakses profil siswa lewat assignment guru lain", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // Teacher 1 mencoba mengakses santri lewat assignment Teacher 2
      await assert.rejects(
        async () => {
          await getTeacherStudentAcademicSummary(
            teacher1Ctx,
            "asg_t2_mtk_7b",
            "std_3",
            mockPrisma
          );
        },
        (err: any) => {
          assert.equal(err.code, "TEACHER_ASSIGNMENT_ACCESS_DENIED");
          return true;
        }
      );
    });
  });

  describe("4. Attendance Integration & Session Scoping", () => {
    it("guru dapat membuka sesi presensi untuk assignment miliknya", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const session = await createAttendanceSession(
        teacher1Ctx,
        {
          teacherAssignmentId: "asg_t1_mtk_7a",
          attendanceDate: "2026-09-24",
        },
        mockPrisma
      );

      assert.equal(session.status, "OPEN");
      assert.equal(session.teacherAssignmentId, "asg_t1_mtk_7a");
    });

    it("guru ditolak keras jika mencoba membuka sesi presensi untuk assignment guru lain", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // Teacher 1 mencoba membuka sesi untuk asg_t2_mtk_7b
      await assert.rejects(
        async () => {
          await createAttendanceSession(
            teacher1Ctx,
            {
              teacherAssignmentId: "asg_t2_mtk_7b",
              attendanceDate: "2026-09-24",
            },
            mockPrisma
          );
        },
        (err: any) => {
          assert.equal(err.code, "ATTENDANCE_ACCESS_DENIED");
          return true;
        }
      );
    });
  });

  describe("5. Assessment Flow & Plugin Enforcement", () => {
    it("guru dapat membuat assessment pada penugasan miliknya", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      const asm = await createAssessment(
        teacher1Ctx,
        {
          teacherAssignmentId: "asg_t1_mtk_7a",
          title: "Ulangan Harian 1 Aljabar",
          type: "DAILY",
          maxScore: 100,
        },
        mockPrisma
      );

      assert.equal(asm.title, "Ulangan Harian 1 Aljabar");
      assert.equal(asm.teacherAssignmentId, "asg_t1_mtk_7a");
    });

    it("guru ditolak jika mencoba membuat assessment pada penugasan guru lain", async () => {
      const { mockPrisma } = createMockPrismaTeacherWorkspace();

      // Teacher 1 mencoba membuat assessment di kelas Teacher 2
      await assert.rejects(
        async () => {
          await createAssessment(
            teacher1Ctx,
            {
              teacherAssignmentId: "asg_t2_mtk_7b",
              title: "Tugas 1",
              type: "DAILY",
              maxScore: 100,
            },
            mockPrisma
          );
        },
        (err: any) => {
          assert.equal(err.code, "ASSESSMENT_OWNERSHIP_DENIED");
          return true;
        }
      );
    });

    it("operasi akademik ditolak jika plugin FORMAL_ACADEMIC dinonaktifkan pada lembaga", async () => {
      const { mockPrisma, stores } = createMockPrismaTeacherWorkspace();

      // Tambahkan assignment di inst_no_academic
      stores.assignmentsStore.set("asg_salaf", {
        id: "asg_salaf",
        institutionId: "inst_no_academic",
        teacherId: "usr_salaf",
        subjectId: "sbj_mtk",
        classroomId: "cls_7a",
        academicYearId: "ay_2026_a",
      });

      const salafTeacherCtx: TenantContext = {
        userId: "usr_salaf",
        institutionId: "inst_no_academic",
        roles: ["TEACHER"],
        permissions: ["academic:view", "academic:manage"],
        isSuperAdmin: false,
      };

      // Mencoba membuat assessment di institusi yang menonaktifkan FORMAL_ACADEMIC
      await assert.rejects(
        async () => {
          await createAssessment(
            salafTeacherCtx,
            {
              teacherAssignmentId: "asg_salaf",
              title: "Ujian Fiqih",
              type: "MIDTERM",
              maxScore: 100,
            },
            mockPrisma
          );
        },
        (err: any) => {
          assert.equal(err.code, "DOMAIN_FEATURE_DISABLED");
          assert.equal(err.pluginId, "FORMAL_ACADEMIC");
          return true;
        }
      );
    });
  });
});
