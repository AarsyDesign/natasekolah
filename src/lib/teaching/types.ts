/**
 * Domain types, constants, and error definitions for Teaching Core & Teacher Assignment (Phase 2).
 */

export const SUBJECT_CATEGORIES = [
  "UMUM",
  "AGAMA",
  "MULOK",
  "PEMINATAN",
  // Pesantren / Diniyah Categories (Phase 6)
  "DINIAH",
  "KITAB",
  "TAHSIN",
  "TAJWID",
  "AKHLAQ",
  "FIQIH",
  "AQIDAH",
  "HADITS",
  "LAINNYA",
] as const;

export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export function isValidSubjectCategory(category: string): category is SubjectCategory {
  return (SUBJECT_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Basis galat domain pengajaran akademik
 */
export class TeachingDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "TEACHING_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "TeachingDomainError";
    this.code = code;
    this.status = status;
  }
}

export class DuplicateSubjectCodeError extends TeachingDomainError {
  constructor(code: string) {
    super(`Kode mata pelajaran '${code}' sudah terdaftar pada lembaga ini.`, "DUPLICATE_SUBJECT_CODE", 409);
    this.name = "DuplicateSubjectCodeError";
  }
}

export class DuplicateAssignmentError extends TeachingDomainError {
  constructor(teacherName: string, subjectName: string, classroomName: string, yearName: string) {
    super(
      `Penugasan mengajar duplikat: ${teacherName} sudah ditugaskan mengajar ${subjectName} di kelas ${classroomName} untuk tahun ajaran ${yearName}.`,
      "DUPLICATE_TEACHER_ASSIGNMENT",
      409
    );
    this.name = "DuplicateAssignmentError";
  }
}

export class TeacherAssignmentAccessDeniedError extends TeachingDomainError {
  constructor(message = "Anda hanya diizinkan melihat atau mengelola penugasan mengajar Anda sendiri.") {
    super(message, "TEACHER_ASSIGNMENT_ACCESS_DENIED", 403);
    this.name = "TeacherAssignmentAccessDeniedError";
  }
}

export class InvalidTeacherRoleError extends TeachingDomainError {
  constructor(userId: string) {
    super(`Pengguna (${userId}) tidak memiliki peran 'TEACHER' dalam institusi ini.`, "INVALID_TEACHER_ROLE", 400);
    this.name = "InvalidTeacherRoleError";
  }
}

export { ResourceNotFoundError } from "../academic/types";
