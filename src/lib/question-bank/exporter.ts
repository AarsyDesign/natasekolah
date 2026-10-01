import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { validateQuestionFilter } from "../validation/question-bank";
import {
  assertQuestionBankPlugin,
  buildQuestionWhereClause,
} from "./question-service";
import type { QuestionWithOptions } from "./types";

/**
 * Ekspor Bank Soal (Phase 7) — pola CSV mengikuti src/lib/finance/export-utils.ts.
 * Seluruh baris ekspor berasal dari lembaga ctx saja (tenant isolation).
 * Konsumen klien memakai downloadCSV() untuk menambahkan BOM UTF-8 + unduhan.
 */

export const QUESTION_EXPORT_HEADERS = [
  "ID Soal",
  "Mata Pelajaran",
  "Kode Mapel",
  "Topik",
  "Tipe Soal",
  "Tingkat Kesulitan",
  "Status",
  "Naskah Soal",
  "Opsi A",
  "Opsi B",
  "Opsi C",
  "Opsi D",
  "Kunci Jawaban",
  "Pembahasan",
  "Dibuat Oleh",
  "Tanggal Dibuat",
] as const;

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function optionContent(question: QuestionWithOptions, label: string): string {
  return question.options.find((opt) => opt.label === label)?.content ?? "";
}

function correctAnswerText(question: QuestionWithOptions): string {
  if (question.type === "SHORT_ANSWER") return question.shortAnswerKey ?? "";
  const labels = question.options.filter((opt) => opt.isCorrect).map((opt) => opt.label);
  return labels.join(", ");
}

/**
 * Mengubah daftar soal menjadi konten CSV (tanpa BOM; BOM ditambahkan oleh
 * downloadCSV di sisi klien).
 */
export function buildQuestionsCSV(questions: QuestionWithOptions[]): string {
  const rows = questions.map((question) =>
    [
      escapeCSV(question.id),
      escapeCSV(question.subject?.name ?? ""),
      escapeCSV(question.subject?.code ?? ""),
      escapeCSV(question.topic ?? "-"),
      escapeCSV(question.type),
      escapeCSV(question.difficulty),
      escapeCSV(question.status),
      escapeCSV(question.stem),
      escapeCSV(optionContent(question, "A")),
      escapeCSV(optionContent(question, "B")),
      escapeCSV(optionContent(question, "C")),
      escapeCSV(optionContent(question, "D")),
      escapeCSV(correctAnswerText(question)),
      escapeCSV(question.explanation ?? "-"),
      escapeCSV(question.createdBy?.name ?? "-"),
      escapeCSV(question.createdAt.toLocaleDateString("id-ID")),
    ].join(",")
  );

  return [QUESTION_EXPORT_HEADERS.join(","), ...rows].join("\r\n");
}

/**
 * Mengambil seluruh soal lembaga ctx sesuai filter lalu men-generate CSV.
 * Guard: exam:view + plugin FORMAL_ACADEMIC.
 */
export async function exportQuestionsCSV(
  ctx: TenantContext,
  rawQuery?: unknown
): Promise<{ fileName: string; csv: string; total: number }> {
  // 1. RBAC Guard
  requirePermission(ctx, "exam:view");

  // 2. Plugin Guard
  await assertQuestionBankPlugin(ctx);

  // 3. Filter tervalidasi + klausa where terisolasi tenant
  const filter = validateQuestionFilter(rawQuery ?? {});
  const where = buildQuestionWhereClause(ctx, filter);

  const questions = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      options: { orderBy: { label: "asc" } },
      subject: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const typedQuestions = questions as QuestionWithOptions[];

  return {
    fileName: `Bank_Soal_${new Date().toISOString().slice(0, 10)}.csv`,
    csv: buildQuestionsCSV(typedQuestions),
    total: typedQuestions.length,
  };
}
