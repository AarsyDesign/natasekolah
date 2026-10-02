/**
 * Domain types, constants, and error definitions for the Exam Paper Engine (Phase 10, PRD #31).
 *
 * Catatan: naskah ujian TIDAK PERNAH di-hard delete — "hapus" = status
 * ARCHIVED + AuditLog (historical data is sacred).
 * Token verifikasi QR disimpan sebagai HASH SHA-256; token mentah hanya
 * dikembalikan sesaat saat diterbitkan (regenerateToken) dan tidak pernah
 * disimpan maupun dicatat di AuditLog.
 */

import type { Exam, ExamQuestion, Question, QuestionOption } from "@prisma/client";

/** Komposisi naskah: satu baris ExamQuestion lengkap dengan butir soalnya. */
export type ExamQuestionWithQuestion = ExamQuestion & {
  question: Question & { options: QuestionOption[] };
};

/** Naskah ujian tanpa hash token (tidak pernah dikirim ke klien). */
export type PublicExam = Omit<Exam, "verifyToken">;

/** Naskah ujian lengkap untuk halaman detail (komposisi terurut + metadata). */
export type ExamWithQuestions = PublicExam & {
  questions?: ExamQuestionWithQuestion[];
  subject?: { id: string; name: string; code: string | null } | null;
  academicYear?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  _count?: { questions: number };
};

/** Identitas ringkas untuk halaman verifikasi publik (tanpa soal & tanpa data tenant lain). */
export interface ExamPublicIdentity {
  title: string;
  examType: string;
  status: string;
  institutionName: string | null;
  subjectName: string | null;
  academicYearName: string | null;
  issuedAt: Date | null;
}

/**
 * Basis galat domain Exam Paper Engine.
 */
export class ExamPaperError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "EXAM_PAPER_ERROR", status = 400) {
    super(message);
    this.name = "ExamPaperError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Naskah tidak ditemukan pada lembaga aktif (termasuk kasus silang-lembaga:
 * compound unique [id, institutionId] membuat naskah lembaga lain = tidak ada).
 */
export class ExamNotFoundError extends ExamPaperError {
  readonly examId: string;

  constructor(examId: string) {
    super(
      `Naskah ujian dengan ID [${examId}] tidak ditemukan pada lembaga ini.`,
      "EXAM_NOT_FOUND",
      404
    );
    this.name = "ExamNotFoundError";
    this.examId = examId;
  }
}

/**
 * Naskah berstatus ISSUED/ARCHIVED tidak boleh disusun ulang komposisinya.
 */
export class ExamLockedError extends ExamPaperError {
  readonly examId: string;
  readonly examStatus: string;

  constructor(examId: string, examStatus: string) {
    super(
      `Naskah ujian berstatus ${examStatus} dan tidak dapat diubah komposisinya. Naskah yang sudah diterbitkan/diarsipkan hanya bisa diarsipkan.`,
      "EXAM_LOCKED",
      400
    );
    this.name = "ExamLockedError";
    this.examId = examId;
    this.examStatus = examStatus;
  }
}

/**
 * Transisi siklus status naskah tidak diizinkan
 * (DRAFT -> READY -> ISSUED -> ARCHIVED).
 */
export class ExamInvalidTransitionError extends ExamPaperError {
  constructor(from: string, to: string) {
    super(
      `Transisi status naskah tidak valid: [${from}] -> [${to}].`,
      "INVALID_EXAM_STATUS_TRANSITION",
      400
    );
    this.name = "ExamInvalidTransitionError";
  }
}

/**
 * Soal yang diminta tidak ditemukan pada lembaga aktif
 * (cross-tenant = treated as tidak ada).
 */
export class ExamQuestionNotFoundError extends ExamPaperError {
  readonly questionId: string;

  constructor(questionId: string) {
    super(
      `Soal dengan ID [${questionId}] tidak ditemukan pada lembaga ini.`,
      "EXAM_QUESTION_NOT_FOUND",
      404
    );
    this.name = "ExamQuestionNotFoundError";
    this.questionId = questionId;
  }
}

/**
 * Soal berasal dari mata pelajaran lain — komposisi naskah harus se-mapel
 * dengan mata pelajaran naskah.
 */
export class ExamQuestionSubjectMismatchError extends ExamPaperError {
  readonly questionId: string;

  constructor(questionId: string) {
    super(
      `Soal dengan ID [${questionId}] bukan milik mata pelajaran naskah ini. Tarik hanya soal dari mata pelajaran yang sama.`,
      "EXAM_QUESTION_SUBJECT_MISMATCH",
      400
    );
    this.name = "ExamQuestionSubjectMismatchError";
    this.questionId = questionId;
  }
}

/**
 * Komposisi naskah melebihi batas jumlah soal (EXAM_MAX_QUESTIONS).
 */
export class ExamQuestionLimitError extends ExamPaperError {
  constructor(limit: number, current: number) {
    super(
      `Naskah sudah mencapai batas maksimal ${limit} butir soal (saat ini ${current}).`,
      "EXAM_QUESTION_LIMIT_EXCEEDED",
      400
    );
    this.name = "ExamQuestionLimitError";
  }
}

/**
 * Token verifikasi tidak ditemukan (halaman publik /verify/exam/<token>).
 */
export class ExamVerifyTokenNotFoundError extends ExamPaperError {
  constructor() {
    super(
      "Naskah ujian dengan token verifikasi tersebut tidak ditemukan.",
      "EXAM_VERIFY_TOKEN_NOT_FOUND",
      404
    );
    this.name = "ExamVerifyTokenNotFoundError";
  }
}
