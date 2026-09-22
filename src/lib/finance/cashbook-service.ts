import { Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { prisma } from "../prisma";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { validateCreateCashbookExpenseInput } from "../validation/finance";
import { FinanceNotFoundError } from "./types";

export async function createCashbookExpense(ctx: TenantContext, rawInput: unknown) {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateCreateCashbookExpenseInput(rawInput), ctx);
  return prisma.$transaction(async (tx) => {
    const entry = await tx.cashbookEntry.create({
      data: {
        institutionId: ctx.institutionId,
        entryType: "EXPENSE",
        amount: input.amount,
        category: input.category,
        note: input.note || null,
        occurredAt: input.occurredAt ?? new Date(),
        createdById: ctx.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "CashbookEntry",
        entityId: entry.id,
        detailsJson: JSON.stringify({ entryType: entry.entryType, amount: entry.amount, category: entry.category }),
      },
    });
    return entry;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listCashbook(ctx: TenantContext, page = 1, pageSize = 50) {
  requirePermission(ctx, "finance:view");
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const where: Prisma.CashbookEntryWhereInput = { institutionId: ctx.institutionId };
  const skip = (safePage - 1) * safeSize;
  const [data, total] = await Promise.all([
    prisma.cashbookEntry.findMany({
      where,
      skip,
      take: safeSize,
      orderBy: { occurredAt: "desc" },
      include: {
        paymentTransaction: { include: { receipt: true } },
        createdBy: { select: { id: true, name: true } },
        reversalOf: { select: { id: true, amount: true, entryType: true } },
      },
    }),
    prisma.cashbookEntry.count({ where }),
  ]);
  const balance = data.reduce((sum, entry) => sum + (entry.entryType === "INCOME" ? entry.amount : -entry.amount), 0);
  return { data, total, page: safePage, pageSize: safeSize, balance };
}

export async function getCashbookBalance(ctx: TenantContext) {
  requirePermission(ctx, "finance:view");
  const totals = await prisma.cashbookEntry.groupBy({
    by: ["entryType"],
    where: { institutionId: ctx.institutionId },
    _sum: { amount: true },
  });
  const income = totals.find((x) => x.entryType === "INCOME")?._sum.amount ?? 0;
  const expense = totals.find((x) => x.entryType === "EXPENSE")?._sum.amount ?? 0;
  return { income, expense, balance: income - expense };
}
