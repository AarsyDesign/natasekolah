/**
 * Domain types, constants, and error definitions for Tasrih / Permit Engine
 * (Izin Pulang Santri) — Phase 9.
 */

export const PERMIT_TYPES = [
  "HOME_LEAVE", // Izin pulang biasa (tasrih)
  "SICK_LEAVE", // Izin sakit (pulang berobat)
  "EXCUSED", // Izin lain (keperluan keluarga, dll.)
] as const;
export type PermitType = (typeof PERMIT_TYPES)[number];

export function isValidPermitType(status: string): status is PermitType {
  return (PERMIT_TYPES as readonly string[]).includes(status);
}

export const PERMIT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "OVERDUE",
] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export function isValidPermitStatus(status: string): status is PermitStatus {
  return (PERMIT_STATUSES as readonly string[]).includes(status);
}

/**
 * Matriks transisi status lifecycle izin pulang.
 * PENDING -> APPROVED | REJECTED ; APPROVED -> RETURNED | OVERDUE.
 * REJECTED, RETURNED, dan OVERDUE adalah status terminal (imut).
 */
export const PERMIT_TRANSITIONS: Record<PermitStatus, readonly PermitStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["RETURNED", "OVERDUE"],
  REJECTED: [],
  RETURNED: [],
  OVERDUE: [],
};

export function isValidPermitTransition(from: PermitStatus, to: PermitStatus): boolean {
  return PERMIT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Basis galat domain izin pulang (tasrih).
 */
export class PermitDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "PERMIT_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "PermitDomainError";
    this.code = code;
    this.status = status;
  }
}

export class PermitNotFoundError extends PermitDomainError {
  constructor(id: string) {
    super(
      `Permohonan izin dengan ID '${id}' tidak ditemukan.`,
      "PERMIT_NOT_FOUND",
      404
    );
    this.name = "PermitNotFoundError";
  }
}

/**
 * Siswa tanpa penempatan kamar asrama aktif tidak boleh diajukan izin pulang
 * dari halaman asrama (hanya santri bermukim yang bisa tasrih).
 */
export class PermitStudentNotInDormitoryError extends PermitDomainError {
  constructor(studentName: string) {
    super(
      `Santri '${studentName}' tidak memiliki penempatan kamar asrama aktif. Hanya santri yang menetap di asrama yang dapat diajukan izin pulang.`,
      "PERMIT_STUDENT_NOT_IN_DORMITORY",
      400
    );
    this.name = "PermitStudentNotInDormitoryError";
  }
}

/**
 * Siswa masih memiliki izin berjalan (PENDING/APPROVED) — mencegah izin ganda.
 */
export class ActivePermitExistsError extends PermitDomainError {
  constructor(studentName: string) {
    super(
      `Santri '${studentName}' masih memiliki permohonan izin yang berjalan (menunggu persetujuan atau belum kembali). Selesaikan izin tersebut terlebih dahulu.`,
      "ACTIVE_PERMIT_EXISTS",
      409
    );
    this.name = "ActivePermitExistsError";
  }
}

/**
 * Transisi status lifecycle yang dilarang (termasuk upaya mengubah status terminal).
 */
export class PermitInvalidTransitionError extends PermitDomainError {
  constructor(from: string, to: string) {
    super(
      `Transisi status izin '${from}' -> '${to}' tidak diizinkan. Status terminal tidak dapat diubah.`,
      "PERMIT_INVALID_TRANSITION",
      409
    );
    this.name = "PermitInvalidTransitionError";
  }
}

/**
 * Tidak ada tahun ajaran aktif pada institusi — pengajuan izin ditolak.
 */
export class NoActiveAcademicYearError extends PermitDomainError {
  constructor() {
    super(
      "Tidak ada tahun ajaran aktif pada lembaga ini. Aktifkan tahun ajaran terlebih dahulu sebelum mengajukan izin.",
      "NO_ACTIVE_ACADEMIC_YEAR",
      400
    );
    this.name = "NoActiveAcademicYearError";
  }
}

/**
 * Menandai OVERDUE hanya sah untuk izin APPROVED yang sudah melewati
 * waktu kembali yang dijanjikan.
 */
export class PermitNotYetOverdueError extends PermitDomainError {
  constructor() {
    super(
      "Izin hanya dapat ditandai TERLAMBAT (OVERDUE) jika sudah disetujui dan melewati waktu kembali yang dijanjikan.",
      "PERMIT_NOT_YET_OVERDUE",
      400
    );
    this.name = "PermitNotYetOverdueError";
  }
}
