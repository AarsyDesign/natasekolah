import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ResourceNotFoundError } from "../academic/types";
import {
  validateCreatePermitRequestInput,
  validateDecidePermitInput,
  validateReturnPermitInput,
  validateMarkOverduePermitInput,
  validatePermitFilter,
} from "../validation/permit";
import {
  PermitNotFoundError,
  PermitStudentNotInDormitoryError,
  ActivePermitExistsError,
  PermitInvalidTransitionError,
  NoActiveAcademicYearError,
  PermitNotYetOverdueError,
  isValidPermitTransition,
} from "./types";
import { notifyPermitApproved } from "../notification/events";
import { resolveStudentGuardianRecipient } from "../notification/guardian-resolver";
import type { PermitRequest, Prisma } from "@prisma/client";

/** Format tanggal/waktu Indonesia untuk pesan notifikasi. */
function formatPermitDateTime(date?: Date | null): string | undefined {
  if (!date) return undefined;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function writePermitAuditLog(
  ctx: TenantContext,
  action: "CREATE" | "UPDATE",
  permit: { id: string; status: string; type: string; studentId: string },
  details: Record<string, unknown>,
  tx: any
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId ?? null,
        action,
        entityType: "PermitRequest",
        entityId: permit.id,
        detailsJson: JSON.stringify({
          status: permit.status,
          type: permit.type,
          studentId: permit.studentId,
          ...details,
        }),
      },
    });
  } catch (auditErr) {
    console.error("[PermitAudit] Gagal menulis jejak audit:", auditErr);
  }
}

/**
 * Mengambil permohonan izin berdasarkan ID (terisolasi tenant).
 */
export async function getPermitRequestById(
  ctx: TenantContext,
  id: string,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:view");

  const permit = await tx.permitRequest.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true, gender: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  if (!permit) {
    throw new PermitNotFoundError(id);
  }

  return permit;
}

/**
 * Membuat permohonan izin pulang (tasrih) untuk santri bermukim di asrama.
 *
 * Invariant:
 * 1. Siswa harus memiliki penempatan kamar asrama aktif.
 * 2. Siswa tidak boleh memiliki izin berjalan (PENDING/APPROVED) lain.
 * 3. Tahun ajaran diturunkan dari input atau tahun ajaran aktif institusi.
 * 4. Semua baca-tulis dibatasi tenant + jejak AuditLog.
 */
