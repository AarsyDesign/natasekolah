import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import * as questionBankActions from "../src/actions/question-bank";
import type { TenantContext } from "../src/lib/tenant/context";
import { resolvePermissionsFromRoles, AuthorizationError } from "../src/lib/auth/permissions";
import { ValidationError } from "../src/lib/validation";
import {
  createQuestion,
  updateQuestion,
  getQuestion,
  listQuestions,
  transitionQuestionStatus,
  archiveQuestion,
  deleteQuestion,
} from "../src/lib/question-bank";
import {
  getQuestionBankSummary,
  listQuestionCategories,
  listQuestionTopics,
  getQuestionDifficultyDistribution,
  generateQuestionImportPreview,
  executeQuestionImport,
  generateQuestionImportTemplateBuffer,
  exportQuestionsCSV,
  QUESTION_EXPORT_HEADERS,
} from "../src/lib/question-bank";
import {
  QuestionNotFoundError,
  QuestionOwnershipError,
  QuestionArchivedError,
  QuestionSubjectNotFoundError,
} from "../src/lib/question-bank";
import { DomainFeatureDisabledError } from "../src/lib/plugins/guard";

// ---------------------------------------------------------------------------
// Fixture TenantContext (institusi A dan B)
// ---------------------------------------------------------------------------

const instAId = "inst_al_hikmah";
const instBId = "inst_nurul_iman";

const adminA: TenantContext = {
  userId: "usr_admin_a",
  institutionId: instAId,
  roles: ["ADMIN"],
  permissions: resolvePermissionsFromRoles(["ADMIN"]),
  isSuperAdmin: false,
};

const teacherA1: TenantContext = {
  userId: "usr_teacher_a1",
  institutionId: instAId,
  roles: ["TEACHER"],
  permissions: resolvePermissionsFromRoles(["TEACHER"]),
  isSuperAdmin: false,
};

const teacherA2: TenantContext = {
  userId: "usr_teacher_a2",
  institutionId: instAId,
  roles: ["TEACHER"],
  permissions: resolvePermissionsFromRoles(["TEACHER"]),
  isSuperAdmin: false,
};

const viewerA: TenantContext = {
  userId: "usr_foundation_a",
  institutionId: instAId,
  roles: ["FOUNDATION_HEAD"],
  permissions: resolvePermissionsFromRoles(["FOUNDATION_HEAD"]),
  isSuperAdmin: false,
};

const financeA: TenantContext = {
  userId: "usr_finance_a",
  institutionId: instAId,
  roles: ["FINANCE_STAFF"],
  permissions: resolvePermissionsFromRoles(["FINANCE_STAFF"]),
  isSuperAdmin: false,
};

const adminB: TenantContext = {
  userId: "usr_admin_b",
  institutionId: instBId,
  roles: ["ADMIN"],
  permissions: resolvePermissionsFromRoles(["ADMIN"]),
  isSuperAdmin: false,
};

// ---------------------------------------------------------------------------
// Tabel In-Memory + Monkey-Patch Prisma
// ---------------------------------------------------------------------------

let inMemoryQuestions: any[] = [];
let inMemorySubjects: any[] = [];
let inMemoryUsers: any[] = [];
let inMemoryAuditLogs: any[] = [];
let enabledPlugins = '["FORMAL_ACADEMIC"]';
let idCounter = 0;

const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

function matchesWhere(record: any, where: any): boolean {
  if (!where) return true;
  for (const [key, rawCond] of Object.entries(where)) {
    const cond = rawCond as any;
    if (cond === undefined || cond === null) continue;
    if (key === "OR") {
      if (!(cond as any[]).some((c) => matchesWhere(record, c))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(cond as any[]).every((c) => matchesWhere(record, c))) return false;
      continue;
    }
    if (key === "id_institutionId") {
      if (record.id !== cond.id || record.institutionId !== cond.institutionId) return false;
      continue;
    }
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      const op = cond as Record<string, unknown>;
      if ("in" in op && !(op.in as unknown[]).includes(record[key])) return false;
      if ("not" in op && record[key] === op.not) return false;
      if ("equals" in op && record[key] !== op.equals) return false;
      if ("contains" in op) {
        const mode = op.mode === "insensitive";
        const hay = mode ? String(record[key] ?? "").toLowerCase() : String(record[key] ?? "");
        const needle = mode ? String(op.contains).toLowerCase() : String(op.contains);
        if (!hay.includes(needle)) return false;
      }
      continue;
    }
    if (record[key] !== cond) return false;
  }
  return true;
}

function withQuestionInclude(question: any, include: any): any {
  if (!include) return { ...question };
  const out: any = { ...question, options: (question.options || []).map((o: any) => ({ ...o })) };
  if (include.options) {
    out.options.sort((a: any, b: any) => a.label.localeCompare(b.label));
  }
  if (include.subject) {
    out.subject =
      inMemorySubjects.find(
        (s) => s.id === question.subjectId && s.institutionId === question.institutionId
      ) || null;
  }
  if (include.createdBy) {
    const user = inMemoryUsers.find(
      (u) => u.id === question.createdById && u.institutionId === question.institutionId
    );
    out.createdBy = user ? { id: user.id, name: user.name } : null;
  }
  return out;
}

