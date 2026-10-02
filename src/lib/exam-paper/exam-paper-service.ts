import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { requirePlugin } from "../plugins/guard";
import { PLUGINS } from "../plugins/registry";
import { ResourceNotFoundError } from "../academic/types";
import { ValidationError } from "../validation/common";
import {
  validateCreateExamInput,
  validateAddExamQuestionsInput,
  validateSetExamQuestionPointsInput,
  validateReorderExamQuestionsInput,
  validateUpdateExamStatusInput,
  validateExamFilter,
  EXAM_STATUS_TRANSITIONS,
  EXAM_MAX_QUESTIONS,
  type ExamFilter,
  type ExamStatus,
} from "../validation/exam-paper";
import {
  ExamNotFoundError,
  ExamLockedError,
  ExamInvalidTransitionError,
  ExamQuestionNotFoundError,
  ExamQuestionSubjectMismatchError,
  ExamQuestionLimitError,
  ExamVerifyTokenNotFoundError,
  type ExamPublicIdentity,
  type ExamWithQuestions,
  type PublicExam,
} from "./types";

/**
 * Layanan Domain Exam Paper Engine (PRD #31) — Phase 10.
 *
 * Rantai otorisasi wajib runut pada setiap operasi:
 * Session -> Tenant Isolation -> RBAC (exam:view/exam:manage) -> Plugin (FORMAL_ACADEMIC) -> Domain Resource
 *
 * - institutionId SELALU berasal dari ctx (tidak pernah dari payload klien).
 * - Tanpa hard delete: hapus lunak = status ARCHIVED + AuditLog.
 * - Token verifikasi QR disimpan sebagai HASH SHA-256 saja; token mentah
 *   hanya dikembalikan sesaat oleh `regenerateToken` dan tidak pernah
 *   disimpan maupun dicatat di AuditLog.
 */

/** Status yang mengunci komposisi naskah (soal tidak boleh ditambah/diubah). */
const COMPOSITION_LOCKED_STATUSES = ["ISSUED", "ARCHIVED"];

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Guard plugin: Exam Paper Engine berada di dalam scope plugin FORMAL_ACADEMIC.
 * (Ambil baris institusi dulu — jangan kirim string UUID ke requirePlugin,
 *  lihat pitfall Phase 8.5.)
 */
export async function assertExamPaperPlugin(ctx: TenantContext): Promise<void> {
  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
    select: { enabledPlugins: true },
  });
  if (institution) {
    requirePlugin(institution, PLUGINS.FORMAL_ACADEMIC);
  }
}

// ---------------------------------------------------------------------------
// Helpers internal
// ---------------------------------------------------------------------------

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Token QR verifikasi acak (base64url) + hash yang disimpan ke DB. */
function mintVerifyToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: sha256(raw) };
}

/** Hash token mentah dari URL publik /verify/exam/<token>. */
function hashRawVerifyToken(rawToken: string): string {
  return sha256(rawToken.trim());
}

/** Sembunyikan hash token dari setiap hasil baca yang dikembalikan ke klien. */
function stripVerifyToken<T extends { verifyToken: string }>(exam: T): Omit<T, "verifyToken"> {
  const { verifyToken: _hash, ...rest } = exam;
  return rest;
}

async function getExamOrThrow(
  ctx: TenantContext,
  examId: string,
  include?: Prisma.ExamInclude
) {
  const exam = await prisma.exam.findUnique({
    where: { id_institutionId: { id: examId, institutionId: ctx.institutionId } },
    ...(include ? { include } : {}),
  });
  if (!exam) {
    throw new ExamNotFoundError(examId);
  }
  return exam;
}

/** Komposisi hanya boleh diubah selama DRAFT/READY. */
function assertCompositionWritable(exam: { id: string; status: string }): void {
  if (COMPOSITION_LOCKED_STATUSES.includes(exam.status)) {
    throw new ExamLockedError(exam.id, exam.status);
  }
}

async function writeExamAuditLog(
  ctx: TenantContext,
  action: "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ARCHIVE",
  exam: { id: string; status: string; title: string },
  details: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId || null,
      action,
      entityType: "Exam",
      entityId: exam.id,
      detailsJson: JSON.stringify({
        title: exam.title,
        status: exam.status,
        ...details,
      }),
    },
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Membuat naskah ujian baru (status default DRAFT).
 * Token verifikasi QR di-generate saat create (hash-only); token mentah
 * hanya diperoleh lewat `regenerateToken`.
 */
