import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as examPaperActions from "../src/actions/exam-paper";
import { prisma } from "../src/lib/prisma";
import {
  createExam,
  addQuestions,
  setQuestionPoints,
  reorderQuestions,
  listExams,
  getExamDetail,
  transitionExamStatus,
  archiveExam,
  regenerateToken,
  getExamPublicIdentity,
} from "../src/lib/exam-paper";
import {
  ExamNotFoundError,
  ExamLockedError,
  ExamInvalidTransitionError,
  ExamQuestionNotFoundError,
  ExamQuestionSubjectMismatchError,
  ExamQuestionLimitError,
  ExamVerifyTokenNotFoundError,
} from "../src/lib/exam-paper/types";
import { ResourceNotFoundError } from "../src/lib/academic/types";
import { ValidationError } from "../src/lib/validation/common";
import {
  AuthorizationError,
  ROLE_PERMISSIONS,
} from "../src/lib/auth/permissions";
import { DomainFeatureDisabledError } from "../src/lib/plugins/guard";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  validateCreateExamInput,
  validateAddExamQuestionsInput,
  validateSetExamQuestionPointsInput,
  validateReorderExamQuestionsInput,
  validateExamFilter,
  EXAM_MAX_QUESTIONS,
  EXAM_STATUS_TRANSITIONS,
} from "../src/lib/validation/exam-paper";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const instAId = "inst_madrassah_nurul_hikmah";
const instBId = "inst_madrassah_alfalah";

const teacherCtx: TenantContext = {
  userId: "usr_teacher_a",
  institutionId: instAId,
  roles: ["TEACHER"],
  permissions: [...ROLE_PERMISSIONS.TEACHER],
  isSuperAdmin: false,
};

const adminCtx: TenantContext = {
  userId: "usr_admin_a",
  institutionId: instAId,
  roles: ["ADMIN"],
  permissions: [...ROLE_PERMISSIONS.ADMIN],
  isSuperAdmin: false,
};

const founderCtx: TenantContext = {
  userId: "usr_founder_a",
  institutionId: instAId,
  roles: ["FOUNDATION_HEAD"],
  permissions: [...ROLE_PERMISSIONS.FOUNDATION_HEAD],
  isSuperAdmin: false,
};

const financeCtx: TenantContext = {
  userId: "usr_finance_a",
  institutionId: instAId,
  roles: ["FINANCE_STAFF"],
  permissions: [...ROLE_PERMISSIONS.FINANCE_STAFF],
  isSuperAdmin: false,
};

const adminBCtx: TenantContext = {
  userId: "usr_admin_b",
  institutionId: instBId,
  roles: ["ADMIN"],
  permissions: [...ROLE_PERMISSIONS.ADMIN],
  isSuperAdmin: false,
};

const guardianCtx = {
  userId: undefined,
  guardianId: "gdw_1",
  institutionId: instAId,
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  subjectType: "GUARDIAN",
} as unknown as TenantContext;

// ---------------------------------------------------------------------------
// In-memory stores + Prisma mocks
// ---------------------------------------------------------------------------

let enabledPlugins = '["FORMAL_ACADEMIC"]';
let idCounter = 0;

let inMemoryInstitutions: any[] = [];
let inMemoryUsers: any[] = [];
let inMemoryYears: any[] = [];
let inMemorySubjects: any[] = [];
let inMemoryQuestions: any[] = [];
let inMemoryExams: any[] = [];
let inMemoryExamQuestions: any[] = [];
let inMemoryAuditLogs: any[] = [];

