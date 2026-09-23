import { test, describe } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessment,
  listAssessments,
  getAssessmentRoster,
  recordScore,
  recordBatchScores,
  listScores,
  calculateStudentSubjectGrades,
  generateDraftReportCard,
  publishReportCard,
  getReportCard,
  listReportCards,
  FormalAcademicError,
  AssessmentNotFoundError,
  AssessmentOwnershipError,
  InvalidScoreRangeError,
  InvalidEnrollmentScopeError,
  ReportCardAlreadyPublishedError,
} from "../src/lib/formal-academic";

function createMockPrismaFormalAcademic() {
  const teacherAssignmentsStore = new Map<string, any>();
  const enrollmentsStore = new Map<string, any>();
  const studentsStore = new Map<string, any>();
  const subjectsStore = new Map<string, any>();
  const classroomsStore = new Map<string, any>();
  const academicYearsStore = new Map<string, any>();
  const assessmentsStore = new Map<string, any>();
  const assessmentScoresStore = new Map<string, any>();
  const reportCardsStore = new Map<string, any>();
  const reportCardSubjectsStore = new Map<string, any>();
  const attendanceRecordsStore = new Map<string, any>();

  let autoId = 1;

  // Pre-seed data
  subjectsStore.set("sbj_mtk", {
    id: "sbj_mtk",
    institutionId: "inst_academic_demo",
    name: "Matematika",
    code: "MAT",
  });

  classroomsStore.set("cls_7a", {
    id: "cls_7a",
    institutionId: "inst_academic_demo",
    name: "Kelas 7A",
    academicYearId: "ay_2026",
  });

  academicYearsStore.set("ay_2026", {
    id: "ay_2026",
    institutionId: "inst_academic_demo",
    name: "2026/2027",
    isActive: true,
  });

  studentsStore.set("std_001", {
    id: "std_001",
    institutionId: "inst_academic_demo",
    fullName: "Ahmad Santri",
    nis: "1001",
    nisn: "0012345678",
    gender: "L",
    status: "ACTIVE",
  });

  studentsStore.set("std_002", {
    id: "std_002",
    institutionId: "inst_academic_demo",
    fullName: "Fatimah Santriwati",
    nis: "1002",
    nisn: "0012345679",
    gender: "P",
    status: "ACTIVE",
  });

  studentsStore.set("std_other_class", {
    id: "std_other_class",
    institutionId: "inst_academic_demo",
    fullName: "Budi Santri 7B",
    nis: "1003",
    gender: "L",
    status: "ACTIVE",
  });

  studentsStore.set("std_tenant_b", {
    id: "std_tenant_b",
    institutionId: "inst_tenant_b",
    fullName: "Siswa Luar",
    nis: "9999",
    gender: "L",
    status: "ACTIVE",
  });

  enrollmentsStore.set("enr_001", {
    id: "enr_001",
    institutionId: "inst_academic_demo",
    studentId: "std_001",
    classroomId: "cls_7a",
    academicYearId: "ay_2026",
    status: "ENROLLED",
    student: studentsStore.get("std_001"),
    classroom: classroomsStore.get("cls_7a"),
    academicYear: academicYearsStore.get("ay_2026"),
  });

  enrollmentsStore.set("enr_002", {
    id: "enr_002",
    institutionId: "inst_academic_demo",
    studentId: "std_002",
    classroomId: "cls_7a",
    academicYearId: "ay_2026",
    status: "ENROLLED",
    student: studentsStore.get("std_002"),
    classroom: classroomsStore.get("cls_7a"),
    academicYear: academicYearsStore.get("ay_2026"),
  });

  enrollmentsStore.set("enr_other_class", {
    id: "enr_other_class",
    institutionId: "inst_academic_demo",
    studentId: "std_other_class",
    classroomId: "cls_7b",
    academicYearId: "ay_2026",
    status: "ENROLLED",
    student: studentsStore.get("std_other_class"),
  });

  teacherAssignmentsStore.set("asg_001", {
    id: "asg_001",
    institutionId: "inst_academic_demo",
    teacherId: "usr_teacher_1",
    subjectId: "sbj_mtk",
    classroomId: "cls_7a",
    academicYearId: "ay_2026",
    teacher: { id: "usr_teacher_1", name: "Ustadz Zaid", email: "zaid@nata.id" },
    subject: subjectsStore.get("sbj_mtk"),
    classroom: classroomsStore.get("cls_7a"),
    academicYear: academicYearsStore.get("ay_2026"),
    assessments: [],
  });

  teacherAssignmentsStore.set("asg_other_teacher", {
    id: "asg_other_teacher",
    institutionId: "inst_academic_demo",
    teacherId: "usr_teacher_2",
    subjectId: "sbj_mtk",
    classroomId: "cls_7b",
    academicYearId: "ay_2026",
    teacher: { id: "usr_teacher_2", name: "Ustadzah Aisyah", email: "aisyah@nata.id" },
    subject: subjectsStore.get("sbj_mtk"),
    classroom: { id: "cls_7b", name: "Kelas 7B" },
    academicYear: academicYearsStore.get("ay_2026"),
    assessments: [],
  });

  teacherAssignmentsStore.set("asg_tenant_b", {
    id: "asg_tenant_b",
    institutionId: "inst_tenant_b",
    teacherId: "usr_teacher_b",
    subjectId: "sbj_b",
    classroomId: "cls_b",
    academicYearId: "ay_b",
    teacher: { id: "usr_teacher_b", name: "Guru B", email: "b@nata.id" },
    subject: { id: "sbj_b", name: "Mapel B" },
    classroom: { id: "cls_b", name: "Kelas B" },
    academicYear: { id: "ay_b", name: "2026" },
    assessments: [],
  });

  const mock: any = {
    teacherAssignment: {
      findUnique: async ({ where }: any) => {
        let key = where.id;
        if (where.id_institutionId) {
          const item = teacherAssignmentsStore.get(where.id_institutionId.id);
          if (item && item.institutionId === where.id_institutionId.institutionId) {
            return item;
          }
          return null;
        }
        return teacherAssignmentsStore.get(key) || null;
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(teacherAssignmentsStore.values());
        return list.filter((i) => {
          if (where.institutionId && i.institutionId !== where.institutionId) return false;
          if (where.classroomId && i.classroomId !== where.classroomId) return false;
          if (where.academicYearId && i.academicYearId !== where.academicYearId) return false;
          if (where.teacherId && i.teacherId !== where.teacherId) return false;
          return true;
        }).map((item) => {
          const assessments = Array.from(assessmentsStore.values()).filter(
            (a) => a.teacherAssignmentId === item.id && a.institutionId === item.institutionId
          ).map((a) => {
            const scores = Array.from(assessmentScoresStore.values()).filter(
              (s) => s.assessmentId === a.id
            );
            return { ...a, scores };
          });
          return { ...item, assessments };
        });
      },
    },

    enrollment: {
      findFirst: async ({ where }: any) => {
        const list = Array.from(enrollmentsStore.values());
        return (
          list.find((e) => {
            if (where.institutionId && e.institutionId !== where.institutionId) return false;
            if (where.studentId && e.studentId !== where.studentId) return false;
            if (where.classroomId && e.classroomId !== where.classroomId) return false;
            if (where.academicYearId && e.academicYearId !== where.academicYearId) return false;
            if (where.status && e.status !== where.status) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(enrollmentsStore.values());
        return list.filter((e) => {
          if (where.institutionId && e.institutionId !== where.institutionId) return false;
          if (where.classroomId && e.classroomId !== where.classroomId) return false;
          if (where.academicYearId && e.academicYearId !== where.academicYearId) return false;
          if (where.status && e.status !== where.status) return false;
          if (where.studentId?.in && !where.studentId.in.includes(e.studentId)) return false;
          return true;
        });
      },
    },

    assessment: {
      create: async ({ data }: any) => {
        const id = `asm_${autoId++}`;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        assessmentsStore.set(id, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        let rec: any = null;
        if (where.id_institutionId) {
          const item = assessmentsStore.get(where.id_institutionId.id);
          if (item && item.institutionId === where.id_institutionId.institutionId) {
            rec = item;
          }
        } else if (where.id) {
          rec = assessmentsStore.get(where.id) || null;
        }
        if (rec) {
          const assignment = teacherAssignmentsStore.get(rec.teacherAssignmentId);
          return {
            ...rec,
            teacherAssignment: assignment,
            _count: {
              scores: Array.from(assessmentScoresStore.values()).filter((s) => s.assessmentId === rec.id).length,
            },
          };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const existing = assessmentsStore.get(id);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        assessmentsStore.set(id, updated);
        return updated;
      },
      delete: async ({ where }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const existing = assessmentsStore.get(id);
        assessmentsStore.delete(id);
        return existing;
      },
      count: async ({ where }: any) => {
        const list = Array.from(assessmentsStore.values());
        return list.filter((a) => {
          if (where.institutionId && a.institutionId !== where.institutionId) return false;
          if (where.teacherAssignmentId && a.teacherAssignmentId !== where.teacherAssignmentId) return false;
          if (where.type && a.type !== where.type) return false;
          return true;
        }).length;
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(assessmentsStore.values());
        return list.filter((a) => {
          if (where.institutionId && a.institutionId !== where.institutionId) return false;
          if (where.teacherAssignmentId && a.teacherAssignmentId !== where.teacherAssignmentId) return false;
          if (where.type && a.type !== where.type) return false;
          return true;
        }).map((item) => {
          const assignment = teacherAssignmentsStore.get(item.teacherAssignmentId);
          return {
            ...item,
            teacherAssignment: assignment,
            _count: {
              scores: Array.from(assessmentScoresStore.values()).filter((s) => s.assessmentId === item.id).length,
            },
          };
        });
      },
    },

    assessmentScore: {
      upsert: async ({ where, update, create }: any) => {
        const compositeKey = `${where.assessmentId_studentId.assessmentId}_${where.assessmentId_studentId.studentId}`;
        const existing = assessmentScoresStore.get(compositeKey);
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() };
          assessmentScoresStore.set(compositeKey, updated);
          return updated;
        } else {
          const id = `sc_${autoId++}`;
          const record = { id, ...create, createdAt: new Date(), updatedAt: new Date() };
          assessmentScoresStore.set(compositeKey, record);
          return record;
        }
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(assessmentScoresStore.values());
        return list.filter((s) => {
          if (where.institutionId && s.institutionId !== where.institutionId) return false;
          if (where.assessmentId && s.assessmentId !== where.assessmentId) return false;
          if (where.studentId && s.studentId !== where.studentId) return false;
          if (where.enrollmentId && s.enrollmentId !== where.enrollmentId) return false;
          return true;
        }).map((s) => ({
          ...s,
          student: studentsStore.get(s.studentId),
          assessment: assessmentsStore.get(s.assessmentId),
        }));
      },
    },

    reportCard: {
      findUnique: async ({ where }: any) => {
        if (where.enrollmentId_semester) {
          const key = `${where.enrollmentId_semester.enrollmentId}_${where.enrollmentId_semester.semester}`;
          for (const rc of reportCardsStore.values()) {
            if (rc.enrollmentId === where.enrollmentId_semester.enrollmentId && rc.semester === where.enrollmentId_semester.semester) {
              return rc;
            }
          }
          return null;
        }
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const rc = reportCardsStore.get(id);
        if (rc) {
          const subjects = Array.from(reportCardSubjectsStore.values()).filter((s) => s.reportCardId === rc.id).map((s) => ({
            ...s,
            subject: subjectsStore.get(s.subjectId) || { id: s.subjectId, name: "Mapel" },
          }));
          return {
            ...rc,
            student: studentsStore.get(rc.studentId),
            classroom: classroomsStore.get(rc.classroomId),
            academicYear: academicYearsStore.get(rc.academicYearId),
            subjects,
          };
        }
        return null;
      },
      upsert: async ({ where, update, create }: any) => {
        for (const [id, rc] of reportCardsStore.entries()) {
          if (rc.enrollmentId === where.enrollmentId_semester.enrollmentId && rc.semester === where.enrollmentId_semester.semester) {
            const updated = { ...rc, ...update, updatedAt: new Date() };
            reportCardsStore.set(id, updated);
            return updated;
          }
        }
        const id = `rc_${autoId++}`;
        const record = { id, ...create, createdAt: new Date(), updatedAt: new Date() };
        reportCardsStore.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const id = where.id_institutionId ? where.id_institutionId.id : where.id;
        const existing = reportCardsStore.get(id);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        reportCardsStore.set(id, updated);
        return updated;
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(reportCardsStore.values());
        return list.filter((rc) => {
          if (where.institutionId && rc.institutionId !== where.institutionId) return false;
          if (where.status && rc.status !== where.status) return false;
          if (where.semester && rc.semester !== where.semester) return false;
          return true;
        }).map((rc) => ({
          ...rc,
          student: studentsStore.get(rc.studentId),
          classroom: classroomsStore.get(rc.classroomId),
          academicYear: academicYearsStore.get(rc.academicYearId),
          subjects: Array.from(reportCardSubjectsStore.values()).filter((s) => s.reportCardId === rc.id).map((s) => ({
            ...s,
            subject: subjectsStore.get(s.subjectId),
          })),
        }));
      },
      count: async () => reportCardsStore.size,
    },

    reportCardSubject: {
      upsert: async ({ where, update, create }: any) => {
        for (const [id, s] of reportCardSubjectsStore.entries()) {
          if (s.reportCardId === where.reportCardId_subjectId.reportCardId && s.subjectId === where.reportCardId_subjectId.subjectId) {
            const updated = { ...s, ...update, updatedAt: new Date() };
            reportCardSubjectsStore.set(id, updated);
            return updated;
          }
        }
        const id = `rcs_${autoId++}`;
        const record = { id, ...create, createdAt: new Date(), updatedAt: new Date() };
        reportCardSubjectsStore.set(id, record);
        return record;
      },
    },

    attendanceRecord: {
      findMany: async ({ where }: any) => {
        return Array.from(attendanceRecordsStore.values()).filter(
          (a) => a.enrollmentId === where.enrollmentId
        );
      },
    },

    $transaction: async (fn: any) => fn(mock),
  };

  return { mock, assessmentsStore, assessmentScoresStore, reportCardsStore, reportCardSubjectsStore };
}

describe("Phase 5 — Formal Academic Core Tests", () => {
  const teacherCtx: TenantContext = {
    institutionId: "inst_academic_demo",
    userId: "usr_teacher_1",
    roles: ["TEACHER"],
    permissions: ["academic:view", "report:view"],
    isSuperAdmin: false,
  };

  const otherTeacherCtx: TenantContext = {
    institutionId: "inst_academic_demo",
    userId: "usr_teacher_2",
    roles: ["TEACHER"],
    permissions: ["academic:view", "report:view"],
    isSuperAdmin: false,
  };

  const adminCtx: TenantContext = {
    institutionId: "inst_academic_demo",
    userId: "usr_admin",
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "report:view", "report:manage"],
    isSuperAdmin: false,
  };

  const otherTenantCtx: TenantContext = {
    institutionId: "inst_tenant_b",
    userId: "usr_teacher_b",
    roles: ["TEACHER"],
    permissions: ["academic:view", "report:view"],
    isSuperAdmin: false,
  };

  describe("1. Assessment Management & Teacher Scope", () => {
    test("guru dapat membuat assessment pada penugasan mengajar miliknya", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "Ulangan Harian 1 Aljabar",
            type: "DAILY",
            maxScore: 100,
          },
          mock
        );
      });

      assert.ok(assessment.id);
      assert.strictEqual(assessment.title, "Ulangan Harian 1 Aljabar");
      assert.strictEqual(assessment.maxScore, 100);
      assert.strictEqual(assessment.institutionId, "inst_academic_demo");
    });

    test("guru ditolak jika mencoba membuat assessment pada penugasan guru lain (resource scope)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      await assert.rejects(
        async () => {
          await runWithTenantContext(otherTeacherCtx, async () => {
            return createAssessment(
              otherTeacherCtx,
              {
                teacherAssignmentId: "asg_001", // Milik usr_teacher_1
                title: "Pembajakan Assessment",
                type: "DAILY",
              },
              mock
            );
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "AssessmentOwnershipError");
          assert.strictEqual(err.status, 403);
          return true;
        }
      );
    });

    test("admin dengan academic:manage dapat membuat assessment untuk penugasan manapun di tenant", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(adminCtx, async () => {
        return createAssessment(
          adminCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "Ujian Bersama Semester Ganjil",
            type: "FINAL",
            maxScore: 100,
          },
          mock
        );
      });

      assert.ok(assessment.id);
      assert.strictEqual(assessment.type, "FINAL");
    });

    test("enforce tenant isolation saat mengakses assessment", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      // Buat assessment di tenant demo
      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "Penilaian Internal",
            type: "QUIZ",
          },
          mock
        );
      });

      // Tenant B mencoba mengakses assessment milik tenant demo
      await assert.rejects(
        async () => {
          await runWithTenantContext(otherTenantCtx, async () => {
            return getAssessment(otherTenantCtx, assessment.id, mock);
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "AssessmentNotFoundError");
          return true;
        }
      );
    });
  });

  describe("2. Score Validation & Enrollment Scope", () => {
    test("dapat mencatat nilai siswa yang sah dalam rentang 0 s.d. maxScore", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "Kuis Aritmatika",
            type: "QUIZ",
            maxScore: 100,
          },
          mock
        );
      });

      const scoreRecord = await runWithTenantContext(teacherCtx, async () => {
        return recordScore(
          teacherCtx,
          {
            assessmentId: assessment.id,
            studentId: "std_001",
            score: 88,
            note: "Pemahaman konsep sangat baik",
          },
          mock
        );
      });

      assert.ok(scoreRecord.id);
      assert.strictEqual(scoreRecord.score, 88);
      assert.strictEqual(scoreRecord.studentId, "std_001");
      assert.strictEqual(scoreRecord.enrollmentId, "enr_001");
    });

    test("menolak nilai di luar rentang (skor < 0 atau skor > maxScore)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "Kuis 1",
            type: "QUIZ",
            maxScore: 100,
          },
          mock
        );
      });

      // Skor melebihi maxScore (105 > 100)
      await assert.rejects(
        async () => {
          await runWithTenantContext(teacherCtx, async () => {
            return recordScore(
              teacherCtx,
              {
                assessmentId: assessment.id,
                studentId: "std_001",
                score: 105,
              },
              mock
            );
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "InvalidScoreRangeError");
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    test("menolak siswa yang tidak terdaftar di rombel assessment (Cross-Classroom Rejection)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001", // Kelas 7A
            title: "Kuis Kelas 7A",
            type: "QUIZ",
          },
          mock
        );
      });

      // Siswa std_other_class terdaftar di Kelas 7B, bukan 7A
      await assert.rejects(
        async () => {
          await runWithTenantContext(teacherCtx, async () => {
            return recordScore(
              teacherCtx,
              {
                assessmentId: assessment.id,
                studentId: "std_other_class",
                score: 75,
              },
              mock
            );
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "InvalidEnrollmentScopeError");
          assert.strictEqual(err.status, 400);
          return true;
        }
      );
    });

    test("dapat melakukan pengisian nilai massal (batch score entry) secara atomis", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const assessment = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(
          teacherCtx,
          {
            teacherAssignmentId: "asg_001",
            title: "UTS Matematika",
            type: "MIDTERM",
            maxScore: 100,
          },
          mock
        );
      });

      const batchResult = await runWithTenantContext(teacherCtx, async () => {
        return recordBatchScores(
          teacherCtx,
          {
            assessmentId: assessment.id,
            scores: [
              { studentId: "std_001", score: 92, note: "Sangat baik" },
              { studentId: "std_002", score: 85, note: "Baik" },
            ],
          },
          mock
        );
      });

      assert.strictEqual(batchResult.updatedCount, 2);

      // Verifikasi roster
      const rosterData = await runWithTenantContext(teacherCtx, async () => {
        return getAssessmentRoster(teacherCtx, assessment.id, mock);
      });

      assert.strictEqual(rosterData.roster.length, 2);
      const student1 = rosterData.roster.find((r) => r.studentId === "std_001");
      const student2 = rosterData.roster.find((r) => r.studentId === "std_002");
      assert.strictEqual(student1?.score, 92);
      assert.strictEqual(student2?.score, 85);
    });
  });

  describe("3. Academic Result Calculation", () => {
    test("menghitung kalkulasi nilai akhir per mata pelajaran secara akurat", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      // Buat 2 assessment untuk std_001
      const a1 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "A1", type: "DAILY", maxScore: 100 }, mock);
      });
      const a2 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "A2", type: "DAILY", maxScore: 100 }, mock);
      });

      await runWithTenantContext(teacherCtx, async () => {
        await recordScore(teacherCtx, { assessmentId: a1.id, studentId: "std_001", score: 90 }, mock);
        await recordScore(teacherCtx, { assessmentId: a2.id, studentId: "std_001", score: 80 }, mock);
      });

      const results = await runWithTenantContext(teacherCtx, async () => {
        return calculateStudentSubjectGrades(
          teacherCtx,
          {
            studentId: "std_001",
            enrollmentId: "enr_001",
            classroomId: "cls_7a",
            academicYearId: "ay_2026",
          },
          undefined,
          mock
        );
      });

      assert.strictEqual(results.length, 1);
      const mathResult = results[0];
      assert.strictEqual(mathResult.subjectName, "Matematika");
      assert.strictEqual(mathResult.completedAssessments, 2);
      assert.strictEqual(mathResult.finalScore, 85); // (90 + 80) / 2 = 85
      assert.strictEqual(mathResult.letterGrade, "A");
    });
  });

  describe("4. Report Card Foundation & Frozen Snapshot Integrity", () => {
    test("dapat membuat draf raport dan menghitung seluruh nilai mata pelajaran", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const a1 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "Tugas 1", type: "DAILY", maxScore: 100 }, mock);
      });
      await runWithTenantContext(teacherCtx, async () => {
        await recordScore(teacherCtx, { assessmentId: a1.id, studentId: "std_001", score: 85 }, mock);
      });

      const draftReport = await runWithTenantContext(adminCtx, async () => {
        return generateDraftReportCard(
          adminCtx,
          {
            studentId: "std_001",
            classroomId: "cls_7a",
            academicYearId: "ay_2026",
            semester: "ODD",
            notes: "Draf semester ganjil",
          },
          mock
        );
      });

      assert.ok(draftReport.id);
      assert.strictEqual(draftReport.status, "DRAFT");
      assert.strictEqual(draftReport.semester, "ODD");
      assert.strictEqual(draftReport.subjects.length, 1);
      assert.strictEqual(draftReport.subjects[0].finalScore, 85);
    });

    test("menerbitkan dan membekukan raport ke status PUBLISHED (Frozen Snapshot)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const a1 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "Tugas 1", type: "DAILY", maxScore: 100 }, mock);
      });
      await runWithTenantContext(teacherCtx, async () => {
        await recordScore(teacherCtx, { assessmentId: a1.id, studentId: "std_001", score: 85 }, mock);
      });

      const draftReport = await runWithTenantContext(adminCtx, async () => {
        return generateDraftReportCard(
          adminCtx,
          {
            studentId: "std_001",
            classroomId: "cls_7a",
            academicYearId: "ay_2026",
            semester: "ODD",
          },
          mock
        );
      });

      // Terbitkan dan bekukan
      const publishedReport = await runWithTenantContext(adminCtx, async () => {
        return publishReportCard(
          adminCtx,
          {
            reportCardId: draftReport.id,
            notes: "Lulus dengan predikat sangat memuaskan.",
          },
          mock
        );
      });

      assert.strictEqual(publishedReport.status, "PUBLISHED");
      assert.ok(publishedReport.publishedAt);
      assert.ok(publishedReport.frozenData);

      const snapshot = JSON.parse(publishedReport.frozenData!);
      assert.strictEqual(snapshot.student.fullName, "Ahmad Santri");
      assert.strictEqual(snapshot.subjects[0].finalScore, 85);
      assert.strictEqual(snapshot.subjects[0].letterGrade, "A");
    });

    test("perubahan nilai setelah raport PUBLISHED TIDAK mengubah frozen snapshot (Historical Immutability)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const a1 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "Tugas 1", type: "DAILY", maxScore: 100 }, mock);
      });
      await runWithTenantContext(teacherCtx, async () => {
        await recordScore(teacherCtx, { assessmentId: a1.id, studentId: "std_001", score: 85 }, mock);
      });

      const draftReport = await runWithTenantContext(adminCtx, async () => {
        return generateDraftReportCard(
          adminCtx,
          {
            studentId: "std_001",
            classroomId: "cls_7a",
            academicYearId: "ay_2026",
            semester: "ODD",
          },
          mock
        );
      });

      const published = await runWithTenantContext(adminCtx, async () => {
        return publishReportCard(adminCtx, { reportCardId: draftReport.id }, mock);
      });

      // Guru mengubah nilai di masa mendatang menjadi 40
      await runWithTenantContext(teacherCtx, async () => {
        await recordScore(teacherCtx, { assessmentId: a1.id, studentId: "std_001", score: 40 }, mock);
      });

      // Draf baru ditolak karena raport sudah PUBLISHED
      await assert.rejects(
        async () => {
          await runWithTenantContext(adminCtx, async () => {
            return generateDraftReportCard(
              adminCtx,
              {
                studentId: "std_001",
                classroomId: "cls_7a",
                academicYearId: "ay_2026",
                semester: "ODD",
              },
              mock
            );
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "ReportCardAlreadyPublishedError");
          return true;
        }
      );

      // Verifikasi bahwa data raport yang sudah terbit tetap menggunakan snapshot awal (nilai 85, bukan 40)
      const fetchedReport = await runWithTenantContext(teacherCtx, async () => {
        return getReportCard(teacherCtx, published.id, mock);
      });

      assert.strictEqual(fetchedReport.status, "PUBLISHED");
      assert.strictEqual(fetchedReport.parsedSnapshot?.subjects[0].finalScore, 85);
      assert.strictEqual(fetchedReport.parsedSnapshot?.subjects[0].letterGrade, "A");
    });

    test("raport PUBLISHED tidak dapat diterbitkan ulang (dilarang publish ganda)", async () => {
      const { mock } = createMockPrismaFormalAcademic();

      const a1 = await runWithTenantContext(teacherCtx, async () => {
        return createAssessment(teacherCtx, { teacherAssignmentId: "asg_001", title: "Tugas 1", type: "DAILY" }, mock);
      });
      const draft = await runWithTenantContext(adminCtx, async () => {
        return generateDraftReportCard(adminCtx, { studentId: "std_001", classroomId: "cls_7a", academicYearId: "ay_2026", semester: "ODD" }, mock);
      });
      await runWithTenantContext(adminCtx, async () => {
        return publishReportCard(adminCtx, { reportCardId: draft.id }, mock);
      });

      // Coba publish lagi
      await assert.rejects(
        async () => {
          await runWithTenantContext(adminCtx, async () => {
            return publishReportCard(adminCtx, { reportCardId: draft.id }, mock);
          });
        },
        (err: any) => {
          assert.strictEqual(err.name, "ReportCardAlreadyPublishedError");
          return true;
        }
      );
    });
  });
});
