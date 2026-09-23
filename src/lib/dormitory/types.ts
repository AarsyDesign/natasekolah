/**
 * Domain types, constants, and error definitions for Dormitory & Asrama Core (Phase 6).
 */

export const DORMITORY_ASSIGNMENT_STATUSES = [
  "ACTIVE",
  "ENDED",
  "MOVED",
] as const;
export type DormitoryAssignmentStatus =
  (typeof DORMITORY_ASSIGNMENT_STATUSES)[number];

export function isValidDormitoryAssignmentStatus(
  status: string
): status is DormitoryAssignmentStatus {
  return (DORMITORY_ASSIGNMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Basis galat domain asrama santri
 */
export class DormitoryDomainError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = "DORMITORY_DOMAIN_ERROR", status = 400) {
    super(message);
    this.name = "DormitoryDomainError";
    this.code = code;
    this.status = status;
  }
}

export class DormitoryNotFoundError extends DormitoryDomainError {
  constructor(id: string) {
    super(`Gedung asrama dengan ID '${id}' tidak ditemukan.`, "DORMITORY_NOT_FOUND", 404);
    this.name = "DormitoryNotFoundError";
  }
}

export class DormitoryRoomNotFoundError extends DormitoryDomainError {
  constructor(id: string) {
    super(`Kamar asrama dengan ID '${id}' tidak ditemukan.`, "DORMITORY_ROOM_NOT_FOUND", 404);
    this.name = "DormitoryRoomNotFoundError";
  }
}

export class DormitoryRoomCapacityExceededError extends DormitoryDomainError {
  constructor(roomName: string, capacity: number) {
    super(
      `Kapasitas kamar '${roomName}' telah penuh (maksimum ${capacity} santri).`,
      "DORMITORY_ROOM_CAPACITY_EXCEEDED",
      400
    );
    this.name = "DormitoryRoomCapacityExceededError";
  }
}

export class ActiveDormitoryAssignmentExistsError extends DormitoryDomainError {
  constructor(studentName: string) {
    super(
      `Santri '${studentName}' sudah memiliki penempatan kamar asrama yang masih aktif. Akhiri penempatan sebelumnya sebelum menempatkan di kamar baru.`,
      "ACTIVE_DORMITORY_ASSIGNMENT_EXISTS",
      409
    );
    this.name = "ActiveDormitoryAssignmentExistsError";
  }
}

export class DormitoryAssignmentNotFoundError extends DormitoryDomainError {
  constructor(id: string) {
    super(`Penempatan kamar asrama dengan ID '${id}' tidak ditemukan.`, "DORMITORY_ASSIGNMENT_NOT_FOUND", 404);
    this.name = "DormitoryAssignmentNotFoundError";
  }
}

export class DormitoryDuplicateNameError extends DormitoryDomainError {
  constructor(name: string) {
    super(`Nama gedung asrama '${name}' sudah terdaftar pada lembaga ini.`, "DUPLICATE_DORMITORY_NAME", 409);
    this.name = "DormitoryDuplicateNameError";
  }
}

export class DormitoryRoomDuplicateNameError extends DormitoryDomainError {
  constructor(roomName: string, dormitoryName: string) {
    super(
      `Kamar '${roomName}' sudah terdaftar pada gedung ${dormitoryName}.`,
      "DUPLICATE_DORMITORY_ROOM_NAME",
      409
    );
    this.name = "DormitoryRoomDuplicateNameError";
  }
}

export class DormitoryAccessDeniedError extends DormitoryDomainError {
  constructor(message = "Akses modul asrama ditolak.") {
    super(message, "DORMITORY_ACCESS_DENIED", 403);
    this.name = "DormitoryAccessDeniedError";
  }
}
