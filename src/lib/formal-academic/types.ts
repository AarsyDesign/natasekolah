/**
 * Types & Domain Errors for Formal Academic Core - NataSekolah (Phase 5)
 */

export class FormalAcademicError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "FORMAL_ACADEMIC_ERROR", status = 400) {
    super(message);
    this.name = "FormalAcademicError";
    this.code = code;
    this.status = status;
  }
}

export class AssessmentNotFoundError extends FormalAcademicError {
  constructor(id: string) {
    super(`Penilaian dengan ID [${id}] tidak ditemukan.`, "ASSESSMENT_NOT_FOUND", 404);
    this.name = "AssessmentNotFoundError";
  }
}

export class AssessmentOwnershipError extends FormalAcademicError {
  constructor(message = "Akses ditolak: Anda hanya dapat mengelola penilaian pada rombel dan mata pelajaran yang ditugaskan kepada Anda.") {
    super(message, "ASSESSMENT_OWNERSHIP_DENIED", 403);
    this.name = "AssessmentOwnershipError";
  }
}

export class InvalidScoreRangeError extends FormalAcademicError {
  constructor(score: number, maxScore: number) {
    super(
      `Nilai [${score}] tidak valid. Nilai harus berada dalam rentang 0 s.d. ${maxScore}.`,
      "INVALID_SCORE_RANGE",
      400
    );
    this.name = "InvalidScoreRangeError";
  }
}

export class InvalidEnrollmentScopeError extends FormalAcademicError {
  constructor(studentName: string, reason = "Siswa tidak terdaftar pada rombel dan tahun ajaran penilaian ini.") {
    super(`Validasi siswa [${studentName}] gagal: ${reason}`, "INVALID_ENROLLMENT_SCOPE", 400);
    this.name = "InvalidEnrollmentScopeError";
  }
}

export class DuplicateScoreError extends FormalAcademicError {
  constructor(studentId: string, assessmentId: string) {
    super(
      `Nilai untuk siswa [${studentId}] pada penilaian [${assessmentId}] sudah ada.`,
      "DUPLICATE_SCORE",
      409
    );
    this.name = "DuplicateScoreError";
  }
}

export class ReportCardNotFoundError extends FormalAcademicError {
  constructor(id: string) {
    super(`Buku raport dengan ID [${id}] tidak ditemukan.`, "REPORT_CARD_NOT_FOUND", 404);
    this.name = "ReportCardNotFoundError";
  }
}

export class ReportCardAlreadyPublishedError extends FormalAcademicError {
  constructor(id: string) {
    super(
      `Raport [${id}] sudah berstatus PUBLISHED dan telah dibekukan (frozen). Raport yang telah terbit tidak dapat dimodifikasi atau diterbitkan ulang.`,
      "REPORT_CARD_ALREADY_PUBLISHED",
      400
    );
    this.name = "ReportCardAlreadyPublishedError";
  }
}

/**
 * Konversi nilai numerik (0-100) menjadi predikat huruf.
 */
export function calculateLetterGrade(score: number): "A" | "B" | "C" | "D" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}
