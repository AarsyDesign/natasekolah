import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { assertQuestionBankPlugin } from "./question-service";
import type { QuestionDifficulty, QuestionStatus } from "../validation/question-bank";

/**
 * Layanan Kategori & Ringkasan Bank Soal (Phase 7).
 *
 * Menyediakan pemetaan filter mata pelajaran / topik / tingkat kesulitan
 * beserta ringkasan metrik untuk Blok 2 Metric Summary Bar.
 * Seluruh query terikat pada ctx.institutionId (tenant isolation).
 */

export interface QuestionBankSummary {
  total: number;
  byStatus: Record<QuestionStatus, number>;
  byDifficulty: Record<QuestionDifficulty, number>;
  subjectCount: number;
  topicCount: number;
  topics: string[];
}

export interface QuestionCategoryBucket {
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  questionCount: number;
}

/**
 * Ringkasan metrik bank soal (angka berasal dari query agregat, bukan placeholder).
 */
export async function getQuestionBankSummary(ctx: TenantContext): Promise<QuestionBankSummary> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  const scope = { institutionId: ctx.institutionId };

  const [total, draft, active, archived, easy, medium, hard, subjectRows, topicRows] =
    await Promise.all([
      prisma.question.count({ where: scope }),
      prisma.question.count({ where: { ...scope, status: "DRAFT" } }),
      prisma.question.count({ where: { ...scope, status: "ACTIVE" } }),
      prisma.question.count({ where: { ...scope, status: "ARCHIVED" } }),
      prisma.question.count({ where: { ...scope, difficulty: "EASY" } }),
      prisma.question.count({ where: { ...scope, difficulty: "MEDIUM" } }),
      prisma.question.count({ where: { ...scope, difficulty: "HARD" } }),
      prisma.question.findMany({
        where: scope,
        distinct: ["subjectId"],
        select: { subjectId: true },
      }),
      prisma.question.findMany({
        where: { ...scope, topic: { not: null } },
        distinct: ["topic"],
        select: { topic: true },
      }),
    ]);

  const topics = topicRows
    .map((row) => row.topic)
    .filter((topic): topic is string => typeof topic === "string" && topic.length > 0)
    .sort((a, b) => a.localeCompare(b, "id"));

  return {
    total,
    byStatus: { DRAFT: draft, ACTIVE: active, ARCHIVED: archived },
    byDifficulty: { EASY: easy, MEDIUM: medium, HARD: hard },
    subjectCount: subjectRows.length,
    topicCount: topics.length,
    topics,
  };
}

/**
 * Distribusi jumlah soal per mata pelajaran (dipakai dropdown filter & ringkasan).
 */
export async function listQuestionCategories(ctx: TenantContext): Promise<QuestionCategoryBucket[]> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  const grouped = await prisma.question.groupBy({
    by: ["subjectId"],
    where: { institutionId: ctx.institutionId },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const subjects = await prisma.subject.findMany({
    where: {
      institutionId: ctx.institutionId,
      id: { in: grouped.map((row) => row.subjectId) },
    },
    select: { id: true, name: true, code: true },
  });
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  return grouped
    .map((row) => {
      const subject = subjectById.get(row.subjectId);
      return {
        subjectId: row.subjectId,
        subjectName: subject?.name ?? null,
        subjectCode: subject?.code ?? null,
        questionCount: row._count._all,
      };
    })
    .sort(
      (a, b) =>
        b.questionCount - a.questionCount ||
        (a.subjectName ?? "").localeCompare(b.subjectName ?? "", "id")
    );
}

/**
 * Daftar topik/bab unik pada lembaga aktif (opsional per mata pelajaran).
 */
export async function listQuestionTopics(
  ctx: TenantContext,
  subjectId?: string
): Promise<string[]> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  const rows = await prisma.question.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(subjectId ? { subjectId } : {}),
      topic: { not: null },
    },
    distinct: ["topic"],
    select: { topic: true },
  });

  return rows
    .map((row) => row.topic)
    .filter((topic): topic is string => typeof topic === "string" && topic.length > 0)
    .sort((a, b) => a.localeCompare(b, "id"));
}

/**
 * Distribusi jumlah soal per tingkat kesulitan.
 */
export async function getQuestionDifficultyDistribution(
  ctx: TenantContext
): Promise<Record<QuestionDifficulty, number>> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  const scope = { institutionId: ctx.institutionId };
  const [easy, medium, hard] = await Promise.all([
    prisma.question.count({ where: { ...scope, difficulty: "EASY" } }),
    prisma.question.count({ where: { ...scope, difficulty: "MEDIUM" } }),
    prisma.question.count({ where: { ...scope, difficulty: "HARD" } }),
  ]);

  return { EASY: easy, MEDIUM: medium, HARD: hard };
}
