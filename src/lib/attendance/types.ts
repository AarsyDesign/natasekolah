/**
 * Domain types, status constants, error definitions, and helpers for Attendance Core (Phase 3).
 */

export const ATTENDANCE_SESSION_STATUSES = ["OPEN", "CLOSED"] as const;
export type AttendanceSessionStatus = (typeof ATTENDANCE_SESSION_STATUSES)[number];

export function isValidAttendanceSessionStatus(status: string): status is AttendanceSessionStatus {
  return (ATTENDANCE_SESSION_STATUSES as readonly string[]).includes(status);
}

export const ATTENDANCE_STATUSES = ["PRESENT", "EXCUSED", "SICK", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isValidAttendanceStatus(status: string): status is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(status);
}

export const ATTENDANCE_CONTEXTS = ["ACADEMIC", "LIVING"] as const;
export type AttendanceContext = (typeof ATTENDANCE_CONTEXTS)[number];


/**
 * Pemetaan status absensi internal ke label UI Bahasa Indonesia resmi.
 */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "HADIR",
  EXCUSED: "IZIN",
  SICK: "SAKIT",
  ABSENT: "ALPA",
};

export const ATTENDANCE_LABEL_TO_STATUS: Record<string, AttendanceStatus> = {
  HADIR: "PRESENT",
  IZIN: "EXCUSED",
  SAKIT: "SICK",
  ALPA: "ABSENT",
};

/**
 * Menormalkan tanggal absensi ke UTC midnight (00:00:00.000Z) untuk mencegah bug pergeseran zona waktu.
 */
export function normalizeAttendanceDate(input: string | Date): Date {
  if (typeof input === "string") {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
    }
    const parsed = new Date(input);
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Format tanggal absensi ke string standar YYYY-MM-DD.
 */
export function formatAttendanceDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// -------------------------------------------------------------
// DOMAIN ERRORS
// -------------------------------------------------------------

export class AttendanceDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "ATTENDANCE_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "AttendanceDomainError";
    this.code = code;
    this.status = status;
  }
}

export class AttendanceSessionAlreadyExistsError extends AttendanceDomainError {
  constructor(assignmentId: string, dateStr: string) {
    super(
      `Sesi absensi untuk penugasan (${assignmentId}) pada tanggal ${dateStr} sudah ada. Satu penugasan hanya boleh memiliki 1 sesi per hari.`,
      "DUPLICATE_ATTENDANCE_SESSION",
      409
    );
    this.name = "AttendanceSessionAlreadyExistsError";
  }
}

export class LivingAttendanceSessionAlreadyExistsError extends AttendanceDomainError {
  constructor(roomId: string, dateStr: string) {
    super(
      `Sesi absensi asrama untuk kamar (${roomId}) pada tanggal ${dateStr} sudah ada. Satu kamar hanya boleh memiliki 1 sesi absensi per hari.`,
      "DUPLICATE_LIVING_ATTENDANCE_SESSION",
      409
    );
    this.name = "LivingAttendanceSessionAlreadyExistsError";
  }
}

export class AttendanceSessionClosedError extends AttendanceDomainError {
  constructor(sessionId: string) {
    super(
      `Sesi absensi (${sessionId}) telah ditutup (CLOSED) dan bersifat kekal (immutable). Catatan absensi tidak dapat diubah atau dihapus.`,
      "ATTENDANCE_SESSION_CLOSED",
      400
    );
    this.name = "AttendanceSessionClosedError";
  }
}

export class AttendanceRecordAlreadyExistsError extends AttendanceDomainError {
  constructor(sessionId: string, studentId: string) {
    super(
      `Catatan absensi untuk siswa (${studentId}) pada sesi (${sessionId}) sudah ada. Satu siswa hanya boleh memiliki 1 rekaman per sesi.`,
      "DUPLICATE_ATTENDANCE_RECORD",
      409
    );
    this.name = "AttendanceRecordAlreadyExistsError";
  }
}

export class AttendanceIncompleteError extends AttendanceDomainError {
  readonly missingCount: number;

  constructor(missingCount: number, message?: string) {
    super(
      message ||
        `Sesi absensi tidak dapat ditutup karena masih terdapat ${missingCount} siswa dalam rombel yang belum dicatat kehadirannya.`,
      "ATTENDANCE_INCOMPLETE",
      400
    );
    this.name = "AttendanceIncompleteError";
    this.missingCount = missingCount;
  }
}

export class AttendanceAccessDeniedError extends AttendanceDomainError {
  constructor(
    message = "Akses ditolak: Guru hanya diizinkan melihat, membuka, mengisi, dan menutup sesi absensi untuk penugasan mengajar miliknya sendiri."
  ) {
    super(message, "ATTENDANCE_ACCESS_DENIED", 403);
    this.name = "AttendanceAccessDeniedError";
  }
}

export class InvalidAttendanceContextError extends AttendanceDomainError {
  constructor(message: string) {
    super(message, "INVALID_ATTENDANCE_CONTEXT", 400);
    this.name = "InvalidAttendanceContextError";
  }
}

export { ResourceNotFoundError } from "../academic/types";
