import { Prisma, type StudentCharge } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { prisma } from "../prisma";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { validateCreateStudentChargeInput, validateChargeQuery, validateVoidStudentChargeInput } from "../validation/finance";
import { calculateChargeStatus, ChargeHasPaymentsError, FinanceConflictError, FinanceNotFoundError } from "./types";

async function getChargeWithPayments(ctx: TenantContext, id: string) {
  return prisma.studentCharge.findUnique({
    where: { id_institutionId: { id: input.studentChargeId, institutionId: ctx.institutionId } },
    include: { student: true, feeCategory: true, academicYear: true, payments: { orderBy: { paidAt: "asc" } } },
  });
}

export function getNetChargeAmount(charge: Pick<StudentCharge, "amount" | "discountAmount">): number {
  return Math.max(charge.amount - charge.discountAmount, 0);
}

export async function refreshChargeStatus(tx: Prisma.TransactionClient, institutionId: string, chargeId: string) {
  const charge = await tx.studentCharge.findUnique({
    where: { id_institutionId: { id: chargeId, institutionId } },
    include: { payments: { where: { status: "POSTED" }, select: { amount: true } } },
  });
  if (!charge) throw new FinanceNotFoundError("Tagihan", chargeId);
  const totalPaid = charge.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const status = charge.status === "VOID" ? "VOID" : calculateChargeStatus(getNetChargeAmount(charge), totalPaid);
  return tx.studentCharge.update({ where: { id_institutionId: { id: chargeId, institutionId } }, data: { status } });
}

export async function createStudentCharge(ctx: TenantContext, rawInput: unknown): Promise<StudentCharge> {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateCreateStudentChargeInput(rawInput), ctx);
  const [student, category, academicYear] = await Promise.all([
    prisma.student.findUnique({ where: { id_institutionId: { id: input.studentId, institutionId: ctx.institutionId } }, select: { id: true, fullName: true } }),
    prisma.feeCategory.findUnique({ where: { id_institutionId: { id: input.feeCategoryId, institutionId: ctx.institutionId } } }),
    prisma.academicYear.findUnique({ where: { id_institutionId: { id: input.academicYearId, institutionId: ctx.institutionId } } }),
  ]);
  if (!student) throw new FinanceNotFoundError("Siswa", input.studentId);
  if (!category) throw new FinanceNotFoundError("Kategori tagihan", input.feeCategoryId);
  if (!category.isActive) throw new FinanceConflictError("Kategori tagihan sedang nonaktif.");
  if (!academicYear) throw new FinanceNotFoundError("Tahun ajaran", input.academicYearId);

  return prisma.$transaction(async (tx) => {
  const duplicate = await tx.studentCharge.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: input.studentId,
      feeCategoryId: input.feeCategoryId,
      academicYearId: input.academicYearId,
      periodMonth: input.periodMonth ?? null,
      periodYear: input.periodYear ?? null,
      status: { not: "VOID" },
    },
  });
  if (duplicate) throw new FinanceConflictError("Tagihan aktif dengan kombinasi siswa, kategori, tahun ajaran, dan periode yang sama sudah ada.");

  const charge = await tx.studentCharge.create({
    data: {
      institutionId: ctx.institutionId,
      studentId: input.studentId,
      feeCategoryId: input.feeCategoryId,
      academicYearId: input.academicYearId,
      periodMonth: input.periodMonth ?? null,
      periodYear: input.periodYear ?? null,
      amount: input.amount,
      discountAmount: input.discountAmount,
      dueDate: input.dueDate ?? null,
      notes: input.notes || null,
    },
  });
  await tx.auditLog.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "StudentCharge",
      entityId: charge.id,
      detailsJson: JSON.stringify({ amount: charge.amount, discountAmount: charge.discountAmount, studentId: charge.studentId, feeCategoryId: charge.feeCategoryId }),
    },
  });
  return charge;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getStudentCharge(ctx: TenantContext, id: string) {
  requirePermission(ctx, "finance:view");
  const charge = await getChargeWithPayments(ctx, id);
  if (!charge) throw new FinanceNotFoundError("Tagihan", input.studentChargeId);
  const activePayments = charge.payments.filter((p) => p.status === "POSTED");
  const totalPaid = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const netAmount = getNetChargeAmount(charge);
  return { ...charge, netAmount, totalPaid, outstanding: Math.max(netAmount - totalPaid, 0), excess: Math.max(totalPaid - netAmount, 0) };
}

export async function listStudentCharges(ctx: TenantContext, rawQuery?: unknown) {
  requirePermission(ctx, "finance:view");
  const query = validateChargeQuery(rawQuery || {});
  const where: Prisma.StudentChargeWhereInput = {
    institutionId: ctx.institutionId,
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.feeCategoryId ? { feeCategoryId: query.feeCategoryId } : {}),
    ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await Promise.all([
    prisma.studentCharge.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, nis: true, fullName: true } },
        feeCategory: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
    }),
    prisma.studentCharge.count({ where }),
  ]);
  return { data, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) || 1 };
}

export async function voidStudentCharge(ctx: TenantContext, id: string, reason: string) {
  requirePermission(ctx, "finance:manage");
  const input = validateVoidStudentChargeInput({ studentChargeId: id, reason });
  return prisma.$transaction(async (tx) => {
  const charge = await tx.studentCharge.findUnique({
    where: { id_institutionId: { id, institutionId: ctx.institutionId } },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  if (!charge) throw new FinanceNotFoundError("Tagihan", id);
  if (charge.status === "VOID") return charge;
  if (charge.payments.some((p) => p.status === "POSTED")) throw new ChargeHasPaymentsError();
  const updated = await tx.studentCharge.update({ where: { id_institutionId: { id: input.studentChargeId, institutionId: ctx.institutionId } }, data: { status: "VOID" } });
  await tx.auditLog.create({ data: { institutionId: ctx.institutionId, userId: ctx.userId, action: "VOID", entityType: "StudentCharge", entityId: input.studentChargeId, detailsJson: JSON.stringify({ reason: input.reason }) } });
  return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
