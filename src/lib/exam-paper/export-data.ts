/**
 * Sumber data tunggal untuk ekspor naskah ujian (Phase 10.3, PRD #31).
 *
 * `buildExamPaperData()` dipakai BERSAMA oleh exporter PDF (Phase 10.3) dan
 * DOCX (Phase 10.4) sehingga tidak ada perbedaan isi antar format.
 *
 * Invariant keamanan:
 * - Guard `exam:manage` + plugin FORMAL_ACADEMIC (ekspor = aksi cetak resmi).
 * - institutionId SELALU dari ctx; naskah lembaga lain = tidak ada (compound FK).
 * - Hash `verifyToken` TIDAK PERNAH masuk ke dalam data hasil build (anti-leak).
 * - Logo lembaga (bila ada) diambil best-effort; kegagalan jaringan tidak
 *   menggagalkan ekspor (kop tetap tampil tanpa logo).
 */

import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ExamNotFoundError } from "./types";
import { assertExamPaperPlugin } from "./exam-paper-service";

// ---------------------------------------------------------------------------
// Tipe data
// ---------------------------------------------------------------------------

export interface ExamPaperInstitutionInfo {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  /** Buffer logo hasil fetch best-effort (null bila tidak ada / gagal). */
  logoBuffer: Buffer | null;
}

export interface ExamPaperOptionItem {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface ExamPaperQuestionItem {
  questionId: string;
  order: number;
  points: number;
  type: string;
  difficulty: string;
  topic: string | null;
  stem: string;
  explanation: string | null;
  shortAnswerKey: string | null;
  options: ExamPaperOptionItem[];
}

export interface ExamPaperData {
  institution: ExamPaperInstitutionInfo;
  exam: {
    id: string;
    title: string;
    examType: string;
    status: string;
    instructions: string | null;
    showAnswers: boolean;
    columnLayout: string;
    createdAt: Date;
    updatedAt: Date;
  };
  subject: { name: string; code: string | null } | null;
  academicYear: { name: string } | null;
  createdBy: { name: string } | null;
  questions: ExamPaperQuestionItem[];
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Basis URL absolut untuk QR verifikasi (`/verify/exam/<token>`).
 * Dipakai juga oleh exporter lain — jangan duplikasi aturan fallback.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** URL publik verifikasi naskah dari token mentah. */
export function buildVerifyUrl(rawToken: string): string {
  return `${getAppBaseUrl()}/verify/exam/${rawToken}`;
}

/** Fetch logo lembaga best-effort (hanya http/https, timeout 5 detik, max 2 MB). */
async function fetchLogoSafe(logoUrl: string): Promise<Buffer | null> {
  if (!/^https?:\/\//i.test(logoUrl)) {
    return null; // path relatif / data URL tidak diambil (hindari kejutan SSRF lokal)
  }
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 2 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Bangun data naskah lengkap untuk keperluan cetak/ekspor.
 *
 * @throws AuthorizationError bila sesi tanpa `exam:manage`
 * @throws DomainFeatureDisabledError bila plugin FORMAL_ACADEMIC nonaktif
 * @throws ExamNotFoundError bila naskah tidak ada pada lembaga aktif
 */
export async function buildExamPaperData(
  ctx: TenantContext,
  examId: string
): Promise<ExamPaperData> {
  // 1. RBAC Guard — ekspor adalah aksi kelola naskah
  requirePermission(ctx, "exam:manage");

  // 2. Plugin Guard
  await assertExamPaperPlugin(ctx);

  // 3. Ambil naskah + komposisi terurut (compound FK -> cross-tenant = 404)
  const exam = await prisma.exam.findUnique({
    where: { id_institutionId: { id: examId, institutionId: ctx.institutionId } },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: { include: { options: { orderBy: { label: "asc" } } } },
        },
      },
      subject: { select: { name: true, code: true } },
      academicYear: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!exam) {
    throw new ExamNotFoundError(examId);
  }

  // 4. Kop lembaga + logo best-effort
  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
    select: { name: true, address: true, phone: true, logoUrl: true },
  });
  const logoBuffer = institution?.logoUrl
    ? await fetchLogoSafe(institution.logoUrl)
    : null;

  // 5. Susun data TANPA hash verifyToken (tidak pernah dibaca di sini)
  return {
    institution: {
      name: institution?.name ?? "Lembaga",
      address: institution?.address ?? null,
      phone: institution?.phone ?? null,
      logoUrl: institution?.logoUrl ?? null,
      logoBuffer,
    },
    exam: {
      id: exam.id,
      title: exam.title,
      examType: exam.examType,
      status: exam.status,
      instructions: exam.instructions,
      showAnswers: exam.showAnswers,
      columnLayout: exam.columnLayout,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
    },
    subject: exam.subject ? { name: exam.subject.name, code: exam.subject.code } : null,
    academicYear: exam.academicYear ? { name: exam.academicYear.name } : null,
    createdBy: exam.createdBy ? { name: exam.createdBy.name } : null,
    questions: exam.questions.map((row) => ({
      questionId: row.questionId,
      order: row.order,
      points: row.points,
      type: row.question.type,
      difficulty: row.question.difficulty,
      topic: row.question.topic,
      stem: row.question.stem,
      explanation: row.question.explanation,
      shortAnswerKey: row.question.shortAnswerKey,
      options: row.question.options.map((opt) => ({
        label: opt.label,
        content: opt.content,
        isCorrect: opt.isCorrect,
      })),
    })),
    generatedAt: new Date(),
  };
}