export async function createExam(
  ctx: TenantContext,
  rawInput: unknown
): Promise<PublicExam> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertExamPaperPlugin(ctx);

  // 3. Zod Validation
  const validated = validateCreateExamInput(rawInput);

  // 4. Sanitasi Anti-Tampering (institutionId tidak pernah dari klien)
  const sanitized = sanitizeClientInput(validated, ctx);

  // 5. Tenant isolation: tahun ajaran & mata pelajaran wajib milik lembaga
  const [academicYear, subject] = await Promise.all([
    prisma.academicYear.findUnique({
      where: {
        id_institutionId: { id: sanitized.academicYearId, institutionId: ctx.institutionId },
      },
      select: { id: true },
    }),
    prisma.subject.findUnique({
      where: { id_institutionId: { id: sanitized.subjectId, institutionId: ctx.institutionId } },
      select: { id: true },
    }),
  ]);
  if (!academicYear) {
    throw new ResourceNotFoundError("Tahun ajaran", sanitized.academicYearId);
  }
  if (!subject) {
    throw new ResourceNotFoundError("Mata pelajaran", sanitized.subjectId);
  }

  // 6. Insert + AuditLog (token hash TIDAK pernah ikut log)
  const { hash } = mintVerifyToken();
  const created = await prisma.exam.create({
    data: {
      institutionId: ctx.institutionId,
      academicYearId: sanitized.academicYearId,
      subjectId: sanitized.subjectId,
      createdById: ctx.userId,
      title: sanitized.title,
      examType: sanitized.examType,
      instructions: sanitized.instructions ?? null,
      showAnswers: sanitized.showAnswers,
      columnLayout: sanitized.columnLayout,
      status: "DRAFT",
      verifyToken: hash,
    },
  });

  await writeExamAuditLog(ctx, "CREATE", created, {
    subjectId: created.subjectId,
    academicYearId: created.academicYearId,
    examType: created.examType,
    columnLayout: created.columnLayout,
  });

  return stripVerifyToken(created) as PublicExam;
}

// ---------------------------------------------------------------------------
// Komposisi soal
// ---------------------------------------------------------------------------

/**
 * Tarik butir soal dari Bank Soal ke dalam naskah.
 *
 * Invariant:
 * 1. Soal wajib milik lembaga aktif (cross-tenant = treated as tidak ada).
 * 2. Soal wajib se-mapel dengan mata pelajaran naskah.
 * 3. Soal yang sudah ada di naskah dilewati (idempoten), tidak diduplikasi.
 * 4. Total butir dibatasi EXAM_MAX_QUESTIONS.
 * 5. Naskah ISSUED/ARCHIVED terkunci.
 */
export async function addQuestions(
  ctx: TenantContext,
  examId: string,
  rawInput: unknown
): Promise<{ added: number; skipped: number; total: number }> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertExamPaperPlugin(ctx);

  // 3. Zod Validation
  const { questionIds } = validateAddExamQuestionsInput(rawInput);

  // 4. Ambil naskah pada tenant aktif + guard status
  const exam = await getExamOrThrow(ctx, examId);
  assertCompositionWritable(exam);

  // 5. Kandidat unik (input bisa mengandung duplikat — sudah ditolak Zod;
  //    di sini kita hanya mempertahankan urutan masuk)
  const requested = [...new Set(questionIds)];

  // 6. Cek batas jumlah komposisi
  const existingRows = await prisma.examQuestion.findMany({
    where: { examId: exam.id, institutionId: ctx.institutionId },
    select: { questionId: true, order: true },
  });
  const existingIds = new Set(existingRows.map((row) => row.questionId));
  const candidates = requested.filter((id) => !existingIds.has(id));
  const skipped = requested.length - candidates.length;

  if (existingIds.size + candidates.length > EXAM_MAX_QUESTIONS) {
    throw new ExamQuestionLimitError(EXAM_MAX_QUESTIONS, existingIds.size);
  }

  if (candidates.length === 0) {
    return { added: 0, skipped, total: existingIds.size };
  }

  // 7. Validasi kepemilikan soal (tenant + se-mapel)
  for (const questionId of candidates) {
    const question = await prisma.question.findUnique({
      where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
      select: { id: true, subjectId: true },
    });
    if (!question) {
      throw new ExamQuestionNotFoundError(questionId);
    }
    if (question.subjectId !== exam.subjectId) {
      throw new ExamQuestionSubjectMismatchError(questionId);
    }
  }

  // 8. Susun baris komposisi (urutan lanjutan, poin default)
  const maxOrder = existingRows.reduce((max, row) => Math.max(max, row.order), 0);
  await prisma.examQuestion.createMany({
    data: candidates.map((questionId, index) => ({
      institutionId: ctx.institutionId,
      examId: exam.id,
      questionId,
      order: maxOrder + index + 1,
    })),
  });

  const total = existingIds.size + candidates.length;
  await writeExamAuditLog(ctx, "UPDATE", exam, {
    action: "addQuestions",
    added: candidates.length,
    skipped,
    total,
  });

  return { added: candidates.length, skipped, total };
}

