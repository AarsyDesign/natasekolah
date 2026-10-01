/**
 * Domain types, constants, and error definitions for the Question Bank (Phase 7).
 *
 * Catatan siklus soal: soal tidak pernah di-hard delete.
 * "Hapus lunak" = status ARCHIVED + AuditLog (historical data is sacred).
 */

import type { Question, QuestionOption } from "@prisma/client";

/** Tipe butir soal lengkap dengan relasi opsi & metadata pembuat. */
export type QuestionWithOptions = Question & {
  options: QuestionOption[];
  subject?: { id: string; name: string; code: string | null } | null;
  createdBy?: { id: string; name: string } | null;
};

/**
 * Basis galat domain Bank Soal.
 */
export class QuestionBankError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "QUESTION_BANK_ERROR", status = 400) {
    super(message);
    this.name = "QuestionBankError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Soal tidak ditemukan pada lembaga aktif (termasuk kasus silang-lembaga:
 * compound unique [id, institutionId] membuat soal lembaga lain = tidak ada).
 */
export class QuestionNotFoundError extends QuestionBankError {
  readonly questionId: string;

  constructor(questionId: string) {
    super(
      `Soal dengan ID [${questionId}] tidak ditemukan pada lembaga ini.`,
      "QUESTION_NOT_FOUND",
      404
    );
    this.name = "QuestionNotFoundError";
    this.questionId = questionId;
  }
}

/**
 * Resource scope guru: guru dengan exam:manage hanya mengelola soal miliknya sendiri.
 */
export class QuestionOwnershipError extends QuestionBankError {
  constructor(
    message = "Anda hanya diizinkan mengelola soal yang Anda buat sendiri. Hubungi admin sekolah untuk mengelola soal guru lain."
  ) {
    super(message, "QUESTION_ACCESS_DENIED", 403);
    this.name = "QuestionOwnershipError";
  }
}

/**
 * Soal berstatus ARSIP bersifat terminal dan tidak boleh diubah lagi.
 */
export class QuestionArchivedError extends QuestionBankError {
  readonly questionId: string;

  constructor(questionId: string) {
    super(
      `Soal dengan ID [${questionId}] berstatus ARSIP dan tidak dapat diubah. Buat soal baru bila naskah perlu diperbarui.`,
      "QUESTION_ARCHIVED",
      400
    );
    this.name = "QuestionArchivedError";
    this.questionId = questionId;
  }
}

/**
 * Transisi siklus status soal tidak diizinkan (DRAFT -> ACTIVE -> ARCHIVED).
 */
export class InvalidQuestionStatusTransitionError extends QuestionBankError {
  constructor(from: string, to: string) {
    super(
      `Transisi status soal tidak valid: [${from}] -> [${to}].`,
      "INVALID_QUESTION_STATUS_TRANSITION",
      400
    );
    this.name = "InvalidQuestionStatusTransitionError";
  }
}

/**
 * subjectId rujukan tidak ditemukan pada lembaga aktif (tenant isolation).
 */
export class QuestionSubjectNotFoundError extends QuestionBankError {
  readonly subjectId: string;

  constructor(subjectId: string) {
    super(
      `Mata pelajaran dengan ID [${subjectId}] tidak ditemukan pada lembaga ini.`,
      "QUESTION_SUBJECT_NOT_FOUND",
      404
    );
    this.name = "QuestionSubjectNotFoundError";
    this.subjectId = subjectId;
  }
}

/**
 * File impor soal tidak dapat diproses (format atau isi tidak valid).
 */
export class QuestionImportError extends QuestionBankError {
  constructor(message: string) {
    super(message, "QUESTION_IMPORT_ERROR", 400);
    this.name = "QuestionImportError";
  }
}
