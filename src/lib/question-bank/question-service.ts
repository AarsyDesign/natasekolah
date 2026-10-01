import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { requirePlugin } from "../plugins/guard";
import { PLUGINS } from "../plugins/registry";
import {
  validateCreateQuestionInput,
  validateUpdateQuestionInput,
  validateUpdateQuestionStatusInput,
  validateQuestionFilter,
  QUESTION_STATUS_TRANSITIONS,
  type CreateQuestionInput,
  type QuestionFilter,
  type QuestionOptionInput,
  type QuestionStatus,
  type QuestionType,
} from "../validation/question-bank";
import {
  QuestionArchivedError,
  QuestionNotFoundError,
  QuestionOwnershipError,
  QuestionSubjectNotFoundError,
  InvalidQuestionStatusTransitionError,
  type QuestionWithOptions,
} from "./types";

/**
 * Layanan Domain Bank Soal (Question Bank) NataSekolah — Phase 7.
 *
 * Rantai otorisasi wajib runut pada setiap operasi:
 * Session -> Tenant Isolation -> RBAC (exam:view/exam:manage) -> Plugin (FORMAL_ACADEMIC) -> Domain Resource
 *
 * - institutionId SELALU berasal dari ctx (tidak pernah dari payload klien).
 * - Resource scope guru: tanpa `academic:manage`, guru hanya mengelola soal
 *   miliknya sendiri (createdById = ctx.userId).
 * - Tanpa hard delete: hapus lunak = status ARCHIVED + AuditLog.
 */

const questionInclude = {
  options: { orderBy: { label: "asc" as const } },
  subject: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.QuestionInclude;

/**
 * Guard plugin: Question Bank berada di dalam scope plugin FORMAL_ACADEMIC (R6c).
 * Melempar DomainFeatureDisabledError (403) bila plugin nonaktif pada lembaga.
 */
export async function assertQuestionBankPlugin(ctx: TenantContext): Promise<void> {
  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
    select: { enabledPlugins: true },
  });
  if (institution) {
    requirePlugin(institution, PLUGINS.FORMAL_ACADEMIC);
  }
}

/**
 * Resource scope guru: ADMIN/PRINCIPAL/SUPER_ADMIN (pemegang academic:manage)
 * bebas mengelola seluruh soal lembaga; guru lain hanya soal miliknya.
 */
function assertQuestionWriteScope(
  ctx: TenantContext,
  question: { createdById: string }
): void {
  if (hasPermission(ctx, "academic:manage")) return;
  if (question.createdById !== ctx.userId) {
    throw new QuestionOwnershipError();
  }
}

/**
 * Tenant isolation: subjectId wajib milik lembaga aktif.
 */
async function ensureSubjectInTenant(ctx: TenantContext, subjectId: string): Promise<void> {
  const subject = await prisma.subject.findUnique({
    where: {
      id_institutionId: { id: subjectId, institutionId: ctx.institutionId },
    },
    select: { id: true },
  });
  if (!subject) {
    throw new QuestionSubjectNotFoundError(subjectId);
  }
}

function toOptionInput(option: { label: string; content: string; isCorrect: boolean }): QuestionOptionInput {
  return {
    label: option.label as QuestionOptionInput["label"],
    content: option.content,
    isCorrect: option.isCorrect,
  };
}

/**
 * Menyimpan soal baru beserta opsinya (tanpa guard — wajib dipanggil dari
 * fungsi yang sudah melewati RBAC + plugin guard, mis. createQuestion/impor).
 */
export async function insertQuestion(
  ctx: TenantContext,
  input: CreateQuestionInput
): Promise<QuestionWithOptions> {
  await ensureSubjectInTenant(ctx, input.subjectId);

  const created = await prisma.question.create({
    data: {
      institutionId: ctx.institutionId,
      subjectId: input.subjectId,
      createdById: ctx.userId,
      type: input.type,
      difficulty: input.difficulty,
      topic: input.topic ?? null,
      stem: input.stem,
      explanation: input.explanation ?? null,
      shortAnswerKey: input.shortAnswerKey ?? null,
      status: input.status,
      options: {
        // institutionId TIDAK dikirim: field ini bagian FK compound
        // [questionId, institutionId] → Prisma mengecilkannya dari input
        // nested dan mengisinya otomatis dari induk.
        create: input.options.map((opt) => ({
          label: opt.label,
          content: opt.content,
          isCorrect: opt.isCorrect,
        })),
      },
    },
    include: questionInclude,
  });

  await prisma.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId || null,
      action: "CREATE",
      entityType: "Question",
      detailsJson: JSON.stringify({
        questionId: created.id,
        type: created.type,
        status: created.status,
        subjectId: created.subjectId,
      }),
    },
  });

  return created as unknown as QuestionWithOptions;
}