/**
 * Atur poin satu butir soal dalam naskah (1..100).
 */
export async function setQuestionPoints(
  ctx: TenantContext,
  examId: string,
  rawInput: unknown
): Promise<{ questionId: string; points: number }> {
  requirePermission(ctx, "exam:manage");
  await assertExamPaperPlugin(ctx);

  const input = validateSetExamQuestionPointsInput(rawInput);

  const exam = await getExamOrThrow(ctx, examId);
  assertCompositionWritable(exam);

  const row = await prisma.examQuestion.findUnique({
    where: { examId_questionId: { examId: exam.id, questionId: input.questionId } },
    select: { id: true, points: true },
  });
  if (!row) {
    throw new ExamQuestionNotFoundError(input.questionId);
  }

  await prisma.examQuestion.update({
    where: { id: row.id },
    data: { points: input.points },
  });

  await writeExamAuditLog(ctx, "UPDATE", exam, {
    action: "setQuestionPoints",
    questionId: input.questionId,
    points: input.points,
  });

  return { questionId: input.questionId, points: input.points };
}

/**
 * Atur ulang urutan cetak naskah. Daftar input WAJIB tepat memuat seluruh
 * soal yang ada di naskah (tidak lebih, tidak kurang) agar tidak ada soal
 * yang terlewat saat dicetak.
 */
export async function reorderQuestions(
  ctx: TenantContext,
  examId: string,
  rawInput: unknown
): Promise<{ order: string[] }> {
  requirePermission(ctx, "exam:manage");
  await assertExamPaperPlugin(ctx);

  const { questionIds } = validateReorderExamQuestionsInput(rawInput);

  const exam = await getExamOrThrow(ctx, examId);
  assertCompositionWritable(exam);

  const rows = await prisma.examQuestion.findMany({
    where: { examId: exam.id, institutionId: ctx.institutionId },
    select: { id: true, questionId: true },
  });

  const rowByQuestionId = new Map(rows.map((row) => [row.questionId, row]));
  const missing = rows.filter((row) => !questionIds.includes(row.questionId));
  const unknown = questionIds.filter((id) => !rowByQuestionId.has(id));

  if (missing.length > 0 || unknown.length > 0) {
    throw new ValidationError(
      "Urutan soal harus memuat tepat seluruh soal pada naskah ini.",
      [
        ...missing.map((row) => ({
          field: "questionIds",
          message: `Soal [${row.questionId}] tidak ada dalam urutan yang dikirim`,
          code: "MISSING_QUESTION",
        })),
        ...unknown.map((id) => ({
          field: "questionIds",
          message: `Soal [${id}] tidak termasuk dalam naskah ini`,
          code: "UNKNOWN_QUESTION",
        })),
      ]
    );
  }

  await prisma.$transaction(
    questionIds.map((questionId, index) =>
      prisma.examQuestion.update({
        where: { id: rowByQuestionId.get(questionId)!.id },
        data: { order: index + 1 },
      })
    )
  );

  await writeExamAuditLog(ctx, "UPDATE", exam, {
    action: "reorderQuestions",
    count: questionIds.length,
  });

  return { order: questionIds };
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------

/**
 * Daftar naskah pada lembaga aktif dengan filter + pagination (exam:view).
 * Hash token verifikasi tidak pernah ikut dalam hasil.
 */
export async function listExams(
  ctx: TenantContext,
  rawQuery?: unknown
): Promise<{
  data: ExamWithQuestions[];
  items: ExamWithQuestions[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  requirePermission(ctx, "exam:view");
  await assertExamPaperPlugin(ctx);

  const filter: ExamFilter = validateExamFilter(rawQuery ?? {});

  const where: Prisma.ExamWhereInput = {
    institutionId: ctx.institutionId,
    ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
    ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.examType ? { examType: filter.examType } : {}),
    ...(filter.search
      ? { title: { contains: filter.search, mode: "insensitive" as const } }
      : {}),
  };

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  const [rows, total] = await Promise.all([
    prisma.exam.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
    }),
    prisma.exam.count({ where }),
  ]);

  const data = rows.map((row) => stripVerifyToken(row)) as unknown as ExamWithQuestions[];

  return {
    data,
    items: data,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
  };
}

/**
 * Detail satu naskah termasuk komposisi soal terurut (exam:view).
 * Hash token verifikasi tidak pernah ikut dalam hasil.
 */
