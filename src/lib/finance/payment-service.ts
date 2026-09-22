import type { PaymentTransaction, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { prisma } from "../prisma";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { validateCreatePaymentInput, validatePaymentQuery, validateVoidPaymentInput } from "../validation/finance";
import { FinanceConflictError, FinanceNotFoundError, PaymentAlreadyVoidedError } from "./types";
import { getNetChargeAmount, refreshChargeStatus } from "./charge-service";

function makeReceiptNumber(paymentId: string, paidAt: Date): string {
  const y = paidAt.getUTCFullYear();
  const m = String(paidAt.getUTCMonth() + 1).padStart(2, "0");
  return "KW-" + y + m + "-" + paymentId.slice(-8).toUpperCase();
}

async function createReceiptAndCashbook(
  tx: Prisma.TransactionClient,
  payment: PaymentTransaction,
  userId: string,
  category: string
) {
  const receipt = await tx.receipt.create({
    data: {
      institutionId: payment.institutionId,
      paymentTransactionId: payment.id,
      receiptNumber: makeReceiptNumber(payment.id, payment.paidAt),
      issuedById: userId,
      issuedAt: payment.paidAt,
    },
  });
  const cashbook = await tx.cashbookEntry.create({
    data: {
      institutionId: payment.institutionId,
      entryType: "INCOME",
      amount: payment.amount,
      category,
      referenceType: "PAYMENT_TRANSACTION",
      referenceId: payment.id,
      paymentTransactionId: payment.id,
      occurredAt: payment.paidAt,
      createdById: userId,
    },
  });
  return { receipt, cashbook };
}

export async function createPayment(ctx: TenantContext, rawInput: unknown) {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateCreatePaymentInput(rawInput), ctx);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.paymentTransaction.findUnique({
      where: { institutionId_idempotencyKey: { institutionId: ctx.institutionId, idempotencyKey: input.idempotencyKey } },
      include: { receipt: true, charge: { include: { feeCategory: true, student: true } }, cashbookEntry: true },
    });
    if (existing) {
      if (existing.studentChargeId !== input.studentChargeId || existing.amount !== input.amount || existing.method !== input.method) {
        throw new FinanceConflictError("Idempotency key sudah digunakan untuk transaksi pembayaran yang berbeda.");
      }
      return existing;
    }

    const charge = await tx.studentCharge.findUnique({
      where: { id_institutionId: { id: input.studentChargeId, institutionId: ctx.institutionId } },
      include: { feeCategory: true, student: true, payments: { where: { status: "POSTED" }, select: { amount: true } } },
    });
    if (!charge) throw new FinanceNotFoundError("Tagihan", input.studentChargeId);
    if (charge.status === "VOID") throw new FinanceConflictError("Tagihan sudah VOID dan tidak dapat menerima pembayaran.");

    const netAmount = getNetChargeAmount(charge);
    const currentPaid = charge.payments.reduce((sum, p) => sum + p.amount, 0);
    const payment = await tx.paymentTransaction.create({
      data: {
        institutionId: ctx.institutionId,
        studentChargeId: charge.id,
        amount: input.amount,
        method: input.method,
        idempotencyKey: input.idempotencyKey,
        paidAt: input.paidAt ?? new Date(),
        receivedById: ctx.userId,
        notes: input.notes || null,
      },
    });

    const { receipt, cashbook } = await createReceiptAndCashbook(tx, payment, ctx.userId, charge.feeCategory.name);
    const newTotalPaid = currentPaid + payment.amount;
    const nextStatus = newTotalPaid <= 0 ? "UNPAID" : newTotalPaid < netAmount ? "PARTIAL" : newTotalPaid === netAmount ? "PAID" : "OVERPAID";
    await tx.studentCharge.update({
      where: { id_institutionId: { id: charge.id, institutionId: ctx.institutionId } },
      data: { status: nextStatus },
    });
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "PaymentTransaction",
        entityId: payment.id,
        detailsJson: JSON.stringify({ amount: payment.amount, method: payment.method, receiptNumber: receipt.receiptNumber, previousPaid: currentPaid, newTotalPaid, excess: Math.max(newTotalPaid - netAmount, 0), cashbookEntryId: cashbook.id }),
      },
    });

    return { payment, receipt, cashbook, chargeStatus: nextStatus, totalPaid: newTotalPaid, outstanding: Math.max(netAmount - newTotalPaid, 0), excess: Math.max(newTotalPaid - netAmount, 0) };
  });
}

export async function getPayment(ctx: TenantContext, id: string) {
  requirePermission(ctx, "finance:view");
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id_institutionId: { id, institutionId: ctx.institutionId } },
    include: { charge: { include: { student: true, feeCategory: true, academicYear: true } }, receipt: true, cashbookEntry: true, receivedBy: { select: { id: true, name: true } } },
  });
  if (!payment) throw new FinanceNotFoundError("Transaksi pembayaran", id);
  return payment;
}

export async function listPayments(ctx: TenantContext, rawQuery?: unknown) {
  requirePermission(ctx, "finance:view");
  const query = validatePaymentQuery(rawQuery || {});
  const where: Prisma.PaymentTransactionWhereInput = {
    institutionId: ctx.institutionId,
    ...(query.studentChargeId ? { studentChargeId: query.studentChargeId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [data, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: { paidAt: "desc" },
      include: {
        charge: { include: { student: { select: { id: true, nis: true, fullName: true } }, feeCategory: { select: { id: true, code: true, name: true } } } },
        receipt: true,
        receivedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.paymentTransaction.count({ where }),
  ]);
  return { data, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) || 1 };
}

export async function voidPayment(ctx: TenantContext, rawInput: unknown) {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateVoidPaymentInput(rawInput), ctx);

  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.findUnique({
      where: { id_institutionId: { id: input.paymentTransactionId, institutionId: ctx.institutionId } },
      include: { charge: { include: { feeCategory: true } }, cashbookEntry: true, receipt: true },
    });
    if (!payment) throw new FinanceNotFoundError("Transaksi pembayaran", input.paymentTransactionId);
    if (payment.status !== "POSTED") throw new PaymentAlreadyVoidedError();
    if (!payment.cashbookEntry) throw new FinanceConflictError("Transaksi pembayaran tidak memiliki entri buku kas yang valid.");

    const reversal = await tx.cashbookEntry.create({
      data: {
        institutionId: ctx.institutionId,
        entryType: "EXPENSE",
        amount: payment.amount,
        category: "REVERSAL:" + payment.charge.feeCategory.name,
        referenceType: "PAYMENT_REVERSAL",
        referenceId: payment.id,
        reversalOfId: payment.cashbookEntry.id,
        occurredAt: new Date(),
        createdById: ctx.userId,
      },
    });

    const updated = await tx.paymentTransaction.update({
      where: { id_institutionId: { id: payment.id, institutionId: ctx.institutionId } },
      data: { status: "VOID" },
    });
    const charge = await refreshChargeStatus(tx, ctx.institutionId, payment.studentChargeId);
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "VOID",
        entityType: "PaymentTransaction",
        entityId: payment.id,
        detailsJson: JSON.stringify({ reason: input.reason, reversalCashbookEntryId: reversal.id, receiptId: payment.receipt?.id ?? null }),
      },
    });
    return { payment: updated, charge, reversalCashbookEntry: reversal };
  });
}