/**
 * Membuat butir soal baru (status default DRAFT).
 */
export async function createQuestion(
  ctx: TenantContext,
  rawInput: unknown
): Promise<QuestionWithOptions> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Zod Validation (termasuk invariant tipe soal)
  const validated = validateCreateQuestionInput(rawInput);

  // 4. Sanitasi Anti-Tampering (institutionId / roles tidak pernah dari klien)
  const sanitized = sanitizeClientInput(validated, ctx);

  // 5. Eksekusi insert (tenant isolation pada subjectId + AuditLog)
  return insertQuestion(ctx, sanitized);
}

/**
 * Mengubah isi butir soal. Soal ARSIP tidak dapat diubah.
 * Invariant tipe soal diverifikasi ulang terhadap gabungan data lama + patch.
 */
export async function updateQuestion(
  ctx: TenantContext,
  questionId: string,
  rawInput: unknown
): Promise<QuestionWithOptions> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Zod Validation (parsial)
  const patch = validateUpdateQuestionInput(rawInput);

  // 4. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(patch, ctx);

  // 5. Ambil soal pada tenant aktif
  const existing = await prisma.question.findUnique({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    include: { options: { orderBy: { label: "asc" } } },
  });
  if (!existing) {
    throw new QuestionNotFoundError(questionId);
  }
  if (existing.status === "ARCHIVED") {
    throw new QuestionArchivedError(questionId);
  }

  // 6. Resource scope guru
  assertQuestionWriteScope(ctx, existing);

  // 7. Gabungkan data lama + patch lalu validasi invariant penuh
  const effectiveType = (sanitized.type ?? existing.type) as QuestionType;
  const typeChanged = effectiveType !== existing.type;
  const optionsProvided = sanitized.options !== undefined;

  const mergedOptions: QuestionOptionInput[] = optionsProvided
    ? sanitized.options ?? []
    : typeChanged
      ? [] // tipe berubah tanpa opsi baru -> opsi lama tidak relevan
      : existing.options.map(toOptionInput);

  const merged = validateCreateQuestionInput({
    subjectId: sanitized.subjectId ?? existing.subjectId,
    type: effectiveType,
    difficulty: sanitized.difficulty ?? existing.difficulty,
    topic: sanitized.topic !== undefined ? sanitized.topic : existing.topic,
    stem: sanitized.stem ?? existing.stem,
    explanation: sanitized.explanation !== undefined ? sanitized.explanation : existing.explanation,
    shortAnswerKey:
      sanitized.shortAnswerKey !== undefined
        ? sanitized.shortAnswerKey
        : typeChanged
          ? null
          : existing.shortAnswerKey,
    options: mergedOptions,
    status: existing.status,
  });

  // 8. Tenant isolation pada subjectId bila berubah
  if (merged.subjectId !== existing.subjectId) {
    await ensureSubjectInTenant(ctx, merged.subjectId);
  }

  const replaceOptions = optionsProvided || typeChanged;
  const updated = await prisma.question.update({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    data: {
      subjectId: merged.subjectId,
      type: merged.type,
      difficulty: merged.difficulty,
      topic: merged.topic ?? null,
      stem: merged.stem,
      explanation: merged.explanation ?? null,
      shortAnswerKey: merged.shortAnswerKey ?? null,
      ...(replaceOptions
        ? {
            options: {
              deleteMany: {},
              // institutionId tidak dikirim — FK compound terisi dari induk.
              create: merged.options.map((opt) => ({
                label: opt.label,
                content: opt.content,
                isCorrect: opt.isCorrect,
              })),
            },
          }
        : {}),
    },
    include: questionInclude,
  });

  await prisma.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId || null,
      action: "UPDATE",
      entityType: "Question",
      detailsJson: JSON.stringify({ questionId, fields: Object.keys(sanitized) }),
    },
  });

  return updated as unknown as QuestionWithOptions;
}

/**
 * Mengubah siklus status soal (DRAFT <-> ACTIVE -> ARSIP).
 */
