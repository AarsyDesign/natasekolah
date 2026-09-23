import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  CashbookEntryInput,
  cashbookEntryInputSchema,
  CashbookFilterInput,
  cashbookFilterSchema,
} from "../validation/finance";
import { generateUniqueCashbookNumber } from "./receipt-service";

export class CashbookError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "CashbookError";
  }
}

/**
 * Create a Cashbook Entry (Income / Expense)
 */
export async function createCashbookEntry(input: CashbookEntryInput, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");
  const client = txPrisma || prisma;

  const validated = cashbookEntryInputSchema.parse(input);
  const entryNumber = await generateUniqueCashbookNumber(context.institutionId, client);

  const entry = await client.cashbookEntry.create({
    data: {
      institutionId: context.institutionId,
      entryNumber,
      entryDate: validated.entryDate || new Date(),
      type: validated.type,
      amount: validated.amount,
      description: validated.description,
      createdById: context.userId,
    },
    include: {
      createdBy: true,
      paymentTransaction: true,
    },
  });

  return entry;
}

/**
 * List Cashbook Entries with pagination and filtering
 */
export async function listCashbookEntries(
  input?: Partial<CashbookFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = cashbookFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.type) where.type = filter.type;
  if (filter.search) {
    where.OR = [
      { entryNumber: { contains: filter.search } },
      { description: { contains: filter.search } },
    ];
  }
  if (filter.startDate || filter.endDate) {
    where.entryDate = {};
    if (filter.startDate) where.entryDate.gte = filter.startDate;
    if (filter.endDate) where.entryDate.lte = filter.endDate;
  }

  const [items, total] = await Promise.all([
    client.cashbookEntry.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { entryDate: "desc" },
      include: {
        createdBy: true,
        paymentTransaction: {
          include: {
            student: true,
          },
        },
      },
    }),
    client.cashbookEntry.count({ where }),
  ]);

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    totalPages: Math.ceil(total / filter.limit) || 1,
  };
}

/**
 * Get Cashbook Summary (Calculated dynamically from transactions, NOT stored as mutable balance)
 */
export async function getCashbookSummary(txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [incomeAggregate, expenseAggregate, todayIncomeAggregate] = await Promise.all([
    client.cashbookEntry.aggregate({
      where: { institutionId: context.institutionId, type: "INCOME" },
      _sum: { amount: true },
    }),
    client.cashbookEntry.aggregate({
      where: { institutionId: context.institutionId, type: "EXPENSE" },
      _sum: { amount: true },
    }),
    client.cashbookEntry.aggregate({
      where: {
        institutionId: context.institutionId,
        type: "INCOME",
        entryDate: { gte: today },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = incomeAggregate._sum.amount || 0;
  const totalExpense = expenseAggregate._sum.amount || 0;
  const todayIncome = todayIncomeAggregate._sum.amount || 0;
  const netBalance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    netBalance,
    todayIncome,
  };
}
