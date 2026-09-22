import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma";
import type { Guardian, GuardianStudent, GuardianInvitation, Institution, Session } from "@prisma/client";
import {
  GuardianRelationship,
  GuardianStatus,
  isValidGuardianRelationship,
  isValidGuardianStatus,
} from "./domain";
import { createSession } from "./session";

export const INVITATION_LIFETIME_MS = 72 * 60 * 60 * 1000; // 72 Jam

export class GuardianInvitationError extends Error {
  readonly code:
    | "INVALID_INVITATION_TOKEN"
    | "INVITATION_EXPIRED"
    | "INVITATION_ALREADY_REDEEMED"
    | "GUARDIAN_NOT_FOUND"
    | "GUARDIAN_TENANT_MISMATCH";
  readonly status: number;

  constructor(
    code:
      | "INVALID_INVITATION_TOKEN"
      | "INVITATION_EXPIRED"
      | "INVITATION_ALREADY_REDEEMED"
      | "GUARDIAN_NOT_FOUND"
      | "GUARDIAN_TENANT_MISMATCH",
    message: string,
    status = 400
  ) {
    super(message);
    this.name = "GuardianInvitationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Mendaftarkan profil wali murid baru di bawah lembaga tertentu.
 * Nomor telepon tidak bersifat unik secara global/institusi (mendukung ayah/ibu dengan nomor sama).
 */
export async function createGuardian(params: {
  institutionId: string;
  fullName: string;
  phoneWa: string;
  email?: string;
  status?: GuardianStatus;
}): Promise<Guardian> {
  const { institutionId, fullName, phoneWa, email, status = "INVITED" } = params;

  if (!fullName || !fullName.trim()) {
    throw new Error("Nama lengkap wali wajib diisi.");
  }
  if (!phoneWa || !phoneWa.trim()) {
    throw new Error("Nomor WhatsApp wali wajib diisi.");
  }
  if (!isValidGuardianStatus(status)) {
    throw new Error(`Status wali tidak valid: ${status}`);
  }

  return prisma.guardian.create({
    data: {
      institutionId,
      fullName: fullName.trim(),
      phoneWa: phoneWa.trim(),
      email: email?.trim().toLowerCase() || null,
      status,
    },
  });
}

/**
 * Menghubungkan wali murid dengan siswa binaannya.
 * Menjamin integritas relasi: Guardian dan Student WAJIB berada pada institutionId yang sama.
 */
export async function linkGuardianStudent(params: {
  institutionId: string;
  guardianId: string;
  studentId: string;
  relationship: GuardianRelationship;
  isPrimary?: boolean;
}): Promise<GuardianStudent> {
  const { institutionId, guardianId, studentId, relationship, isPrimary = false } = params;

  if (!isValidGuardianRelationship(relationship)) {
    throw new Error(`Hubungan wali tidak valid: ${relationship}`);
  }

  // Verifikasi keberadaan dan keselarasan tenant
  const [guardian, student] = await Promise.all([
    prisma.guardian.findUnique({
      where: { id: guardianId },
      select: { institutionId: true },
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { institutionId: true },
    }),
  ]);

  if (!guardian) {
    throw new Error("Wali murid tidak ditemukan.");
  }
  if (!student) {
    throw new Error("Peserta didik tidak ditemukan.");
  }

  if (guardian.institutionId !== institutionId || student.institutionId !== institutionId) {
    throw new Error(
      `Pelanggaran isolasi tenant: Guardian (${guardian.institutionId}) dan Student (${student.institutionId}) wajib berada di lembaga (${institutionId}) yang sama.`
    );
  }

  return prisma.guardianStudent.create({
    data: {
      institutionId,
      guardianId,
      studentId,
      relationship,
      isPrimary,
    },
  });
}

/**
 * Menghasilkan tautan undangan / token aktivasi 1x pakai untuk wali murid.
 * Token berupa 256-bit acak, hanya hash SHA-256 yang disimpan di database.
 */
export async function createGuardianInvitation(params: {
  institutionId: string;
  guardianId: string;
  createdById?: string;
  sentVia?: string;
}): Promise<{ invitation: GuardianInvitation; rawToken: string }> {
  const { institutionId, guardianId, createdById, sentVia = "WHATSAPP" } = params;

  // Pastikan wali ada di institusi yang tepat
  const guardian = await prisma.guardian.findUnique({
    where: { id: guardianId },
    select: { institutionId: true },
  });

  if (!guardian || guardian.institutionId !== institutionId) {
    throw new GuardianInvitationError(
      "GUARDIAN_NOT_FOUND",
      "Wali murid tidak ditemukan pada lembaga ini.",
      404
    );
  }

  // Generate 256-bit random token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  // Batalkan token undangan lama yang belum ditebus untuk wali ini jika ada
  await prisma.guardianInvitation.deleteMany({
    where: {
      guardianId,
      redeemedAt: null,
    },
  });

  const invitation = await prisma.guardianInvitation.create({
    data: {
      tokenHash,
      guardianId,
      institutionId,
      expiresAt,
      sentVia,
      createdById: createdById || null,
    },
  });

  return { invitation, rawToken };
}

/**
 * Aktivasi profil wali murid via token undangan:
 * 1. Token di-hash via SHA-256 dan dicari di database.
 * 2. Memastikan token belum kedaluwarsa dan belum pernah ditebus.
 * 3. Menandai redeemedAt (token instan mati, mencegah replay attack).
 * 4. Mengubah status Guardian menjadi ACTIVE.
 * 5. Menerbitkan Session resmi (subjectType = GUARDIAN).
 * 6. Keamanan: Tidak dapat mengangkat role staf/admin atau mengubah nomor telepon/email.
 */
export async function activateGuardian(params: {
  rawToken: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  guardian: Guardian;
  institution: Institution;
  session: Session;
  rawToken: string;
}> {
  const { rawToken, ipAddress, userAgent } = params;

  if (!rawToken || typeof rawToken !== "string") {
    throw new GuardianInvitationError(
      "INVALID_INVITATION_TOKEN",
      "Token undangan aktivasi tidak valid.",
      400
    );
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const invitation = await prisma.guardianInvitation.findUnique({
    where: { tokenHash },
    include: {
      guardian: true,
      institution: true,
    },
  });

  if (!invitation) {
    throw new GuardianInvitationError(
      "INVALID_INVITATION_TOKEN",
      "Tautan undangan tidak ditemukan atau tidak valid.",
      404
    );
  }

  // Cek apakah sudah pernah ditebus
  if (invitation.redeemedAt !== null) {
    throw new GuardianInvitationError(
      "INVITATION_ALREADY_REDEEMED",
      "Tautan undangan aktivasi ini telah digunakan sebelumnya. Silakan masuk menggunakan portal wali.",
      400
    );
  }

  // Cek kedaluwarsa
  if (invitation.expiresAt.getTime() <= Date.now()) {
    throw new GuardianInvitationError(
      "INVITATION_EXPIRED",
      "Tautan undangan aktivasi telah kedaluwarsa. Silakan hubungi pihak sekolah untuk mendapatkan tautan baru.",
      400
    );
  }

  // Cek integritas lembaga
  if (invitation.guardian.institutionId !== invitation.institutionId) {
    throw new GuardianInvitationError(
      "GUARDIAN_TENANT_MISMATCH",
      "Pelanggaran integritas lembaga pada data undangan.",
      403
    );
  }

  // Eksekusi aktivasi dan pembatalan token (one-time redemption)
  const [updatedInvitation, updatedGuardian] = await prisma.$transaction([
    prisma.guardianInvitation.update({
      where: { id: invitation.id },
      data: { redeemedAt: new Date() },
    }),
    prisma.guardian.update({
      where: { id: invitation.guardianId },
      data: { status: "ACTIVE" },
    }),
  ]);

  // Terbitkan sesi resmi khusus wali (subjectType = GUARDIAN)
  const { session, rawToken: sessionRawToken } = await createSession({
    subjectType: "GUARDIAN",
    guardianId: updatedGuardian.id,
    institutionId: invitation.institutionId,
    ipAddress,
    userAgent,
  });

  return {
    guardian: updatedGuardian,
    institution: invitation.institution,
    session,
    rawToken: sessionRawToken,
  };
}
