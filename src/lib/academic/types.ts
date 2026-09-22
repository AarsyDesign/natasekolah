/**
 * Tipe data domain, konstanta terdefinisi, dan galat domain untuk Academic Core & Buku Induk.
 */

export const STUDENT_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "GRADUATED",
  "TRANSFERRED",
  "ALUMNI",
] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export function isValidStudentStatus(status: string): status is StudentStatus {
  return (STUDENT_STATUSES as readonly string[]).includes(status);
}

export const ENROLLMENT_STATUSES = [
  "ENROLLED",
  "PROMOTED",
  "RETAINED",
  "GRADUATED",
  "TRANSFERRED",
  "DROPPED_OUT",
] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export function isValidEnrollmentStatus(status: string): status is EnrollmentStatus {
  return (ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

export const GENDERS = ["L", "P"] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Basis galat domain akademik
 */
export class AcademicDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "ACADEMIC_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "AcademicDomainError";
    this.code = code;
    this.status = status;
  }
}

export class DuplicateNisError extends AcademicDomainError {
  constructor(nis: string) {
    super(`NIS '${nis}' sudah terdaftar pada lembaga ini.`, "DUPLICATE_NIS", 409);
    this.name = "DuplicateNisError";
  }
}

export class DuplicateEnrollmentError extends AcademicDomainError {
  constructor(studentId: string, academicYearId: string) {
    super(
      `Siswa (${studentId}) sudah memiliki rombel terdaftar pada tahun ajaran (${academicYearId}). Satu siswa hanya boleh memiliki 1 rombel per tahun ajaran.`,
      "DUPLICATE_ENROLLMENT",
      409
    );
    this.name = "DuplicateEnrollmentError";
  }
}

export class AcademicYearMismatchError extends AcademicDomainError {
  constructor(classroomId: string, classroomYearId: string, enrollmentYearId: string) {
    super(
      `Ketidaksesuaian tahun ajaran: Rombel (${classroomId}) terdaftar pada tahun ajaran (${classroomYearId}), tidak dapat digunakan untuk enrollment tahun ajaran (${enrollmentYearId}).`,
      "ACADEMIC_YEAR_MISMATCH",
      400
    );
    this.name = "AcademicYearMismatchError";
  }
}

export class ResourceNotFoundError extends AcademicDomainError {
  constructor(resource: string, id: string) {
    super(`${resource} dengan ID '${id}' tidak ditemukan pada lembaga ini.`, "NOT_FOUND", 404);
    this.name = "ResourceNotFoundError";
  }
}
