/**
 * Domain types, constants, and error definitions for Tahfidz Mutaba'ah Core (Phase 6).
 */

export const TAHFIDZ_TYPES = ["SETORAN", "MURAJAAH"] as const;
export type TahfidzType = (typeof TAHFIDZ_TYPES)[number];

export function isValidTahfidzType(type: string): type is TahfidzType {
  return (TAHFIDZ_TYPES as readonly string[]).includes(type);
}

export const TAHFIDZ_QUALITIES = [
  "MUMTAZ",
  "JAYYID",
  "MAQBUL",
  "REPEAT",
] as const;
export type TahfidzQuality = (typeof TAHFIDZ_QUALITIES)[number];

export function isValidTahfidzQuality(quality: string): quality is TahfidzQuality {
  return (TAHFIDZ_QUALITIES as readonly string[]).includes(quality);
}

/**
 * Basis galat domain tahfidz & halaqah
 */
export class TahfidzDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "TAHFIDZ_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "TahfidzDomainError";
    this.code = code;
    this.status = status;
  }
}

export class InvalidSurahError extends TahfidzDomainError {
  constructor(surah: number) {
    super(
      `Nomor surah (${surah}) tidak valid. Surah Al-Qur'an berada dalam rentang 1 sampai 114.`,
      "INVALID_SURAH_NUMBER",
      400
    );
    this.name = "InvalidSurahError";
  }
}

export class InvalidAyahRangeError extends TahfidzDomainError {
  constructor(message: string) {
    super(message, "INVALID_AYAH_RANGE", 400);
    this.name = "InvalidAyahRangeError";
  }
}

export class StudentEnrollmentMismatchError extends TahfidzDomainError {
  constructor(studentId: string, enrollmentId: string) {
    super(
      `Enrollment (${enrollmentId}) tidak cocok dengan santri (${studentId}). Riwayat tahfidz harus merujuk enrollment resmi santri tersebut.`,
      "STUDENT_ENROLLMENT_MISMATCH",
      400
    );
    this.name = "StudentEnrollmentMismatchError";
  }
}

export class TahfidzRecordNotFoundError extends TahfidzDomainError {
  constructor(id: string) {
    super(`Rekaman tahfidz dengan ID '${id}' tidak ditemukan.`, "TAHFIDZ_RECORD_NOT_FOUND", 404);
    this.name = "TahfidzRecordNotFoundError";
  }
}

export class TahfidzAccessDeniedError extends TahfidzDomainError {
  constructor(message = "Akses rekaman tahfidz ditolak.") {
    super(message, "TAHFIDZ_ACCESS_DENIED", 403);
    this.name = "TahfidzAccessDeniedError";
  }
}