export async function createPermitRequest(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:manage");
  const validated = validateCreatePermitRequestInput(rawInput);

  // 1. Verifikasi santri milik tenant
  const student = await tx.student.findUnique({
    where: {
      id_institutionId: {
        id: validated.studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Santri", validated.studentId);
  }

  // 2. Invariant: hanya santri dengan penempatan asrama aktif
  const activeAssignment = await tx.studentDormitoryAssignment.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      status: "ACTIVE",
    },
  });

  if (!activeAssignment) {
    throw new PermitStudentNotInDormitoryError(student.fullName);
  }

  // 3. Invariant: tolak izin ganda (berjalan)
  const activePermit = await tx.permitRequest.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });

  if (activePermit) {
    throw new ActivePermitExistsError(student.fullName);
  }

  // 4. Tahun ajaran: dari input, atau tahun ajaran aktif
  let academicYearId = validated.academicYearId;
  if (academicYearId) {
    const academicYear = await tx.academicYear.findUnique({
      where: {
        id_institutionId: {
          id: academicYearId,
          institutionId: ctx.institutionId,
        },
      },
    });
    if (!academicYear) {
      throw new ResourceNotFoundError("Tahun Ajaran", academicYearId);
    }
  } else {
    const activeYear = await tx.academicYear.findFirst({
      where: { institutionId: ctx.institutionId, isActive: true },
    });
    if (!activeYear) {
      throw new NoActiveAcademicYearError();
    }
    academicYearId = activeYear.id;
  }

  // 5. Eksekusi pembuatan
  const permit = await tx.permitRequest.create({
    data: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      academicYearId,
      type: validated.type,
      leaveAt: validated.leaveAt,
      returnAt: validated.returnAt ?? null,
      reason: validated.reason ?? null,
      status: "PENDING",
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true, gender: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await writePermitAuditLog(ctx, "CREATE", permit, { leaveAt: permit.leaveAt }, tx);

  return permit;
}

/**
 * Menyetujui permohonan izin (PENDING -> APPROVED).
 * Mengantre notifikasi persetujuan ke wali via Outbox (best-effort).
 */
export async function approvePermitRequest(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:manage");
  const validated = validateDecidePermitInput(rawInput);

  const permit = await tx.permitRequest.findUnique({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  if (!permit) {
    throw new PermitNotFoundError(validated.permitId);
  }

  if (!isValidPermitTransition(permit.status, "APPROVED")) {
    throw new PermitInvalidTransitionError(permit.status, "APPROVED");
  }

  const notes = validated.notes
    ? permit.notes
      ? `${permit.notes} | ${validated.notes}`
      : validated.notes
    : permit.notes;

  const updated = await tx.permitRequest.update({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "APPROVED",
      approvedById: ctx.userId ?? null,
      approvedAt: new Date(),
      decidedAt: new Date(),
      notes,
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await writePermitAuditLog(ctx, "UPDATE", updated, { decision: "APPROVED" }, tx);

  // Post-decision event: antrekan notifikasi persetujuan ke wali (best-effort)
  try {
    const recipient = await resolveStudentGuardianRecipient(
      updated.student.id,
      ctx.institutionId,
      tx
    );

    if (recipient) {
      await notifyPermitApproved(
        {
          recipientPhone: recipient.recipientPhone,
          studentName: updated.student.fullName,
          permitType: updated.type,
          leaveAt: formatPermitDateTime(updated.leaveAt) || "-",
          returnAt: formatPermitDateTime(updated.returnAt),
          approvedByName: updated.approvedBy?.name ?? null,
          permitId: updated.id,
        },
        tx
      );
    }
  } catch (notifErr) {
    console.error("[PermitNotification] Gagal mengantre notifikasi persetujuan:", notifErr);
  }

  return updated;
}

/**
 * Menolak permohonan izin (PENDING -> REJECTED).
 */
export async function rejectPermitRequest(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:manage");
  const validated = validateDecidePermitInput(rawInput);

  const permit = await tx.permitRequest.findUnique({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!permit) {
    throw new PermitNotFoundError(validated.permitId);
  }

  if (!isValidPermitTransition(permit.status, "REJECTED")) {
    throw new PermitInvalidTransitionError(permit.status, "REJECTED");
  }

  const notes = validated.notes
    ? permit.notes
      ? `${permit.notes} | ${validated.notes}`
      : validated.notes
    : permit.notes;

  const updated = await tx.permitRequest.update({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      notes,
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await writePermitAuditLog(ctx, "UPDATE", updated, { decision: "REJECTED" }, tx);

  return updated;
}

/**
 * Menandai santri telah kembali ke asrama (APPROVED -> RETURNED).
 */
export async function markPermitReturned(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:manage");
  const validated = validateReturnPermitInput(rawInput);

  const permit = await tx.permitRequest.findUnique({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!permit) {
    throw new PermitNotFoundError(validated.permitId);
  }

  if (!isValidPermitTransition(permit.status, "RETURNED")) {
    throw new PermitInvalidTransitionError(permit.status, "RETURNED");
  }

  const notes = validated.notes
    ? permit.notes
      ? `${permit.notes} | ${validated.notes}`
      : validated.notes
    : permit.notes;

  const updated = await tx.permitRequest.update({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      notes,
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await writePermitAuditLog(ctx, "UPDATE", updated, { decision: "RETURNED" }, tx);

  return updated;
}

/**
 * Menandai izin terlambat kembali (APPROVED -> OVERDUE).
 * Hanya sah bila izin sudah disetujui dan melewati waktu kembali yang dijanjikan.
 */
export async function markPermitOverdue(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<PermitRequest & any> {
  requirePermission(ctx, "pesantren:manage");
  const validated = validateMarkOverduePermitInput(rawInput);

  const permit = await tx.permitRequest.findUnique({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!permit) {
    throw new PermitNotFoundError(validated.permitId);
  }

  if (!isValidPermitTransition(permit.status, "OVERDUE")) {
    throw new PermitInvalidTransitionError(permit.status, "OVERDUE");
  }

  if (!permit.returnAt || permit.returnAt.getTime() >= Date.now()) {
    throw new PermitNotYetOverdueError();
  }

  const updated = await tx.permitRequest.update({
    where: {
      id_institutionId: {
        id: validated.permitId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "OVERDUE",
      notes: permit.notes
        ? `${permit.notes} | Ditandai terlambat kembali`
        : "Ditandai terlambat kembali",
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  await writePermitAuditLog(ctx, "UPDATE", updated, { decision: "OVERDUE" }, tx);

  return updated;
}

/**
 * Menampilkan daftar permohonan izin dengan filter opsional (status/jenis/santri).
 */
export async function listPermitRequests(
  ctx: TenantContext,
  filter?: unknown,
  tx: any = prisma
): Promise<(PermitRequest & any)[]> {
  requirePermission(ctx, "pesantren:view");

  const validated = filter ? validatePermitFilter(filter) : {};

  const whereClause: Prisma.PermitRequestWhereInput = {
    institutionId: ctx.institutionId,
    ...(validated.status ? { status: validated.status } : {}),
    ...(validated.type ? { type: validated.type } : {}),
    ...(validated.studentId ? { studentId: validated.studentId } : {}),
  };

  return tx.permitRequest.findMany({
    where: whereClause,
    orderBy: [{ status: "asc" }, { leaveAt: "desc" }],
    include: {
      student: { select: { id: true, fullName: true, nis: true, gender: true } },
      academicYear: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
}