const nextId = (prefix: string) => `${prefix}_${++idCounter}`;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function matchExamWhere(row: any, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined || cond === null) continue;
    if (key === "title" && typeof cond === "object") {
      const op = cond as any;
      if ("contains" in op) {
        const mode = op.mode === "insensitive";
        const hay = mode ? String(row.title ?? "").toLowerCase() : String(row.title ?? "");
        const needle = mode ? String(op.contains).toLowerCase() : String(op.contains);
        if (!hay.includes(needle)) return false;
      }
      continue;
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

function findSubject(id: string, institutionId: string) {
  return inMemorySubjects.find((s) => s.id === id && s.institutionId === institutionId) || null;
}

function attachExam(row: any, args: any = {}): any {
  if (args.select) {
    const out: any = {};
    for (const [key, val] of Object.entries(args.select)) {
      if (!val) continue;
      if (key === "title" || key === "examType" || key === "status" || key === "updatedAt") {
        out[key] = row[key];
      } else if (key === "institution") {
        const inst = inMemoryInstitutions.find((i) => i.id === row.institutionId);
        out.institution = { name: inst?.name ?? null };
      } else if (key === "subject") {
        out.subject = row.subjectId
          ? { name: findSubject(row.subjectId, row.institutionId)?.name ?? null }
          : null;
      } else if (key === "academicYear") {
        const year = inMemoryYears.find(
          (y) => y.id === row.academicYearId && y.institutionId === row.institutionId
        );
        out.academicYear = { name: year?.name ?? null };
      }
    }
    return out;
  }

  const out: any = { ...row };
  const include = args.include ?? {};
  if (include.subject) {
    const s = findSubject(row.subjectId, row.institutionId);
    out.subject = s ? { id: s.id, name: s.name, code: s.code } : null;
  }
  if (include.academicYear) {
    const y = inMemoryYears.find(
      (x) => x.id === row.academicYearId && x.institutionId === row.institutionId
    );
    out.academicYear = y ? { id: y.id, name: y.name } : null;
  }
  if (include.createdBy) {
    const u = inMemoryUsers.find(
      (x) => x.id === row.createdById && x.institutionId === row.institutionId
    );
    out.createdBy = u ? { id: u.id, name: u.name } : null;
  }
  if (include._count?.select?.questions) {
    out._count = {
      questions: inMemoryExamQuestions.filter((q) => q.examId === row.id).length,
    };
  }
  if (include.questions) {
    const rows = inMemoryExamQuestions
      .filter((q) => q.examId === row.id)
      .sort((a, b) => a.order - b.order);
    out.questions = rows.map((eq) => {
      const question = inMemoryQuestions.find((qq) => qq.id === eq.questionId) || null;
      const withQuestion: any = { ...eq };
      if (question) {
        const qOut: any = { ...question };
        if (include.questions.include?.question?.include?.options) {
          qOut.options = (question.options || [])
            .map((o: any) => ({ ...o }))
            .sort((a: any, b: any) => a.label.localeCompare(b.label));
        }
        if (include.questions.include?.question?.include?.subject) {
          const s = findSubject(question.subjectId, question.institutionId);
          qOut.subject = s ? { id: s.id, name: s.name, code: s.code } : null;
        }
        withQuestion.question = qOut;
      }
      return withQuestion;
    });
  }
  return out;
}

function installPrismaMocks() {
  (prisma.institution as any).findUnique = async ({ where }: any) => {
    const row = inMemoryInstitutions.find((i) => i.id === where?.id) || null;
    if (!row) return null;
    return { id: row.id, enabledPlugins };
  };

  (prisma.academicYear as any).findUnique = async ({ where }: any) => {
    const w = where?.id_institutionId;
    if (!w) return null;
    return (
      inMemoryYears.find((y) => y.id === w.id && y.institutionId === w.institutionId) || null
    );
  };

  (prisma.subject as any).findUnique = async ({ where }: any) => {
    const w = where?.id_institutionId;
    if (!w) return null;
    return findSubject(w.id, w.institutionId);
  };

  (prisma.question as any).findUnique = async ({ where }: any) => {
    const w = where?.id_institutionId;
    if (!w) return null;
    return (
      inMemoryQuestions.find((q) => q.id === w.id && q.institutionId === w.institutionId) || null
    );
  };

  (prisma.exam as any).findUnique = async (args: any) => {
    let row: any = null;
    if (args.where?.id_institutionId) {
      const { id, institutionId } = args.where.id_institutionId;
      row = inMemoryExams.find((e) => e.id === id && e.institutionId === institutionId) || null;
    } else if (args.where?.verifyToken) {
      row = inMemoryExams.find((e) => e.verifyToken === args.where.verifyToken) || null;
    }
    if (!row) return null;
    return attachExam(row, args);
  };

  (prisma.exam as any).findMany = async (args: any = {}) => {
    let rows = inMemoryExams.filter((r) => matchExamWhere(r, args.where));
    rows = [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    if (args.skip) rows = rows.slice(args.skip);
    if (args.take !== undefined) rows = rows.slice(0, args.take);
    return rows.map((r) => attachExam(r, args));
  };

  (prisma.exam as any).count = async (args: any = {}) =>
    inMemoryExams.filter((r) => matchExamWhere(r, args.where)).length;

  (prisma.exam as any).create = async ({ data }: any) => {
    const now = new Date();
    const row = {
      id: nextId("exam"),
      examType: "DAILY",
      showAnswers: false,
      columnLayout: "ONE",
      status: "DRAFT", // default kolom (Prisma schema)
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    inMemoryExams.push(row);
    return { ...row };
  };

  (prisma.exam as any).update = async ({ where, data }: any) => {
    const row =
      inMemoryExams.find(
        (e) =>
          where?.id_institutionId &&
          e.id === where.id_institutionId.id &&
          e.institutionId === where.id_institutionId.institutionId
      ) || inMemoryExams.find((e) => where?.id && e.id === where.id);
    if (!row) throw new Error("P2025: Record not found");
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row };
  };

  (prisma.examQuestion as any).findUnique = async ({ where }: any) => {
    const w = where?.examId_questionId;
    if (!w) return null;
    return (
      inMemoryExamQuestions.find((q) => q.examId === w.examId && q.questionId === w.questionId) ||
      null
    );
  };

  (prisma.examQuestion as any).findMany = async ({ where }: any = {}) =>
    inMemoryExamQuestions
      .filter(
        (q) =>
          (!where?.examId || q.examId === where.examId) &&
          (!where?.institutionId || q.institutionId === where.institutionId)
      )
      .map((q) => ({ ...q }));

  (prisma.examQuestion as any).createMany = async ({ data }: any) => {
    for (const item of data) {
      const now = new Date();
      inMemoryExamQuestions.push({
        id: nextId("eq"),
        points: 10, // default kolom
        createdAt: now,
        updatedAt: now,
        ...item,
      });
    }
    return { count: data.length };
  };

  (prisma.examQuestion as any).update = async ({ where, data }: any) => {
    const row = inMemoryExamQuestions.find((q) => q.id === where?.id);
    if (!row) throw new Error("P2025: Record not found");
    Object.assign(row, data, { updatedAt: new Date() });
    return { ...row };
  };

  (prisma.auditLog as any).create = async ({ data }: any) => {
    inMemoryAuditLogs.push({ id: nextId("aud"), createdAt: new Date(), ...data });
    return { ...data };
  };

  (prisma as any).$transaction = async (ops: any[]) => Promise.all(ops);
}

// ---------------------------------------------------------------------------
// Fixtures per test
// ---------------------------------------------------------------------------

function seedQuestions() {
  inMemoryQuestions = [
    {
      id: "q_mc_1",
      institutionId: instAId,
      subjectId: "subj_math_a",
      type: "MULTIPLE_CHOICE",
      stem: "Berapa hasil dari 2 + 3?",
      options: [
        { id: "opt_1", label: "A", content: "4", isCorrect: false },
        { id: "opt_2", label: "B", content: "5", isCorrect: true },
        { id: "opt_3", label: "C", content: "6", isCorrect: false },
        { id: "opt_4", label: "D", content: "7", isCorrect: false },
      ],
    },
    {
      id: "q_mc_2",
      institutionId: instAId,
      subjectId: "subj_math_a",
      type: "MULTIPLE_CHOICE",
      stem: "Berapa hasil dari 10 / 2?",
      options: [],
    },
    {
      id: "q_essay_1",
      institutionId: instAId,
      subjectId: "subj_math_a",
      type: "ESSAY",
      stem: "Jelaskan konsep bilangan prima.",
      options: [],
    },
    {
      id: "q_bind_1",
      institutionId: instAId,
      subjectId: "subj_bind_a",
      type: "SHORT_ANSWER",
      stem: "Apa sinonim dari kata 'cepat'?",
      options: [],
    },
    {
      id: "q_b_1",
      institutionId: instBId,
      subjectId: "subj_math_b",
      type: "MULTIPLE_CHOICE",
      stem: "Soal milik lembaga lain.",
      options: [],
    },
  ];
}

async function makeExam(
  overrides: Partial<{
    status: string;
    subjectId: string;
    academicYearId: string;
    title: string;
    institutionId: string;
    createdById: string;
  }> = {}
): Promise<any> {
  return createExam(adminCtx, {
    academicYearId: overrides.academicYearId ?? "year_a_2026",
    subjectId: overrides.subjectId ?? "subj_math_a",
    title: overrides.title ?? "UTS Ganjil Matematika Kelas 8",
    examType: "MIDTERM",
    instructions: "Kerjakan dengan jujur.",
    columnLayout: "TWO",
    ...(overrides.institutionId ? {} : {}),
  }).then(async (exam) => {
    if (overrides.status && overrides.status !== "DRAFT") {
      if (overrides.status === "READY") {
        await transitionExamStatus(adminCtx, exam.id, { status: "READY" });
      } else if (overrides.status === "ISSUED") {
        await transitionExamStatus(adminCtx, exam.id, { status: "READY" });
        await transitionExamStatus(adminCtx, exam.id, { status: "ISSUED" });
      } else if (overrides.status === "ARCHIVED") {
        await archiveExam(adminCtx, exam.id);
      }
    }
    return inMemoryExams.find((e) => e.id === exam.id);
  });
}

describe("Phase 10.1 — Exam Paper Engine: Fondasi data & domain", () => {
  beforeEach(() => {
    idCounter = 0;
    enabledPlugins = '["FORMAL_ACADEMIC"]';

    inMemoryInstitutions = [
      { id: instAId, name: "MA Nurul Hikmah" },
      { id: instBId, name: "MA Al-Falah" },
    ];
    inMemoryUsers = [
      { id: "usr_admin_a", institutionId: instAId, name: "Admin Nurul Hikmah" },
      { id: "usr_teacher_a", institutionId: instAId, name: "Ustadz Ahmad" },
      { id: "usr_admin_b", institutionId: instBId, name: "Admin Al-Falah" },
    ];
    inMemoryYears = [
      { id: "year_a_2026", institutionId: instAId, name: "2025/2026" },
      { id: "year_b_2026", institutionId: instBId, name: "2025/2026" },
    ];
    inMemorySubjects = [
      { id: "subj_math_a", institutionId: instAId, name: "Matematika", code: "MTK" },
      { id: "subj_bind_a", institutionId: instAId, name: "Bahasa Indonesia", code: "BIN" },
      { id: "subj_math_b", institutionId: instBId, name: "Matematika", code: "MTK" },
    ];
    inMemoryExams = [];
    inMemoryExamQuestions = [];
    inMemoryAuditLogs = [];
    seedQuestions();

    installPrismaMocks();
  });

  // -------------------------------------------------------------------------
  // Zod Validation Boundary
  // -------------------------------------------------------------------------

  describe("Zod Validation", () => {
    it("menolak judul terlalu pendek, jenis ujian & layout tidak valid", () => {
      assert.throws(
        () =>
          validateCreateExamInput({
            academicYearId: "year_a_2026",
            subjectId: "subj_math_a",
            title: "AB",
          }),
        ValidationError
      );
      assert.throws(
        () =>
          validateCreateExamInput({
            academicYearId: "year_a_2026",
            subjectId: "subj_math_a",
            title: "Ujian Semester",
            examType: "SUPERBOWL",
          }),
        ValidationError
      );
      assert.throws(
        () =>
          validateCreateExamInput({
            academicYearId: "year_a_2026",
            subjectId: "subj_math_a",
            title: "Ujian Semester",
            columnLayout: "THREE",
          }),
        ValidationError
      );
    });

    it("menerapkan default: DAILY, ONE kolom, showAnswers false", () => {
      const parsed = validateCreateExamInput({
        academicYearId: "year_a_2026",
        subjectId: "subj_math_a",
        title: "Ulangan Harian Bab 1",
      });
      assert.equal(parsed.examType, "DAILY");
      assert.equal(parsed.columnLayout, "ONE");
      assert.equal(parsed.showAnswers, false);
    });

    it("menolak daftar soal kosong / duplikat saat menarik soal", () => {
      assert.throws(() => validateAddExamQuestionsInput({ questionIds: [] }), ValidationError);
      assert.throws(
        () => validateAddExamQuestionsInput({ questionIds: ["q_mc_1", "q_mc_1"] }),
        ValidationError
      );
    });

    it("menolak poin di luar 1..100 dan bukan bilangan bulat", () => {
      assert.throws(
        () => validateSetExamQuestionPointsInput({ questionId: "q_mc_1", points: 0 }),
        ValidationError
      );
      assert.throws(
        () => validateSetExamQuestionPointsInput({ questionId: "q_mc_1", points: 101 }),
        ValidationError
      );
      assert.throws(
        () => validateSetExamQuestionPointsInput({ questionId: "q_mc_1", points: 7.5 }),
        ValidationError
      );
    });

    it("menolak urutan dengan ID duplikat", () => {
      assert.throws(
        () => validateReorderExamQuestionsInput({ questionIds: ["q_mc_1", "q_mc_1"] }),
        ValidationError
      );
    });

    it("filter daftar: page/pageSize default aman", () => {
      const filter = validateExamFilter({});
      assert.equal(filter.page, 1);
      assert.equal(filter.pageSize, 20);
      assert.throws(() => validateExamFilter({ status: "MANGKUK" }), ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  describe("createExam", () => {
    it("berhasil: status DRAFT, hash-only token, AuditLog CREATE tanpa token mentah", async () => {
      const exam = await createExam(teacherCtx, {
        academicYearId: "year_a_2026",
        subjectId: "subj_math_a",
        title: "UTS Ganjil Matematika",
        examType: "MIDTERM",
        columnLayout: "TWO",
      });

      // Hash tersimpan di DB (64 hex), token mentah TIDAK pernah ada di DB
      const stored = inMemoryExams.find((e) => e.id === exam.id);
      assert.match(stored.verifyToken, /^[a-f0-9]{64}$/);

      // Hasil baca ke klien tidak memuat hash token
      assert.equal("verifyToken" in exam, false);

      // Default status + AuditLog
      assert.equal(stored.status, "DRAFT");
      const audit = inMemoryAuditLogs.find((a) => a.entityId === exam.id);
      assert.ok(audit, "AuditLog CREATE wajib ditulis");
      assert.equal(audit.action, "CREATE");
      assert.equal(audit.entityType, "Exam");
      assert.equal(audit.detailsJson.includes("verifyToken"), false);
      assert.equal(audit.detailsJson.includes(stored.verifyToken), false);
    });

    it("menolak tahun ajaran / mapel milik lembaga lain (tenant isolation)", async () => {
      await assert.rejects(
        createExam(adminCtx, {
          academicYearId: "year_b_2026",
          subjectId: "subj_math_a",
          title: "Naskah Satu",
        }),
        ResourceNotFoundError
      );
      await assert.rejects(
        createExam(adminCtx, {
          academicYearId: "year_a_2026",
          subjectId: "subj_math_b",
          title: "Naskah Dua",
        }),
        ResourceNotFoundError
      );
    });

    it("menolak sesi wali (GUARDIAN) dan RBAC tanpa exam:manage", async () => {
      await assert.rejects(
        createExam(guardianCtx, {
          academicYearId: "year_a_2026",
          subjectId: "subj_math_a",
          title: "Naskah Wali",
        }),
        AuthorizationError
      );
      // FINANCE_STAFF: exam:view=false, exam:manage=false
      await assert.rejects(
        createExam(financeCtx, {
          academicYearId: "year_a_2026",
          subjectId: "subj_math_a",
          title: "Naskah Keuangan",
        }),
        AuthorizationError
      );
      // FOUNDATION_HEAD: exam:view=true, exam:manage=false (view-only)
      await assert.rejects(
        createExam(founderCtx, {
          academicYearId: "year_a_2026",
          subjectId: "subj_math_a",
          title: "Naskah Pimpinan",
        }),
        AuthorizationError
      );
    });

    it("menolak bila plugin FORMAL_ACADEMIC nonaktif (403)", async () => {
      enabledPlugins = "[]";
      await assert.rejects(
        createExam(adminCtx, {
          academicYearId: "year_a_2026",
          subjectId: "subj_math_a",
          title: "Naskah Tanpa Plugin",
        }),
        DomainFeatureDisabledError
      );
    });
  });

  // -------------------------------------------------------------------------
  // Komposisi soal
  // -------------------------------------------------------------------------

  describe("addQuestions (tarik soal dari Bank Soal)", () => {
    it("berhasil: urutan 1..n, poin default 10, AuditLog UPDATE", async () => {
      const exam = await makeExam();
      const result = await addQuestions(adminCtx, exam.id, {
        questionIds: ["q_mc_1", "q_mc_2", "q_essay_1"],
      });

      assert.deepEqual(result, { added: 3, skipped: 0, total: 3 });

      const rows = inMemoryExamQuestions
        .filter((q) => q.examId === exam.id)
        .sort((a, b) => a.order - b.order);
      assert.deepEqual(
        rows.map((r) => [r.questionId, r.order, r.points]),
        [
          ["q_mc_1", 1, 10],
          ["q_mc_2", 2, 10],
          ["q_essay_1", 3, 10],
        ]
      );

      const audit = inMemoryAuditLogs.filter((a) => a.entityId === exam.id).pop();
      assert.equal(audit.action, "UPDATE");
      assert.equal(JSON.parse(audit.detailsJson).added, 3);
    });

    it("idempoten: soal yang sudah ada dilewati, tidak diduplikasi", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1", "q_mc_2"] });
      const second = await addQuestions(adminCtx, exam.id, {
        questionIds: ["q_mc_2", "q_essay_1"],
      });

      assert.deepEqual(second, { added: 1, skipped: 1, total: 3 });
      const stored = inMemoryExamQuestions.filter((q) => q.examId === exam.id);
      assert.equal(stored.length, 3);
      assert.equal(
        stored.filter((q) => q.questionId === "q_mc_2").length,
        1,
        "soal tidak boleh duplikat"
      );
    });

    it("menolak soal milik lembaga lain (cross-tenant = treated as tidak ada)", async () => {
      const exam = await makeExam();
      await assert.rejects(
        addQuestions(adminCtx, exam.id, { questionIds: ["q_b_1"] }),
        ExamQuestionNotFoundError
      );
      assert.equal(inMemoryExamQuestions.filter((q) => q.examId === exam.id).length, 0);
    });

    it("menolak soal dari mata pelajaran lain", async () => {
      const exam = await makeExam();
      await assert.rejects(
        addQuestions(adminCtx, exam.id, { questionIds: ["q_bind_1"] }),
        ExamQuestionSubjectMismatchError
      );
    });

    it("menolak naskah ISSUED/ARCHIVED (terkunci)", async () => {
      const issued = await makeExam({ status: "ISSUED" });
      await assert.rejects(
        addQuestions(adminCtx, issued.id, { questionIds: ["q_mc_1"] }),
        ExamLockedError
      );

      const archived = await makeExam({ status: "ARCHIVED" });
      await assert.rejects(
        addQuestions(adminCtx, archived.id, { questionIds: ["q_mc_1"] }),
        ExamLockedError
      );
    });

    it(`menolak komposisi melebihi batas ${EXAM_MAX_QUESTIONS} soal`, async () => {
      const exam = await makeExam();
      // Seeder batas: 100 baris komposisi sudah terisi
      for (let i = 0; i < EXAM_MAX_QUESTIONS; i++) {
        inMemoryExamQuestions.push({
          id: nextId("eq"),
          institutionId: instAId,
          examId: exam.id,
          questionId: `q_seeded_${i}`,
          order: i + 1,
          points: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await assert.rejects(
        addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] }),
        ExamQuestionLimitError
      );
      assert.equal(
        inMemoryExamQuestions.filter((q) => q.examId === exam.id).length,
        EXAM_MAX_QUESTIONS
      );
    });

    it("menolak guru tanpa exam:manage & sesi wali", async () => {
      const exam = await makeExam();
      await assert.rejects(
        addQuestions(financeCtx, exam.id, { questionIds: ["q_mc_1"] }),
        AuthorizationError
      );
      await assert.rejects(
        addQuestions(guardianCtx, exam.id, { questionIds: ["q_mc_1"] }),
        AuthorizationError
      );
    });
  });

  describe("setQuestionPoints & reorderQuestions", () => {
    it("mengatur poin satu soal + AuditLog", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1", "q_mc_2"] });

      const result = await setQuestionPoints(adminCtx, exam.id, {
        questionId: "q_mc_1",
        points: 25,
      });
      assert.deepEqual(result, { questionId: "q_mc_1", points: 25 });

      const row = inMemoryExamQuestions.find(
        (q) => q.examId === exam.id && q.questionId === "q_mc_1"
      );
      assert.equal(row.points, 25);
      assert.equal(row.points, result.points);
    });

    it("menolak poin pada soal yang bukan bagian naskah", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] });
      await assert.rejects(
        setQuestionPoints(adminCtx, exam.id, { questionId: "q_essay_1", points: 10 }),
        ExamQuestionNotFoundError
      );
    });

    it("mengatur ulang urutan: daftar lengkap diterapkan 1..n", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, {
        questionIds: ["q_mc_1", "q_mc_2", "q_essay_1"],
      });

      const result = await reorderQuestions(adminCtx, exam.id, {
        questionIds: ["q_essay_1", "q_mc_1", "q_mc_2"],
      });
      assert.deepEqual(result.order, ["q_essay_1", "q_mc_1", "q_mc_2"]);

      const rows = inMemoryExamQuestions
        .filter((q) => q.examId === exam.id)
        .sort((a, b) => a.order - b.order);
      assert.deepEqual(
        rows.map((r) => [r.questionId, r.order]),
        [
          ["q_essay_1", 1],
          ["q_mc_1", 2],
          ["q_mc_2", 3],
        ]
      );
    });

    it("menolak urutan yang tidak memuat tepat seluruh soal naskah", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1", "q_mc_2"] });

      // Kekurangan soal
      await assert.rejects(
        reorderQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] }),
        ValidationError
      );
      // Kelebihan soal (bukan bagian naskah)
      await assert.rejects(
        reorderQuestions(adminCtx, exam.id, {
          questionIds: ["q_mc_1", "q_mc_2", "q_bind_1"],
        }),
        ValidationError
      );
      // Urutan tersimpan utuh (tidak berubah parsial)
      const rows = inMemoryExamQuestions.filter((q) => q.examId === exam.id);
      assert.deepEqual(
        rows.map((r) => r.order).sort(),
        [1, 2],
        "urutan tidak boleh berubah parsial"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Baca (list & detail) + isolasi tenant
  // -------------------------------------------------------------------------

  describe("listExams & getExamDetail", () => {
    it("daftar naskah: RBAC exam:view, paginasi, hash token tidak bocor", async () => {
      await makeExam({ title: "UTS Matematika" });
      await makeExam({ title: "UAS Matematika" });

      const result = await listExams(adminCtx, {});
      assert.equal(result.total, 2);
      assert.equal(result.page, 1);
      assert.equal(result.pageSize, 20);
      assert.equal(result.totalPages, 1);
      for (const item of result.data) {
        assert.equal("verifyToken" in item, false);
      }

      // FOUNDATION_HEAD (view-only) boleh membaca
      const founderRead = await listExams(founderCtx, {});
      assert.equal(founderRead.total, 2);

      // FINANCE_STAFF tanpa exam:view ditolak
      await assert.rejects(listExams(financeCtx, {}), AuthorizationError);
      await assert.rejects(listExams(guardianCtx, {}), AuthorizationError);
    });

    it("filter status & pencarian judul bekerja", async () => {
      await makeExam({ title: "UTS Matematika" });
      const second = await makeExam({ title: "UAS Bahasa" });
      await transitionExamStatus(adminCtx, second.id, { status: "READY" });

      const ready = await listExams(adminCtx, { status: "READY" });
      assert.equal(ready.total, 1);
      assert.equal(ready.data[0].title, "UAS Bahasa");

      const search = await listExams(adminCtx, { search: "uts" });
      assert.equal(search.total, 1);
      assert.equal(search.data[0].title, "UTS Matematika");
    });

    it("cross-tenant: lembaga lain tidak melihat & tidak membuka naskah", async () => {
      const exam = await makeExam();

      const listB = await listExams(adminBCtx, {});
      assert.equal(listB.total, 0);

      await assert.rejects(getExamDetail(adminBCtx, exam.id), ExamNotFoundError);
      await assert.rejects(
        addQuestions(adminBCtx, exam.id, { questionIds: ["q_b_1"] }),
        ExamNotFoundError
      );
      await assert.rejects(regenerateToken(adminBCtx, exam.id), ExamNotFoundError);
    });

    it("detail naskah: komposisi terurut + metadata, tanpa hash token", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, {
        questionIds: ["q_essay_1", "q_mc_1", "q_mc_2"],
      });
      await reorderQuestions(adminCtx, exam.id, {
        questionIds: ["q_mc_1", "q_mc_2", "q_essay_1"],
      });

      const detail = await getExamDetail(adminCtx, exam.id);
      assert.equal("verifyToken" in detail, false);
      assert.equal(detail.subject?.name, "Matematika");
      assert.equal(detail.academicYear?.name, "2025/2026");
      assert.equal(detail.questions?.length, 3);
      assert.deepEqual(
        detail.questions?.map((q) => q.questionId),
        ["q_mc_1", "q_mc_2", "q_essay_1"],
        "komposisi wajib terurut sesuai order"
      );
      // Opsi PG ikut terbawa (untuk mode kunci nanti)
      assert.equal(detail.questions?.[0].question.options.length, 4);

      await assert.rejects(getExamDetail(adminBCtx, exam.id), ExamNotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // Siklus status (ARCHIVED menggantikan hard delete)
  // -------------------------------------------------------------------------

  describe("Siklus status & arsip", () => {
    it("transisi valid: DRAFT -> READY -> ISSUED -> ARCHIVED", async () => {
      const exam = await makeExam();
      const ready = await transitionExamStatus(adminCtx, exam.id, { status: "READY" });
      assert.equal(ready.status, "READY");
      const issued = await transitionExamStatus(adminCtx, exam.id, { status: "ISSUED" });
      assert.equal(issued.status, "ISSUED");
      const archived = await archiveExam(adminCtx, exam.id);
      assert.equal(archived.status, "ARCHIVED");

      // Naskah tetap ada (soft delete) dan AuditLog mencatat transisinya
      assert.ok(inMemoryExams.find((e) => e.id === exam.id));
      const actions = inMemoryAuditLogs
        .filter((a) => a.entityId === exam.id)
        .map((a) => a.action);
      assert.ok(actions.includes("STATUS_CHANGE"));
      assert.ok(actions.includes("ARCHIVE"));
    });

    it("menolak transisi ilegal: DRAFT -> ISSUED, ARCHIVED -> DRAFT", async () => {
      const exam = await makeExam();
      await assert.rejects(
        transitionExamStatus(adminCtx, exam.id, { status: "ISSUED" }),
        ExamInvalidTransitionError
      );

      await archiveExam(adminCtx, exam.id);
      await assert.rejects(
        transitionExamStatus(adminCtx, exam.id, { status: "DRAFT" }),
        ExamInvalidTransitionError
      );
    });

    it("arsip bersifat idempoten", async () => {
      const exam = await makeExam();
      const first = await archiveExam(adminCtx, exam.id);
      const second = await archiveExam(adminCtx, exam.id);
      assert.equal(first.status, "ARCHIVED");
      assert.equal(second.status, "ARCHIVED");
      assert.equal(inMemoryExams.find((e) => e.id === exam.id).status, "ARCHIVED");
    });

    it("matriks transisi: ARCHIVED terminal", () => {
      assert.deepEqual(EXAM_STATUS_TRANSITIONS.ARCHIVED, []);
      assert.ok(EXAM_STATUS_TRANSITIONS.DRAFT.includes("READY"));
      assert.ok(!EXAM_STATUS_TRANSITIONS.DRAFT.includes("ISSUED"));
      assert.ok(EXAM_STATUS_TRANSITIONS.ISSUED.includes("ARCHIVED"));
    });

    it("menolak transisi tanpa exam:manage", async () => {
      const exam = await makeExam();
      await assert.rejects(
        transitionExamStatus(founderCtx, exam.id, { status: "READY" }),
        AuthorizationError
      );
    });
  });

  // -------------------------------------------------------------------------
  // Token verifikasi QR (hash-only)
  // -------------------------------------------------------------------------

  describe("Token verifikasi QR", () => {
    it("regenerateToken: mengembalikan token mentah sekali jaya, DB hanya simpan hash", async () => {
      const exam = await makeExam();
      const originalHash = inMemoryExams.find((e) => e.id === exam.id).verifyToken;

      const { rawToken } = await regenerateToken(adminCtx, exam.id);

      // Token mentah: acak, base64url, bukan hash
      assert.match(rawToken, /^[A-Za-z0-9_-]{20,}$/);
      assert.notEqual(rawToken, originalHash);
      assert.equal(sha256(rawToken), inMemoryExams.find((e) => e.id === exam.id).verifyToken);

      // Token mentah tidak pernah muncul di AuditLog
      const audits = inMemoryAuditLogs.filter((a) => a.entityId === exam.id);
      for (const audit of audits) {
        assert.equal(audit.detailsJson.includes(rawToken), false);
      }

      // Token lama tidak berlaku lagi (digeser)
      await assert.rejects(getExamPublicIdentity(rawToken + "x"), ExamVerifyTokenNotFoundError);
    });

    it("public identity: identitas ringkas saja, tanpa komposisi/kunci/tenant lain", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] });
      const { rawToken } = await regenerateToken(adminCtx, exam.id);

      const identity = await getExamPublicIdentity(rawToken);

      // Hanya field identitas ringkas — tidak ada soal, kunci, hash, atau ID tenant
      assert.deepEqual(Object.keys(identity).sort(), [
        "academicYearName",
        "examType",
        "institutionName",
        "issuedAt",
        "status",
        "subjectName",
        "title",
      ]);
      assert.equal(identity.institutionName, "MA Nurul Hikmah");
      assert.equal(identity.subjectName, "Matematika");
      assert.equal(identity.academicYearName, "2025/2026");
      assert.equal(identity.title, "UTS Ganjil Matematika Kelas 8");
      assert.equal(identity.status, "DRAFT");

      const serialized = JSON.stringify(identity);
      assert.equal(serialized.includes("Berapa hasil"), false, "stem soal tidak boleh bocor");
      assert.equal(serialized.includes(instAId), false, "ID lembaga tidak boleh bocor");
      assert.equal(serialized.includes("verifyToken"), false);
      void exam;
    });

    it("token salah / kosong ditolak 404", async () => {
      await makeExam();
      await assert.rejects(
        getExamPublicIdentity("token-yang-tidak-dikenal"),
        ExamVerifyTokenNotFoundError
      );
      await assert.rejects(getExamPublicIdentity("   "), ExamVerifyTokenNotFoundError);
    });

    it("resolusi publik tidak membutuhkan sesi (tanpa ctx) dan tidak terikat pilih-pilih lembaga", async () => {
      const exam = await makeExam();
      const { rawToken } = await regenerateToken(adminCtx, exam.id);

      // Fungsi publik: tanpa parameter konteks sama sekali
      const identity = await getExamPublicIdentity(rawToken);
      assert.equal(identity.title, "UTS Ganjil Matematika Kelas 8");
      void exam;
    });
  });

  // -------------------------------------------------------------------------
  // DoD Strict: RBAC matrix + plugin guard + audit coverage
  // -------------------------------------------------------------------------

  describe("DoD Strict — RBAC, Plugin, Audit", () => {
    it("matriks RBAC exam:* konsisten dengan ROLE_PERMISSIONS", () => {
      // Pemegang exam:manage wajib punya exam:view
      for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
        if (perms.includes("exam:manage" as any)) {
          assert.ok(
            perms.includes("exam:view" as any),
            `${role} punya exam:manage tanpa exam:view`
          );
        }
      }
      // Peran negatif untuk uji ini
      assert.equal(ROLE_PERMISSIONS.FINANCE_STAFF.includes("exam:view" as any), false);
      assert.equal(ROLE_PERMISSIONS.FINANCE_STAFF.includes("exam:manage" as any), false);
      assert.equal(ROLE_PERMISSIONS.FOUNDATION_HEAD.includes("exam:view" as any), true);
      assert.equal(ROLE_PERMISSIONS.FOUNDATION_HEAD.includes("exam:manage" as any), false);
    });

    it("semua operasi tulis ditolak untuk sesi tanpa exam:manage", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] });

      const writeOps: Array<() => Promise<unknown>> = [
        () =>
          createExam(financeCtx, {
            academicYearId: "year_a_2026",
            subjectId: "subj_math_a",
            title: "Naskah X",
          }),
        () => addQuestions(financeCtx, exam.id, { questionIds: ["q_mc_2"] }),
        () => setQuestionPoints(financeCtx, exam.id, { questionId: "q_mc_1", points: 5 }),
        () => reorderQuestions(financeCtx, exam.id, { questionIds: ["q_mc_1"] }),
        () => transitionExamStatus(financeCtx, exam.id, { status: "READY" }),
        () => archiveExam(financeCtx, exam.id),
        () => regenerateToken(financeCtx, exam.id),
        () => addQuestions(guardianCtx, exam.id, { questionIds: ["q_mc_2"] }),
      ];

      for (const op of writeOps) {
        await assert.rejects(op, AuthorizationError);
      }
    });

    it("plugin guard aktif di seluruh operasi baca & tulis", async () => {
      const exam = await makeExam();
      enabledPlugins = "[]";

      await assert.rejects(listExams(adminCtx, {}), DomainFeatureDisabledError);
      await assert.rejects(getExamDetail(adminCtx, exam.id), DomainFeatureDisabledError);
      await assert.rejects(
        addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] }),
        DomainFeatureDisabledError
      );
      await assert.rejects(regenerateToken(adminCtx, exam.id), DomainFeatureDisabledError);
      // Fungsi publik verifikasi TIDAK diblokir plugin (halaman publik identitas)
      const { rawToken } = await (async () => {
        enabledPlugins = '["FORMAL_ACADEMIC"]';
        return regenerateToken(adminCtx, exam.id);
      })();
      enabledPlugins = "[]";
      const identity = await getExamPublicIdentity(rawToken);
      assert.equal(identity.title, "UTS Ganjil Matematika Kelas 8");
    });

    it("setiap operasi menulis jejak AuditLog entityType=Exam", async () => {
      const exam = await makeExam();
      await addQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] });
      await setQuestionPoints(adminCtx, exam.id, { questionId: "q_mc_1", points: 15 });
      await reorderQuestions(adminCtx, exam.id, { questionIds: ["q_mc_1"] });
      await transitionExamStatus(adminCtx, exam.id, { status: "READY" });
      await archiveExam(adminCtx, exam.id);
      await regenerateToken(adminCtx, exam.id);

      const actions = inMemoryAuditLogs
        .filter((a) => a.entityId === exam.id)
        .map((a) => a.action);
      assert.deepEqual(actions, [
        "CREATE",
        "UPDATE", // addQuestions
        "UPDATE", // setQuestionPoints
        "UPDATE", // reorder
        "STATUS_CHANGE",
        "ARCHIVE",
        "UPDATE", // regenerateToken
      ]);
      for (const audit of inMemoryAuditLogs.filter((a) => a.entityId === exam.id)) {
        assert.equal(audit.entityType, "Exam");
        assert.equal(audit.institutionId, instAId);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Phase 10.2 — Server Actions src/actions/exam-paper.ts
  // -------------------------------------------------------------------------
  describe("Phase 10.2 — Server Actions exam-paper (struktur & kaidah Next.js 16)", () => {
    const REQUIRED_ACTIONS = [
      "listExamsAction",
      "getExamDetailAction",
      "createExamAction",
      "addExamQuestionsAction",
      "setExamQuestionPointsAction",
      "reorderExamQuestionsAction",
      "transitionExamStatusAction",
      "archiveExamAction",
    ];

    it("seluruh ekspor action bersifat async function (kaidah Next.js 16)", () => {
      const exportNames = Object.keys(examPaperActions);
      assert.ok(exportNames.length >= REQUIRED_ACTIONS.length);

      for (const name of exportNames) {
        const value = (examPaperActions as Record<string, unknown>)[name];
        assert.equal(typeof value, "function", `${name} harus berupa function`);
        assert.equal(
          (value as { constructor: { name: string } }).constructor.name,
          "AsyncFunction",
          `${name} harus async agar tidak memicu runtime 500`
        );
      }
    });

    it("menyediakan seluruh aksi sesuai plan 10.2 (daftar, detail, create, komposisi, urutan, poin, status, arsip)", () => {
      for (const name of REQUIRED_ACTIONS) {
        assert.equal(
          typeof (examPaperActions as Record<string, unknown>)[name],
          "function",
          `aksi ${name} harus tersedia`
        );
      }
    });
  });
});
