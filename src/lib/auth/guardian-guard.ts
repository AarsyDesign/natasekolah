import { prisma } from "../prisma";
import type { GuardianStudent } from "@prisma/client";

export class GuardianAccessDeniedError extends Error {
  readonly code = "GUARDIAN_ACCESS_DENIED";
  readonly status = 403;
  readonly studentId: string;
  readonly guardianId: string;

  constructor(studentId: string, guardianId: string, message?: string) {
    super(
      message ||
        `Akses ditolak: Wali [${guardianId}] tidak memiliki hubungan wali yang sah terhadap peserta didik [${studentId}].`
    );
    this.name = "GuardianAccessDeniedError";
    this.studentId = studentId;
    this.guardianId = guardianId;
  }
}

export interface GuardianContext {
  guardianId: string;
  institutionId: string;
  fullName: string;
  phoneWa: string;
}

/**
 * Penjaga otorisasi relasional (ReBAC):
 * Memastikan bahwa wali murid yang terotentikasi dalam sesi
 * benar-benar memiliki hak relasi resmi terhadap peserta didik yang diminta.
 *
 * SUMBER KEBENARAN:
 * - sessionGuardianId & sessionInstitutionId HARUS diekstrak dari Sesi Server terverifikasi.
 * - Tidak pernah mempercayai guardianId kiriman klien.
 */
export async function assertGuardianStudentAccess(params: {
  sessionGuardianId: string;
  sessionInstitutionId: string;
  requestedStudentId: string;
  clientSuppliedGuardianId?: string;
}): Promise<GuardianStudent> {
  const { sessionGuardianId, sessionInstitutionId, requestedStudentId, clientSuppliedGuardianId } =
    params;

  if (!sessionGuardianId || !sessionInstitutionId || !requestedStudentId) {
    throw new GuardianAccessDeniedError(
      requestedStudentId || "UNKNOWN",
      sessionGuardianId || "UNKNOWN",
      "Parameter otorisasi wali atau siswa tidak lengkap."
    );
  }

  // Jika klien mengirim guardianId terpisah, pastikan tidak ada upaya manipulasi ID
  if (clientSuppliedGuardianId && clientSuppliedGuardianId !== sessionGuardianId) {
    throw new GuardianAccessDeniedError(
      requestedStudentId,
      sessionGuardianId,
      "Manipulasi identitas terdeteksi: guardianId kiriman klien tidak cocok dengan sesi aktif."
    );
  }

  // Cari relasi sah di database
  const relation = await prisma.guardianStudent.findUnique({
    where: {
      guardianId_studentId: {
        guardianId: sessionGuardianId,
        studentId: requestedStudentId,
      },
    },
  });

  if (!relation) {
    throw new GuardianAccessDeniedError(
      requestedStudentId,
      sessionGuardianId,
      "Akses ditolak: Anda tidak memiliki hubungan wali terhadap peserta didik ini."
    );
  }

  // Verifikasi isolasi tenant
  if (relation.institutionId !== sessionInstitutionId) {
    throw new GuardianAccessDeniedError(
      requestedStudentId,
      sessionGuardianId,
      "Akses ditolak: Peserta didik ini terdaftar pada institusi yang berbeda dari sesi aktif Anda."
    );
  }

  return relation;
}

/**
 * Helper otorisasi langsung dari sesi tervalidasi (Zero-Trust terhadap input klien).
 * Mengambil guardianId dan institutionId secara eksklusif dari ValidatedSessionPayload.
 */
export async function requireGuardianStudentAccess(
  sessionPayload: {
    subjectType: string;
    guardian?: { id: string };
    institution: { id: string };
  },
  requestedStudentId: string
): Promise<GuardianStudent> {
  if (sessionPayload.subjectType !== "GUARDIAN" || !sessionPayload.guardian) {
    throw new GuardianAccessDeniedError(
      requestedStudentId,
      "UNKNOWN",
      "Akses ditolak: Operasi ini memerlukan sesi aktif portal wali murid."
    );
  }

  return assertGuardianStudentAccess({
    sessionGuardianId: sessionPayload.guardian.id,
    sessionInstitutionId: sessionPayload.institution.id,
    requestedStudentId,
  });
}