function queryRows(rows: any[], args: any = {}): any[] {
  let out = rows.filter((row) => matchesWhere(row, args.where));
  if (args.orderBy) {
    const [key, dir] = Object.entries(args.orderBy)[0] as [string, string];
    out = [...out].sort((a, b) => {
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
    });
  }
  if (args.distinct) {
    const seen = new Set<string>();
    out = out.filter((row) => {
      const sig = args.distinct.map((d: string) => row[d]).join("|");
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }
  if (args.skip) out = out.slice(args.skip);
  if (args.take !== undefined) out = out.slice(0, args.take);
  if (args.select) {
    out = out.map((row) => {
      const picked: any = {};
      for (const [k, v] of Object.entries(args.select)) {
        if (v) picked[k] = row[k];
      }
      return picked;
    });
  }
  if (args.include) out = out.map((row) => withQuestionInclude(row, args.include));
  return out;
}

function installPrismaMocks() {
  (prisma.institution as any).findUnique = async ({ where }: any) => {
    if (where?.id && where.id !== instAId && where.id !== instBId) return null;
    return { id: where?.id ?? instAId, enabledPlugins };
  };

  (prisma.subject as any).findUnique = async ({ where }: any) => {
    if (where?.id_institutionId) {
      return (
        inMemorySubjects.find(
          (s) =>
            s.id === where.id_institutionId.id &&
            s.institutionId === where.id_institutionId.institutionId
        ) || null
      );
    }
    if (where?.id) return inMemorySubjects.find((s) => s.id === where.id) || null;
    return null;
  };

  (prisma.subject as any).findMany = async (args: any = {}) => {
    let rows = inMemorySubjects.filter((s) => matchesWhere(s, args.where));
    if (args.where?.id?.in) rows = rows.filter((s) => args.where.id.in.includes(s.id));
    if (args.select) {
      rows = rows.map((row) => {
        const picked: any = {};
        for (const [k, v] of Object.entries(args.select)) if (v) picked[k] = row[k];
        return picked;
      });
    }
    return rows;
  };

  (prisma.question as any).findUnique = async ({ where, include }: any) => {
    let found: any = null;
    if (where?.id_institutionId) {
      found =
        inMemoryQuestions.find(
          (q) =>
            q.id === where.id_institutionId.id &&
            q.institutionId === where.id_institutionId.institutionId
        ) || null;
    } else if (where?.id) {
      found = inMemoryQuestions.find((q) => q.id === where.id) || null;
    }
    return found ? withQuestionInclude(found, include) : null;
  };

  (prisma.question as any).findMany = async (args: any = {}) =>
    queryRows(inMemoryQuestions, args);

  (prisma.question as any).count = async (args: any = {}) =>
    inMemoryQuestions.filter((q) => matchesWhere(q, args.where)).length;

  (prisma.question as any).create = async ({ data, include }: any) => {
    const { options, ...rest } = data;
    const now = new Date();
    const record: any = {
      id: nextId("qst"),
      institutionId: rest.institutionId,
      difficulty: "MEDIUM",
      topic: null,
      explanation: null,
      shortAnswerKey: null,
      status: "DRAFT",
      ...rest,
      options: [],
      createdAt: now,
      updatedAt: now,
    };
    if (options?.create) {
      record.options = options.create.map((opt: any, index: number) => ({
        id: nextId("opt"),
        questionId: record.id,
        institutionId: opt.institutionId ?? record.institutionId,
        label: opt.label,
        content: opt.content,
        isCorrect: opt.isCorrect ?? false,
        createdAt: now,
        updatedAt: now,
      }));
    }
    inMemoryQuestions.push(record);
    return withQuestionInclude(record, include);
  };

  (prisma.question as any).update = async ({ where, data, include }: any) => {
    const targetId = where?.id_institutionId ? where.id_institutionId.id : where?.id;
    const idx = inMemoryQuestions.findIndex((q) => q.id === targetId);
    if (idx === -1) throw new Error("Question not found");
    const current = inMemoryQuestions[idx];
    const { options, ...scalarData } = data;
    const updated = { ...current, ...scalarData, updatedAt: new Date() };
    if (options) {
      updated.options = (options.create || []).map((opt: any, index: number) => ({
        id: nextId("opt"),
        questionId: current.id,
        institutionId: opt.institutionId ?? current.institutionId,
        label: opt.label,
        content: opt.content,
        isCorrect: opt.isCorrect ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
    inMemoryQuestions[idx] = updated;
    return withQuestionInclude(updated, include);
  };

  (prisma.question as any).groupBy = async ({ by, where, _count }: any) => {
    const rows = inMemoryQuestions.filter((q) => matchesWhere(q, where));
    const groups = new Map<string, number>();
    for (const row of rows) {
      const key = by.map((field: string) => row[field]).join("|");
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).map(([key, count]) => {
      const values = key.split("|");
      const result: any = {};
      by.forEach((field: string, index: number) => {
        result[field] = values[index];
      });
      if (_count) result._count = { _all: count };
      return result;
    });
  };

  (prisma.auditLog as any).create = async ({ data }: any) => {
    const record = { id: nextId("aud"), createdAt: new Date(), ...data };
    inMemoryAuditLogs.push(record);
    return record;
  };
}

// ---------------------------------------------------------------------------
// Payload & Seed Helpers
// ---------------------------------------------------------------------------

function mcPayload(subjectId = "sub_math_a") {
  return {
    subjectId,
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    topic: "Aljabar",
    stem: "Berapa hasil dari 2 + 3?",
    options: [
      { label: "A", content: "4", isCorrect: false },
      { label: "B", content: "5", isCorrect: true },
      { label: "C", content: "6", isCorrect: false },
      { label: "D", content: "7", isCorrect: false },
    ],
  };
}

function seedQuestion(overrides: Record<string, any> = {}) {
  const now = new Date();
  const subjectId = overrides.subjectId ?? "sub_math_a";
  const record: any = {
    id: nextId("qst"),
    institutionId: instAId,
    subjectId,
    createdById: "usr_admin_a",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    topic: "Aljabar",
    stem: "Butir soal awal?",
    explanation: null,
    shortAnswerKey: null,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    options: [
      {
        id: nextId("opt"),
        questionId: "",
        institutionId: instAId,
        label: "A",
        content: "Satu",
        isCorrect: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: nextId("opt"),
        questionId: "",
        institutionId: instAId,
        label: "B",
        content: "Dua",
        isCorrect: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: nextId("opt"),
        questionId: "",
        institutionId: instAId,
        label: "C",
        content: "Tiga",
        isCorrect: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: nextId("opt"),
        questionId: "",
        institutionId: instAId,
        label: "D",
        content: "Empat",
        isCorrect: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
  record.options = record.options.map((opt: any) => ({
    ...opt,
    questionId: record.id,
    institutionId: record.institutionId,
  }));
  inMemoryQuestions.push(record);
  return record;
}

describe("Phase 7 — Question Bank Core Tests", () => {
  beforeEach(() => {
    enabledPlugins = '["FORMAL_ACADEMIC"]';
    inMemoryQuestions = [];
    inMemoryAuditLogs = [];
    idCounter = 0;

    inMemorySubjects = [
      { id: "sub_math_a", institutionId: instAId, code: "MTK", name: "Matematika", isActive: true },
      { id: "sub_fiqh_a", institutionId: instAId, code: "FIQ", name: "Fikih", isActive: true },
      { id: "sub_math_b", institutionId: instBId, code: "MTK", name: "Matematika B", isActive: true },
    ];

    inMemoryUsers = [
      { id: "usr_admin_a", institutionId: instAId, name: "Admin Al-Hikmah" },
      { id: "usr_teacher_a1", institutionId: instAId, name: "Ust. Ahmad Fauzi" },
      { id: "usr_teacher_a2", institutionId: instAId, name: "Ustzh. Siti Aminah" },
      { id: "usr_foundation_a", institutionId: instAId, name: "Yayasan Al-Hikmah" },
      { id: "usr_finance_a", institutionId: instAId, name: "Bendahara Al-Hikmah" },
      { id: "usr_admin_b", institutionId: instBId, name: "Admin Nurul Iman" },
    ];

    installPrismaMocks();
  });

  // -------------------------------------------------------------------------
  // 1. CRUD & Validasi Invariant Tipe Soal
  // -------------------------------------------------------------------------
  describe("1. CRUD & Validasi Invariant Tipe Soal", () => {
    it("membuat soal pilihan ganda valid dengan tepat 4 opsi dan 1 kunci", async () => {
      const created = await createQuestion(adminA, mcPayload());

      assert.equal(created.institutionId, instAId);
      assert.equal(created.createdById, "usr_admin_a");
      assert.equal(created.status, "DRAFT");
      assert.equal(created.options.length, 4);
      assert.equal(created.options.filter((o) => o.isCorrect).length, 1);
      assert.equal(created.options.find((o) => o.isCorrect)?.label, "B");
      assert.equal(inMemoryQuestions.length, 1);
      assert.equal(inMemoryAuditLogs.length, 1);
      assert.equal(inMemoryAuditLogs[0].action, "CREATE");
      assert.equal(inMemoryAuditLogs[0].entityType, "Question");
    });

    it("menolak tipe soal yang tidak dikenal", async () => {
      await assert.rejects(
        () => createQuestion(adminA, { ...mcPayload(), type: "TRUE_FALSE" }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("menolak payload dengan field tak dikenal (skema strict)", async () => {
      await assert.rejects(
        () => createQuestion(adminA, { ...mcPayload(), institutionId: instBId, evil: true }),
        (err: unknown) => err instanceof ValidationError
      );
      assert.equal(inMemoryQuestions.length, 0);
    });

    it("menolak pilihan ganda tanpa kunci jawaban", async () => {
      const payload = mcPayload();
      payload.options = payload.options.map((o) => ({ ...o, isCorrect: false }));
      await assert.rejects(
        () => createQuestion(adminA, payload),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.message.includes("tepat 1 kunci"));
          return true;
        }
      );
    });

    it("menolak pilihan ganda dengan 2 kunci jawaban", async () => {
      const payload = mcPayload();
      payload.options = payload.options.map((o, i) => ({ ...o, isCorrect: i <= 1 }));
      await assert.rejects(
        () => createQuestion(adminA, payload),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.message.includes("hanya boleh memiliki 1 kunci"));
          return true;
        }
      );
    });

    it("menolak pilihan ganda dengan kurang dari 4 opsi", async () => {
      const payload = mcPayload();
      payload.options = payload.options.slice(0, 3);
      await assert.rejects(
        () => createQuestion(adminA, payload),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.message.includes("tepat 4 opsi"));
          return true;
        }
      );
    });

    it("menolak label opsi duplikat pada soal yang sama", async () => {
      const payload = mcPayload();
      payload.options = payload.options.map((o, i) => ({ ...o, label: i === 2 ? "A" : o.label }));
      await assert.rejects(
        () => createQuestion(adminA, payload),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("membuat soal jawaban singkat dengan kunci teks dan tanpa opsi", async () => {
      const created = await createQuestion(adminA, {
        subjectId: "sub_fiqh_a",
        type: "SHORT_ANSWER",
        stem: "Sebutkan rukun shalat yang ketiga!",
        shortAnswerKey: "Itidal",
      });

      assert.equal(created.type, "SHORT_ANSWER");
      assert.equal(created.shortAnswerKey, "Itidal");
      assert.equal(created.options.length, 0);
    });

    it("menolak jawaban singkat tanpa kunci jawaban teks", async () => {
      await assert.rejects(
        () =>
          createQuestion(adminA, {
            subjectId: "sub_fiqh_a",
            type: "SHORT_ANSWER",
            stem: "Sebutkan rukun shalat yang ketiga!",
          }),
        (err: unknown) => {
          assert(err instanceof ValidationError);
          assert(err.message.includes("kunci jawaban teks"));
          return true;
        }
      );
    });

    it("membuat soal essay dengan pedoman penskoran tanpa opsi", async () => {
      const created = await createQuestion(adminA, {
        subjectId: "sub_fiqh_a",
        type: "ESSAY",
        difficulty: "HARD",
        stem: "Jelaskan syarat-syarat wudu secara rinci.",
        explanation: "Rubrik: 20 poin syarat faroidh, 20 poin tata cara, 20 poin sunnah.",
      });

      assert.equal(created.type, "ESSAY");
      assert.equal(created.difficulty, "HARD");
      assert.ok(created.explanation?.includes("Rubrik"));
      assert.equal(created.options.length, 0);
      assert.equal(created.shortAnswerKey, null);
    });

    it("menolak opsi pada soal non-pilihan ganda", async () => {
      await assert.rejects(
        () =>
          createQuestion(adminA, {
            subjectId: "sub_math_a",
            type: "ESSAY",
            stem: "Buktikan teorema pythagoras!",
            options: [{ label: "A", content: "Tidak perlu", isCorrect: true }],
          }),
        (err: unknown) => err instanceof ValidationError
      );
    });

    it("mengubah soal berstatus ACTIVE tanpa mengubah statusnya", async () => {
      const seeded = seedQuestion({ status: "ACTIVE", createdById: "usr_admin_a" });

      const updated = await updateQuestion(adminA, seeded.id, {
        stem: "Berapa hasil dari 10 + 15?",
      });

      assert.equal(updated.stem, "Berapa hasil dari 10 + 15?");
      assert.equal(updated.status, "ACTIVE");
      assert.equal(inMemoryAuditLogs.at(-1).action, "UPDATE");
    });

    it("mengarsipkan soal DRAFT ke ARSIP", async () => {
      const seeded = seedQuestion({ status: "DRAFT" });

      const archived = await archiveQuestion(adminA, seeded.id);

      assert.equal(archived.status, "ARCHIVED");
      assert.equal(inMemoryAuditLogs.at(-1).action, "ARCHIVE");
    });

    it("menolak mengubah soal berstatus ARSIP", async () => {
      const seeded = seedQuestion({ status: "ARCHIVED" });

      await assert.rejects(
        () => updateQuestion(adminA, seeded.id, { stem: "Naskah baru?" }),
        (err: unknown) => {
          assert(err instanceof QuestionArchivedError);
          assert.equal(err.status, 400);
          return true;
        }
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).stem, "Butir soal awal?");
    });

    it("menolak transisi keluar dari status ARSIP (terminal)", async () => {
      const seeded = seedQuestion({ status: "ARCHIVED" });

      await assert.rejects(
        () => transitionQuestionStatus(adminA, seeded.id, { status: "ACTIVE" }),
        (err: unknown) => err instanceof QuestionArchivedError
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).status, "ARCHIVED");
    });

    it("menolak transisi status yang tidak diizinkan", async () => {
      // DRAFT hanya boleh -> ACTIVE/ARCHIVED; ARCHIVED terminal
      const seeded = seedQuestion({ status: "ACTIVE" });
      const archived = await transitionQuestionStatus(adminA, seeded.id, { status: "ARCHIVED" });
      assert.equal(archived.status, "ARCHIVED");

      await assert.rejects(
        () => transitionQuestionStatus(adminA, seeded.id, { status: "DRAFT" }),
        (err: unknown) => err instanceof QuestionArchivedError
      );
    });

    it("hapus lunak mengarsipkan soal tanpa menghapus baris (tanpa hard delete)", async () => {
      const seeded = seedQuestion({ status: "ACTIVE" });

      const deleted = await deleteQuestion(adminA, seeded.id);

      assert.equal(deleted.status, "ARCHIVED");
      assert.equal(inMemoryQuestions.length, 1, "baris soal wajib tetap ada");
      assert.equal(inMemoryAuditLogs.at(-1).action, "SOFT_DELETE");
    });

    it("mengubah tipe soal membuang opsi lama yang tidak relevan", async () => {
      const seeded = seedQuestion({ status: "DRAFT", type: "MULTIPLE_CHOICE" });

      const converted = await updateQuestion(adminA, seeded.id, {
        type: "SHORT_ANSWER",
        shortAnswerKey: "Jakarta",
      });

      assert.equal(converted.type, "SHORT_ANSWER");
      assert.equal(converted.options.length, 0);
      assert.equal(converted.shortAnswerKey, "Jakarta");
    });
  });

  // -------------------------------------------------------------------------
  // 2. RBAC & Resource Scope Guru
  // -------------------------------------------------------------------------
  describe("2. RBAC exam:view / exam:manage & Resource Scope Guru", () => {
    it("pemegang exam:view dapat membaca tetapi ditolak menulis", async () => {
      seedQuestion();

      const list = await listQuestions(viewerA);
      assert.equal(list.total, 1);

      await assert.rejects(
        () => createQuestion(viewerA, mcPayload()),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.status, 403);
          assert.equal(err.requiredPermission, "exam:manage");
          return true;
        }
      );
    });

    it("tanpa exam:view seluruh operasi ditolak AuthorizationError", async () => {
      await assert.rejects(
        () => listQuestions(financeA),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.requiredPermission, "exam:view");
          return true;
        }
      );

      await assert.rejects(
        () => createQuestion(financeA, mcPayload()),
        (err: unknown) => err instanceof AuthorizationError
      );
    });

    it("guru boleh mengubah soal miliknya sendiri", async () => {
      const seeded = seedQuestion({ createdById: "usr_teacher_a1", status: "ACTIVE" });

      const updated = await updateQuestion(teacherA1, seeded.id, {
        stem: "Naskah revisi guru sendiri?",
      });

      assert.equal(updated.stem, "Naskah revisi guru sendiri?");
    });

    it("guru ditolak mengubah soal guru lain pada lembaga yang sama", async () => {
      const seeded = seedQuestion({ createdById: "usr_teacher_a2" });

      await assert.rejects(
        () => updateQuestion(teacherA1, seeded.id, { stem: "Naskah milik guru lain?" }),
        (err: unknown) => {
          assert(err instanceof QuestionOwnershipError);
          assert.equal(err.status, 403);
          return true;
        }
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).stem, "Butir soal awal?");
    });

    it("guru ditolak mengarsipkan soal guru lain", async () => {
      const seeded = seedQuestion({ createdById: "usr_teacher_a2", status: "ACTIVE" });

      await assert.rejects(
        () => archiveQuestion(teacherA1, seeded.id),
        (err: unknown) => err instanceof QuestionOwnershipError
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).status, "ACTIVE");
    });

    it("ADMIN (pemegang academic:manage) boleh mengubah soal siapa pun dalam lembaganya", async () => {
      const seeded = seedQuestion({ createdById: "usr_teacher_a1", status: "ACTIVE" });

      const updated = await updateQuestion(adminA, seeded.id, {
        explanation: "Pembahasan ditinjau oleh admin sekolah.",
      });

      assert.equal(updated.explanation, "Pembahasan ditinjau oleh admin sekolah.");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Tenant Isolation
  // -------------------------------------------------------------------------
  describe("3. Tenant Isolation (Silang-Lembaga)", () => {
    it("daftar soal lembaga A tidak pernah memuat soal lembaga B", async () => {
      seedQuestion({ institutionId: instAId, subjectId: "sub_math_a" });
      seedQuestion({ institutionId: instAId, subjectId: "sub_fiqh_a" });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b", createdById: "usr_admin_b" });

      const listA = await listQuestions(adminA);
      const listB = await listQuestions(adminB);

      assert.equal(listA.total, 2);
      assert.ok(listA.data.every((q) => q.institutionId === instAId));
      assert.equal(listB.total, 1);
      assert.ok(listB.data.every((q) => q.institutionId === instBId));
    });

    it("getQuestion silang-lembaga ditolak (soal lain seolah tidak ada)", async () => {
      const seeded = seedQuestion({ institutionId: instBId, subjectId: "sub_math_b" });

      await assert.rejects(
        () => getQuestion(adminA, seeded.id),
        (err: unknown) => {
          assert(err instanceof QuestionNotFoundError);
          assert.equal(err.status, 404);
          return true;
        }
      );
    });

    it("update silang-lembaga ditolak", async () => {
      const seeded = seedQuestion({ institutionId: instBId, subjectId: "sub_math_b" });

      await assert.rejects(
        () => updateQuestion(adminA, seeded.id, { stem: "Penyusupan lintas lembaga?" }),
        (err: unknown) => err instanceof QuestionNotFoundError
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).stem, "Butir soal awal?");
    });

    it("hapus lunak silang-lembaga ditolak", async () => {
      const seeded = seedQuestion({ institutionId: instBId, subjectId: "sub_math_b" });

      await assert.rejects(
        () => deleteQuestion(adminA, seeded.id),
        (err: unknown) => err instanceof QuestionNotFoundError
      );
      assert.equal(inMemoryQuestions.find((q) => q.id === seeded.id).status, "DRAFT");
    });

    it("membuat soal dengan subjectId milik lembaga lain ditolak", async () => {
      await assert.rejects(
        () => createQuestion(adminA, mcPayload("sub_math_b")),
        (err: unknown) => {
          assert(err instanceof QuestionSubjectNotFoundError);
          assert.equal(err.status, 404);
          return true;
        }
      );
      assert.equal(inMemoryQuestions.length, 0);
    });

    it("filter daftar soal tetap terikat institusi ctx meski klien mengirim filter lain", async () => {
      seedQuestion({ institutionId: instAId });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b" });

      const list = await listQuestions(adminA, { subjectId: "sub_math_b" });
      assert.equal(list.total, 0, "subjectId lembaga B tidak boleh membocorkan soal lembaga B");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Plugin Guard
  // -------------------------------------------------------------------------
  describe("4. Plugin Guard FORMAL_ACADEMIC", () => {
    it("operasi ditolak DomainFeatureDisabledError 403 bila plugin nonaktif", async () => {
      enabledPlugins = "[]";

      await assert.rejects(
        () => createQuestion(adminA, mcPayload()),
        (err: unknown) => {
          assert(err instanceof DomainFeatureDisabledError);
          assert.equal(err.status, 403);
          assert.equal(err.pluginId, "FORMAL_ACADEMIC");
          return true;
        }
      );

      await assert.rejects(
        () => listQuestions(adminA),
        (err: unknown) => err instanceof DomainFeatureDisabledError
      );
      assert.equal(inMemoryQuestions.length, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Kategori & Ringkasan (Agregat Query)
  // -------------------------------------------------------------------------
  describe("5. Category Service — Filter Mapel/Topik/Tingkat & Ringkasan", () => {
    it("ringkasan bank soal menghitung status, kesulitan, mapel, dan topik dari query agregat", async () => {
      seedQuestion({ status: "DRAFT", subjectId: "sub_math_a", topic: "Aljabar", difficulty: "EASY" });
      seedQuestion({ status: "DRAFT", subjectId: "sub_math_a", topic: "Aljabar", difficulty: "MEDIUM" });
      seedQuestion({ status: "ACTIVE", subjectId: "sub_fiqh_a", topic: "Thaharah", difficulty: "HARD" });
      seedQuestion({ status: "ARCHIVED", subjectId: "sub_fiqh_a", topic: null, difficulty: "EASY" });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b", status: "ACTIVE" });

      const summary = await getQuestionBankSummary(adminA);

      assert.equal(summary.total, 4);
      assert.deepEqual(summary.byStatus, { DRAFT: 2, ACTIVE: 1, ARCHIVED: 1 });
      assert.deepEqual(summary.byDifficulty, { EASY: 2, MEDIUM: 1, HARD: 1 });
      assert.equal(summary.subjectCount, 2);
      assert.deepEqual(summary.topics, ["Aljabar", "Thaharah"]);
      assert.equal(summary.topicCount, 2);
    });

    it("distribusi kategori per mata pelajaran hanya memuat lembaga ctx", async () => {
      seedQuestion({ subjectId: "sub_math_a" });
      seedQuestion({ subjectId: "sub_math_a" });
      seedQuestion({ subjectId: "sub_fiqh_a" });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b" });

      const categories = await listQuestionCategories(adminA);

      assert.equal(categories.length, 2);
      assert.deepEqual(
        categories.map((c) => [c.subjectId, c.questionCount]),
        [
          ["sub_math_a", 2],
          ["sub_fiqh_a", 1],
        ]
      );
      assert.equal(categories[0].subjectName, "Matematika");
      assert.equal(categories[0].subjectCode, "MTK");
      assert.ok(categories.every((c) => c.subjectId !== "sub_math_b"));
    });

    it("daftar topik unik dapat difokuskan per mata pelajaran", async () => {
      seedQuestion({ subjectId: "sub_math_a", topic: "Aljabar" });
      seedQuestion({ subjectId: "sub_math_a", topic: "Aljabar" });
      seedQuestion({ subjectId: "sub_math_a", topic: "Geometri" });
      seedQuestion({ subjectId: "sub_fiqh_a", topic: "Thaharah" });
      seedQuestion({ subjectId: "sub_fiqh_a", topic: null });

      const allTopics = await listQuestionTopics(adminA);
      assert.deepEqual(allTopics, ["Aljabar", "Geometri", "Thaharah"]);

      const mathTopics = await listQuestionTopics(adminA, "sub_math_a");
      assert.deepEqual(mathTopics, ["Aljabar", "Geometri"]);
    });

    it("distribusi tingkat kesulitan dihitung dari data lembaga ctx", async () => {
      seedQuestion({ difficulty: "EASY" });
      seedQuestion({ difficulty: "EASY" });
      seedQuestion({ difficulty: "HARD" });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b", difficulty: "EASY" });

      const distribution = await getQuestionDifficultyDistribution(adminA);

      assert.deepEqual(distribution, { EASY: 2, MEDIUM: 0, HARD: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Impor & Ekspor Soal
  // -------------------------------------------------------------------------
  describe("6. Importer & Exporter Soal", () => {
    const IMPORT_HEADERS = [
      "Kode/Nama Mapel*",
      "Tipe Soal* (MULTIPLE_CHOICE / SHORT_ANSWER / ESSAY)",
      "Tingkat Kesulitan (EASY / MEDIUM / HARD)",
      "Topik/Bab",
      "Naskah Soal*",
      "Opsi A",
      "Opsi B",
      "Opsi C",
      "Opsi D",
      "Kunci Jawaban (label A-D)",
      "Kunci Jawaban Singkat",
      "Pembahasan / Rubrik",
      "Status (DRAFT / ACTIVE)",
    ];

    const VALID_MC_ROW = [
      "MTK",
      "MULTIPLE_CHOICE",
      "MEDIUM",
      "Aljabar",
      "Berapa hasil dari 2 + 2?",
      "4",
      "5",
      "6",
      "7",
      "B",
      "",
      "",
      "DRAFT",
    ];

    const DOUBLE_KEY_ROW = [
      "MTK",
      "PG",
      "EASY",
      "Aljabar",
      "Pilih pernyataan yang benar!",
      "w",
      "x",
      "y",
      "z",
      "A,C",
      "",
      "",
      "DRAFT",
    ];

    const VALID_ESSAY_ROW = [
      "FIQ",
      "ESSAY",
      "SULIT",
      "Thaharah",
      "Jelaskan tata cara wudu secara rinci!",
      "",
      "",
      "",
      "",
      "",
      "",
      "Rubrik: kelengkapan langkah (60), urutan (40).",
      "DRAFT",
    ];

    function buildQuestionSheetBuffer(rows: string[][]): Buffer {
      const worksheet = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Soal");
      const out = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return Buffer.isBuffer(out) ? out : Buffer.from(out);
    }

    it("preview impor menandai baris kunci ganda sebagai ERROR dan baris valid sebagai VALID", async () => {
      const buffer = buildQuestionSheetBuffer([VALID_MC_ROW, DOUBLE_KEY_ROW, VALID_ESSAY_ROW]);

      const preview = await generateQuestionImportPreview(adminA, buffer, "bank-soal.xlsx");

      assert.equal(preview.summary.totalRows, 3);
      assert.equal(preview.summary.validRows, 2);
      assert.equal(preview.summary.errorRows, 1);
      assert.equal(preview.canProceed, true);

      const [mcRow, doubleKeyRow, essayRow] = preview.rows;
      assert.equal(mcRow.status, "VALID");
      assert.equal(mcRow.action, "CREATE");
      assert.equal(mcRow.payload?.subjectId, "sub_math_a");
      assert.equal(mcRow.payload?.options.length, 4);
      assert.equal(mcRow.payload?.options.filter((o) => o.isCorrect).length, 1);

      assert.equal(doubleKeyRow.status, "ERROR");
      assert.equal(doubleKeyRow.action, "REJECT");
      assert.ok(doubleKeyRow.errors.some((e) => e.message.includes("1 kunci")));

      assert.equal(essayRow.status, "VALID");
      assert.equal(essayRow.payload?.type, "ESSAY");
      assert.equal(essayRow.payload?.subjectId, "sub_fiqh_a");
    });

    it("preview impor menolak baris dengan mata pelajaran lembaga lain (isolasi tenant)", async () => {
      const buffer = buildQuestionSheetBuffer([
        ["MTK B", ...VALID_MC_ROW.slice(1)],
        ["SAINS", ...DOUBLE_KEY_ROW.slice(1)],
      ]);

      const preview = await generateQuestionImportPreview(adminA, buffer, "lain-lembaga.xlsx");

      assert.equal(preview.summary.validRows, 0);
      assert.equal(preview.summary.errorRows, 2);
      assert.ok(
        preview.rows.every((row) =>
          row.errors.some((e) => e.message.includes("tidak ditemukan pada lembaga ini"))
        )
      );
      assert.equal(preview.canProceed, false);
    });

    it("preview impor ditolak AuthorizationError tanpa izin exam:manage", async () => {
      const buffer = buildQuestionSheetBuffer([VALID_MC_ROW]);

      await assert.rejects(
        () => generateQuestionImportPreview(financeA, buffer, "bank-soal.xlsx"),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.requiredPermission, "exam:manage");
          return true;
        }
      );
    });

    it("eksekusi impor membuat soal valid pada lembaga ctx dengan AuditLog impor", async () => {
      const buffer = buildQuestionSheetBuffer([VALID_MC_ROW, DOUBLE_KEY_ROW, VALID_ESSAY_ROW]);
      const preview = await generateQuestionImportPreview(adminA, buffer, "bank-soal.xlsx");

      const result = await executeQuestionImport(adminA, preview.rows);

      assert.equal(result.totalProcessed, 3);
      assert.equal(result.createdQuestions, 2);
      assert.equal(result.failedRows, 0);
      assert.equal(result.skippedRows, 1);

      assert.equal(inMemoryQuestions.length, 2);
      assert.ok(
        inMemoryQuestions.every(
          (q) => q.institutionId === instAId && q.createdById === "usr_admin_a"
        )
      );

      const mc = inMemoryQuestions.find((q) => q.type === "MULTIPLE_CHOICE");
      assert.equal(mc.options.length, 4);
      assert.equal(mc.options.filter((o: any) => o.isCorrect).length, 1);
      assert.equal(inMemoryAuditLogs.filter((a) => a.action === "CREATE").length, 2);
      assert.equal(inMemoryAuditLogs.filter((a) => a.action === "IMPORT").length, 1);
    });

    it("eksekusi impor menolak payload tidak valid yang disisipkan klien (re-validasi server)", async () => {
      const forged = {
        rowNumber: 99,
        status: "VALID",
        action: "CREATE",
        raw: {},
        errors: [],
        warnings: [],
        payload: { ...mcPayload(), options: mcPayload().options.map((o) => ({ ...o, isCorrect: true })) },
      };

      const result = await executeQuestionImport(adminA, [forged]);

      assert.equal(result.createdQuestions, 0);
      assert.equal(result.failedRows, 1);
      assert.equal(inMemoryQuestions.length, 0);
    });

    it("ekspor CSV menghasilkan baris sebanyak soal pada lembaga ctx saja", async () => {
      seedQuestion({ institutionId: instAId, subjectId: "sub_math_a", status: "ACTIVE" });
      seedQuestion({ institutionId: instAId, subjectId: "sub_fiqh_a", status: "DRAFT" });
      seedQuestion({ institutionId: instBId, subjectId: "sub_math_b", createdById: "usr_admin_b" });

      const { csv, total, fileName } = await exportQuestionsCSV(adminA);

      assert.equal(total, 2);
      assert.ok(fileName.endsWith(".csv"));

      const lines = csv.split("\r\n");
      assert.equal(lines[0], QUESTION_EXPORT_HEADERS.join(","));
      assert.equal(lines.length - 1, 2, "baris data CSV harus sejumlah soal lembaga ctx");
      assert.ok(!csv.includes(instBId), "soal lembaga B tidak boleh bocor ke ekspor lembaga A");
      assert.ok(csv.includes('"Matematika"'));
      assert.ok(csv.includes('"Fikih"'));
      assert.ok(csv.includes('"A"'), "kunci jawaban (label A) ikut diekspor");
      assert.ok(csv.includes('"Satu"'), "konten opsi ikut diekspor");
    });

    it("ekspor ditolak AuthorizationError tanpa izin exam:view", async () => {
      await assert.rejects(
        () => exportQuestionsCSV(financeA),
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          assert.equal(err.requiredPermission, "exam:view");
          return true;
        }
      );
    });

    it("template impor soal terbentuk valid dan bisa langsung di-preview ulang", async () => {
      const templateBuffer = generateQuestionImportTemplateBuffer();
      assert.ok(templateBuffer.length > 0);

      const preview = await generateQuestionImportPreview(
        adminA,
        templateBuffer,
        "Template_Import_Soal_NataSekolah.xlsx"
      );

      assert.equal(preview.summary.totalRows, 2);
      assert.equal(preview.summary.validRows, 2, "kedua baris contoh pada template harus valid");
      assert.equal(preview.canProceed, true);
      assert.equal(preview.rows[1].payload?.type, "SHORT_ANSWER");
      assert.ok(preview.rows[1].payload?.shortAnswerKey);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Server Actions (Kaidah Next.js 16: seluruh ekspor harus async)
  // -------------------------------------------------------------------------
  describe("7. Server Actions src/actions/question-bank.ts", () => {
    const REQUIRED_ACTIONS = [
      "getQuestionsAction",
      "getQuestionByIdAction",
      "createQuestionAction",
      "updateQuestionAction",
      "updateQuestionStatusAction",
      "archiveQuestionAction",
      "deleteQuestionAction",
      "getQuestionBankSummaryAction",
      "getQuestionCategoriesAction",
      "getQuestionTopicsAction",
      "getQuestionDifficultyDistributionAction",
      "previewQuestionImportAction",
      "executeQuestionImportAction",
      "getQuestionImportTemplateAction",
      "exportQuestionsCsvAction",
    ];

    it("seluruh ekspor action bersifat async function (kaidah Next.js 16)", () => {
      const exportNames = Object.keys(questionBankActions);
      assert.ok(exportNames.length >= REQUIRED_ACTIONS.length);

      for (const name of exportNames) {
        const value = (questionBankActions as Record<string, unknown>)[name];
        assert.equal(typeof value, "function", `${name} harus berupa function`);
        assert.equal(
          (value as { constructor: { name: string } }).constructor.name,
          "AsyncFunction",
          `${name} harus async agar tidak memicu runtime 500`
        );
      }
    });

    it("menyediakan seluruh aksi CRUD, siklus status, kategori, impor, dan ekspor sesuai plan", () => {
      for (const name of REQUIRED_ACTIONS) {
        assert.equal(
          typeof (questionBankActions as Record<string, unknown>)[name],
          "function",
          `aksi ${name} harus tersedia`
        );
      }
    });
  });
});
