import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { createGuardianInvitation } from "../auth/guardian";
import { ResourceNotFoundError } from "../academic/types";
import {
  validateGuardianFilter,
  validateUpdateGuardianInput,
  validateDeactivateGuardianInput,
  validateCreateGuardianInvitationStaffInput,
} from "../validation/guardian";
import type { Guardian, Prisma } from "@prisma/client";

/**
 * Phase 9.2 — Guardian Master Data CRUD untuk staf lembaga.
 *
 * Layanan domain di atas model `Guardian` yang sudah ada (Phase 0.1A):
 * - Baca: daftar wali + relasi anak, filter status & pencarian (guardian:view).
 * - Tulis: pembaruan profil, penonaktifan, dan wizard undangan aktivasi
 *   72 jam 1x pakai (guardian:manage).
 * Semua operasi terikat TenantContext + jejak AuditLog. Token undangan
 * mentah TIDAK PERNAH masuk ke AuditLog — hanya hash/durasi.
 */

/** Wali berstatus INACTIVE tidak boleh menerima undangan aktivasi baru. */
export class GuardianInactiveError extends Error {
  readonly code = "GUARDIAN_INACTIVE";
  readonly status = 400;

  constructor(fullName: string) {
    super(
      `Wali murid "${fullName}" berstatus nonaktif. Aktifkan kembali profilnya sebelum mengirim undangan.`
    );
    this.name = "GuardianInactiveError";
  }
}

async function writeGuardianAuditLog(
  ctx: TenantContext,
  action: "CREATE" | "UPDATE",
  guardian: { id: string; status: string },
  details: Record<string, unknown>,
  tx: any
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId ?? null,
        action,
        entityType: "Guardian",
        entityId: guardian.id,
        detailsJson: JSON.stringify({ status: guardian.status, ...details }),
      },
    });
  } catch (auditErr) {
    console.error("[GuardianAudit] Gagal menulis jejak audit:", auditErr);
  }
}

/**
 * Daftar wali murid lembaga: filter status + pencarian nama/WA/email,
 * lengkap dengan relasi anak (GuardianStudent → Student) dan undangan
 * aktif yang belum ditebus.
 */
export async function listGuardians(
  ctx: TenantContext,
  filter?: unknown,
  tx: any = prisma
): Promise<(Guardian & any)[]> {
  requirePermission(ctx, "guardian:view");

  const validated = filter ? validateGuardianFilter(filter) : {};
  const q = validated.q?.trim();

  const whereClause: Prisma.GuardianWhereInput = {
    institutionId: ctx.institutionId,
    ...(validated.status ? { status: validated.status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phoneWa: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return tx.guardian.findMany({
    where: whereClause,
    orderBy: [{ createdAt: "desc" }],
    include: {
      students: {
        include: {
          student: { select: { id: true, fullName: true, nis: true, status: true } },
        },
      },
      invitations: {
        where: { redeemedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, expiresAt: true, sentVia: true },
      },
    },
  });
}

/**
 * Memperbarui profil wali murid (nama, WhatsApp, email, status).
 * Isolasi tenant ditegakkan lewat compound unique `id_institutionId`.
 */
export async function updateGuardianProfile(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<Guardian> {
  requirePermission(ctx, "guardian:manage");
  const validated = validateUpdateGuardianInput(rawInput);

  const existing = await tx.guardian.findUnique({
    where: {
      id_institutionId: {
        id: validated.guardianId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Wali murid", validated.guardianId);
  }

  const data: Record<string, unknown> = {};
  if (validated.fullName !== undefined) data.fullName = validated.fullName;
  if (validated.phoneWa !== undefined) data.phoneWa = validated.phoneWa;
  if (validated.email !== undefined) data.email = validated.email;
  if (validated.status !== undefined) data.status = validated.status;

  const updated: Guardian = await tx.guardian.update({
    where: {
      id_institutionId: {
        id: validated.guardianId,
        institutionId: ctx.institutionId,
      },
    },
    data,
  });

  await writeGuardianAuditLog(
    ctx,
    "UPDATE",
    updated,
    {
      changes: Object.keys(data),
      previousStatus: existing.status,
    },
    tx
  );

  return updated;
}

/**
 * Menonaktifkan wali murid: status → INACTIVE + pencabutan seluruh
 * undangan yang belum ditebus (token lama mati instan).
 */
export async function deactivateGuardian(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<Guardian & { revokedInvitations: number }> {
  requirePermission(ctx, "guardian:manage");
  const validated = validateDeactivateGuardianInput(rawInput);

  const existing = await tx.guardian.findUnique({
    where: {
      id_institutionId: {
        id: validated.guardianId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Wali murid", validated.guardianId);
  }

  const updated: Guardian = await tx.guardian.update({
    where: {
      id_institutionId: {
        id: validated.guardianId,
        institutionId: ctx.institutionId,
      },
    },
    data: { status: "INACTIVE" },
  });

  const revoked = await tx.guardianInvitation.deleteMany({
    where: {
      guardianId: updated.id,
      institutionId: ctx.institutionId,
      redeemedAt: null,
    },
  });

  await writeGuardianAuditLog(
    ctx,
    "UPDATE",
    updated,
    {
      changes: ["status"],
      previousStatus: existing.status,
      revokedInvitations: revoked?.count ?? 0,
      reason: validated.reason ?? null,
    },
    tx
  );

  return { ...updated, revokedInvitations: revoked?.count ?? 0 };
}

/**
 * Wizard undangan: menerbitkan token aktivasi 1x pakai (72 jam) untuk wali.
 * Mengembalikan token mentah + tautan aktivasi untuk disalin staf;
 * AuditLog hanya mencatat jejak (invitationId, expiresAt, sentVia) — tanpa token.
 */
export async function issueGuardianInvitation(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<{
  guardianId: string;
  invitationId: string;
  expiresAt: Date;
  sentVia: string;
  rawToken: string;
  activationPath: string;
}> {
  requirePermission(ctx, "guardian:manage");
  const validated = validateCreateGuardianInvitationStaffInput(rawInput);

  const guardian = await tx.guardian.findUnique({
    where: {
      id_institutionId: {
        id: validated.guardianId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!guardian) {
    throw new ResourceNotFoundError("Wali murid", validated.guardianId);
  }
  if (guardian.status === "INACTIVE") {
    throw new GuardianInactiveError(guardian.fullName);
  }

  const { invitation, rawToken } = await createGuardianInvitation({
    institutionId: ctx.institutionId,
    guardianId: guardian.id,
    createdById: ctx.userId,
    sentVia: validated.sentVia,
  });

  await writeGuardianAuditLog(
    ctx,
    "CREATE",
    { id: guardian.id, status: guardian.status },
    {
      invitationId: invitation.id,
      expiresAt: invitation.expiresAt.toISOString(),
      sentVia: validated.sentVia,
    },
    tx
  );

  return {
    guardianId: guardian.id,
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt,
    sentVia: validated.sentVia,
    rawToken,
    activationPath: `/wali/aktivasi?token=${rawToken}`,
  };
}