export async function transitionQuestionStatus(
  ctx: TenantContext,
  questionId: string,
  rawInput: unknown
): Promise<QuestionWithOptions> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Zod Validation
  const { status: targetStatus } = validateUpdateQuestionStatusInput(rawInput);

  // 4. Ambil soal pada tenant aktif
  const existing = await prisma.question.findUnique({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    include: questionInclude,
  });
  if (!existing) {
    throw new QuestionNotFoundError(questionId);
  }

  // 5. Resource scope guru
  assertQuestionWriteScope(ctx, existing);

  // 6. Idempoten: arsip ulang tidak menimpa data
  if (existing.status === targetStatus) {
    return existing as QuestionWithOptions;
  }

  // 7. ARSIP bersifat terminal
  if (existing.status === "ARCHIVED") {
    throw new QuestionArchivedError(questionId);
  }

  // 8. Validasi transisi siklus
  const allowed = QUESTION_STATUS_TRANSITIONS[existing.status as QuestionStatus] ?? [];
  if (!allowed.includes(targetStatus as QuestionStatus)) {
    throw new InvalidQuestionStatusTransitionError(existing.status, targetStatus);
  }

  const updated = await prisma.question.update({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    data: { status: targetStatus },
    include: questionInclude,
  });

  await prisma.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId || null,
      action: targetStatus === "ARCHIVED" ? "ARCHIVE" : "STATUS_CHANGE",
      entityType: "Question",
      detailsJson: JSON.stringify({ questionId, from: existing.status, to: targetStatus }),
    },
  });

  return updated as unknown as QuestionWithOptions;
}

/**
 * Arsipkan soal (DRAFT/ACTIVE -> ARSIP).
 */
export async function archiveQuestion(
  ctx: TenantContext,
  questionId: string
): Promise<QuestionWithOptions> {
  return transitionQuestionStatus(ctx, questionId, { status: "ARCHIVED" });
}

/**
 * Hapus lunak (soft delete): soal dipindahkan ke ARSIP + dicatat di AuditLog.
 * Hard delete tidak pernah dilakukan agar soal yang sudah terpakai tidak hilang diam-diam.
 */
export async function deleteQuestion(
  ctx: TenantContext,
  questionId: string
): Promise<QuestionWithOptions> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Ambil soal pada tenant aktif
  const existing = await prisma.question.findUnique({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    include: questionInclude,
  });
  if (!existing) {
    throw new QuestionNotFoundError(questionId);
  }

  // 4. Resource scope guru
  assertQuestionWriteScope(ctx, existing);

  if (existing.status === "ARCHIVED") {
    return existing as QuestionWithOptions;
  }

  const updated = await prisma.question.update({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    data: { status: "ARCHIVED" },
    include: questionInclude,
  });

  await prisma.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId || null,
      action: "SOFT_DELETE",
      entityType: "Question",
      detailsJson: JSON.stringify({ questionId, previousStatus: existing.status }),
    },
  });

  return updated as unknown as QuestionWithOptions;
}

/**
 * Detail satu butir soal (termasuk opsi & pembuat).
 */
export async function getQuestion(
  ctx: TenantContext,
  questionId: string
): Promise<QuestionWithOptions> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  const question = await prisma.question.findUnique({
    where: { id_institutionId: { id: questionId, institutionId: ctx.institutionId } },
    include: questionInclude,
  });
  if (!question) {
    throw new QuestionNotFoundError(questionId);
  }

  return question as QuestionWithOptions;
}


/**
 * Membangun klausa where terisolasi tenant untuk query soal.
 * institutionId SELALU berasal dari ctx — tidak pernah dari payload klien.
 */
export function buildQuestionWhereClause(
  ctx: TenantContext,
  filter: QuestionFilter
): Prisma.QuestionWhereInput {
  return {
    institutionId: ctx.institutionId,
    ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
    ...(filter.createdById ? { createdById: filter.createdById } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.topic ? { topic: filter.topic } : {}),
    ...(filter.search
      ? {
          OR: [
            { stem: { contains: filter.search, mode: "insensitive" } },
            { topic: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/**
 * Daftar soal pada lembaga aktif dengan filter + pagination.
 * Seluruh pemegang exam:view dapat membaca seluruh soal lembaga;
 * pembatasan resource scope guru berlaku pada operasi tulis.
 */
export async function listQuestions(
  ctx: TenantContext,
  rawQuery?: unknown
): Promise<{
  data: QuestionWithOptions[];
  items: QuestionWithOptions[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Validasi filter
  const filter: QuestionFilter = validateQuestionFilter(rawQuery ?? {});

  // 4. Susun klausa where (institutionId selalu dari ctx)
  const where = buildQuestionWhereClause(ctx, filter);

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  const [data, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: questionInclude,
    }),
    prisma.question.count({ where }),
  ]);

  return {
    data: data as QuestionWithOptions[],
    items: data as QuestionWithOptions[],
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
  };
}