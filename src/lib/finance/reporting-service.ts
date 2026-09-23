import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { FinancialReportFilterInput, financialReportFilterSchema } from "../validation/finance";

export async function getPaymentSummaryReport(
  input?: Partial<FinancialReportFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = financialReportFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.startDate || filter.endDate) {
    where.paymentDate = {};
    if (filter.startDate) where.paymentDate.gte = filter.startDate;
    if (filter.endDate) where.paymentDate.lte = filter.endDate;
  }

  const transactions = await client.paymentTransaction.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      receivedBy: { select: { id: true, name: true } },
      receipt: { select: { receiptNumber: true } },
      allocations: {
        include: {
          studentCharge: {
            include: {
              feeCategory: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  });

  let totalAmount = 0;
  const categoryMap = new Map<string, { id: string; name: string; amount: number; count: number }>();
  const methodMap = new Map<string, { method: string; amount: number; count: number }>();

  for (const tx of transactions) {
    totalAmount += tx.amount;

    // Method breakdown
    const mItem = methodMap.get(tx.paymentMethod) || {
      method: tx.paymentMethod,
      amount: 0,
      count: 0,
    };
    mItem.amount += tx.amount;
    mItem.count += 1;
    methodMap.set(tx.paymentMethod, mItem);

    // Category breakdown via allocations
    for (const alloc of tx.allocations) {
      const cat = alloc.studentCharge.feeCategory;
      const cItem = categoryMap.get(cat.id) || {
        id: cat.id,
        name: cat.name,
        amount: 0,
        count: 0,
      };
      cItem.amount += alloc.amount;
      cItem.count += 1;
      categoryMap.set(cat.id, cItem);
    }
  }

  return {
    period: {
      startDate: filter.startDate || null,
      endDate: filter.endDate || null,
    },
    totalTransactions: transactions.length,
    totalAmount,
    averageAmount: transactions.length > 0 ? Math.round(totalAmount / transactions.length) : 0,
    byCategory: Array.from(categoryMap.values()),
    byMethod: Array.from(methodMap.values()),
    items: transactions.map((tx) => ({
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      receiptNumber: tx.receipt?.receiptNumber || "-",
      paymentDate: tx.paymentDate,
      studentName: tx.student.fullName,
      studentNis: tx.student.nis,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      receivedByName: tx.receivedBy.name,
      note: tx.note,
    })),
  };
}

export async function getOutstandingSummaryReport(
  input?: Partial<FinancialReportFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = financialReportFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
    status: { not: "VOID" },
  };

  if (filter.feeCategoryId) where.feeCategoryId = filter.feeCategoryId;
  if (filter.academicYearId) where.academicYearId = filter.academicYearId;

  const charges = await client.studentCharge.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      student: { select: { id: true, fullName: true, nis: true, phone: true, parentWaPhone: true } },
      feeCategory: { select: { id: true, code: true, name: true } },
      academicYear: { select: { id: true, name: true } },
      allocations: { select: { amount: true } },
    },
  });

  const now = new Date();
  let totalChargesAmount = 0;
  let totalPaidAmount = 0;
  let totalOutstandingAmount = 0;
  let overdueChargesCount = 0;
  let overdueAmount = 0;

  const items = [];

  for (const c of charges) {
    const paid = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    const remaining = Math.max(0, c.amount - paid);

    totalChargesAmount += c.amount;
    totalPaidAmount += paid;
    totalOutstandingAmount += remaining;

    const isOverdue = Boolean(c.dueDate && c.dueDate < now && remaining > 0);
    let daysOverdue = 0;
    if (isOverdue && c.dueDate) {
      overdueChargesCount++;
      overdueAmount += remaining;
      const diffMs = now.getTime() - new Date(c.dueDate).getTime();
      daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    if (remaining > 0) {
      items.push({
        id: c.id,
        studentId: c.student.id,
        studentName: c.student.fullName,
        studentNis: c.student.nis,
        studentPhone: c.student.phone || c.student.parentWaPhone || "-",
        feeCategoryName: c.feeCategory.name,
        period: c.period || "-",
        academicYearName: c.academicYear?.name || "-",
        dueDate: c.dueDate,
        amount: c.amount,
        paidAmount: paid,
        remainingAmount: remaining,
        status: c.status,
        isOverdue,
        daysOverdue,
      });
    }
  }

  return {
    totalChargesCount: charges.length,
    totalChargesAmount,
    totalPaidAmount,
    totalOutstandingAmount,
    overdueChargesCount,
    overdueAmount,
    items,
  };
}

export async function getCashflowReport(
  input?: Partial<FinancialReportFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = financialReportFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.startDate || filter.endDate) {
    where.entryDate = {};
    if (filter.startDate) where.entryDate.gte = filter.startDate;
    if (filter.endDate) where.entryDate.lte = filter.endDate;
  }

  const entries = await client.cashbookEntry.findMany({
    where,
    orderBy: { entryDate: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      paymentTransaction: {
        select: {
          transactionNumber: true,
          student: { select: { fullName: true } },
        },
      },
    },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const e of entries) {
    if (e.type === "INCOME") {
      totalIncome += e.amount;
    } else {
      totalExpense += e.amount;
    }
  }

  const netBalance = totalIncome - totalExpense;

  return {
    period: {
      startDate: filter.startDate || null,
      endDate: filter.endDate || null,
    },
    totalEntries: entries.length,
    totalIncome,
    totalExpense,
    netBalance,
    items: entries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      entryDate: e.entryDate,
      type: e.type,
      amount: e.amount,
      description: e.description,
      createdByName: e.createdBy.name,
      paymentRef: e.paymentTransaction
        ? `${e.paymentTransaction.transactionNumber} (${e.paymentTransaction.student.fullName})`
        : null,
    })),
  };
}