export async function getExamDetail(
  ctx: TenantContext,
  examId: string
): Promise<ExamWithQuestions> {
  requirePermission(ctx, "exam:view");
  await assertExamPaperPlugin(ctx);

  const exam = await getExamOrThrow(ctx, examId, {
    questions: {
      orderBy: { order: "asc" },
      include: {
        question: {
          include: {
            options: { orderBy: { label: "asc" } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    },
    subject: { select: { id: true, name: true, code: true } },
    academicYear: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
  });

  return stripVerifyToken(exam) as unknown as ExamWithQuestions;
}

// ---------------------------------------------------------------------------
// Siklus status
// ---------------------------------------------------------------------------

/**
 * Transisi siklus status naskah (DRAFT <-> READY -> ISSUED -> ARCHIVED).
 * ARCHIVED terminal dan bersifat idempoten (menggantikan hard delete).
 */
export async function transitionExamStatus(
  ctx: TenantContext,
  examId: string,
  rawInput: unknown
): Promise<PublicExam> {
  requirePermission(ctx, "exam:manage");
  await assertExamPaperPlugin(ctx);

  const { status: targetStatus } = validateUpdateExamStatusInput(rawInput);
  const exam = await getExamOrThrow(ctx, examId);

  // Idempoten: arsip ulang tidak menimpa data
  if (exam.status === targetStatus) {
    return stripVerifyToken(exam) as PublicExam;
  }

  // ARCHIVED terminal
  if (exam.status === "ARCHIVED") {
    throw new ExamInvalidTransitionError(exam.status, targetStatus);
  }

  const allowed = EXAM_STATUS_TRANSITIONS[exam.status as ExamStatus] ?? [];
  if (!allowed.includes(targetStatus as ExamStatus)) {
    throw new ExamInvalidTransitionError(exam.status, targetStatus);
  }

  const updated = await prisma.exam.update({
    where: { id_institutionId: { id: examId, institutionId: ctx.institutionId } },
    data: { status: targetStatus },
  });

  await writeExamAuditLog(
    ctx,
    targetStatus === "ARCHIVED" ? "ARCHIVE" : "STATUS_CHANGE",
    updated,
    { from: exam.status, to: targetStatus }
  );

  return stripVerifyToken(updated) as PublicExam;
}

/**
 * Arsipkan naskah (soft delete — hard delete tidak pernah dilakukan).
 */
export async function archiveExam(ctx: TenantContext, examId: string): Promise<PublicExam> {
  return transitionExamStatus(ctx, examId, { status: "ARCHIVED" });
}

// ---------------------------------------------------------------------------
// Token verifikasi QR
// ---------------------------------------------------------------------------

/**
 * Terbitkan (putar ulang) token verifikasi QR untuk sebuah naskah.
 *
 * Mengembalikan token MENTAH (sekali jalan) untuk dibuat QR
 * (/verify/exam/<token>); yang disimpan di DB hanya hash SHA-256-nya.
 * Token lama otomatis tidak berlaku setelah diputar ulang.
 *
 * Dipakai oleh alur ekspor (Phase 10.3): panggil sebelum mencetak QR.
 */
export async function regenerateToken(
  ctx: TenantContext,
  examId: string
): Promise<{ rawToken: string }> {
  requirePermission(ctx, "exam:manage");
  await assertExamPaperPlugin(ctx);

  const exam = await getExamOrThrow(ctx, examId);
  const { raw, hash } = mintVerifyToken();

  await prisma.exam.update({
    where: { id_institutionId: { id: examId, institutionId: ctx.institutionId } },
    data: { verifyToken: hash },
  });

  await writeExamAuditLog(ctx, "UPDATE", exam, { action: "regenerateVerifyToken" });

  return { rawToken: raw };
}

/**
 * Resolusi token QR dari URL publik /verify/exam/<token> menjadi identitas
 * ringkas naskah. TANPA izin sesi (publik) dan TANPA komposisi soal/kunci —
 * hanya identitas naskah + nama lembaga/mapel/tahun ajaran.
 *
 * @throws ExamVerifyTokenNotFoundError bila token tidak dikenal.
 */
export async function getExamPublicIdentity(
  rawToken: string
): Promise<ExamPublicIdentity> {
  if (!rawToken || !rawToken.trim()) {
    throw new ExamVerifyTokenNotFoundError();
  }

  const exam = await prisma.exam.findUnique({
    where: { verifyToken: hashRawVerifyToken(rawToken) },
    select: {
      title: true,
      examType: true,
      status: true,
      updatedAt: true,
      institution: { select: { name: true } },
      subject: { select: { name: true } },
      academicYear: { select: { name: true } },
    },
  });

  if (!exam) {
    throw new ExamVerifyTokenNotFoundError();
  }

  return {
    title: exam.title,
    examType: exam.examType,
    status: exam.status,
    institutionName: exam.institution?.name ?? null,
    subjectName: exam.subject?.name ?? null,
    academicYearName: exam.academicYear?.name ?? null,
    issuedAt: exam.updatedAt,
  };
}
