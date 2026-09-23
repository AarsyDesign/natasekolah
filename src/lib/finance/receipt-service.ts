import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ReceiptQueryInput, receiptQuerySchema } from "../validation/finance";

export class ReceiptError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "ReceiptError";
  }
}

/**
 * Generates an atomic, collision-free Kwitansi Receipt Number in format: KW-YYYYMM-XXXXXX
 */
export async function generateUniqueReceiptNumber(
  institutionId: string,
  txPrisma?: typeof prisma
): Promise<string> {
  const client = txPrisma || prisma;
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", ""); // e.g. "202609"
  const prefix = `KW-${dateStr}-`;

  const count = await client.receipt.count({
    where: {
      institutionId,
      receiptNumber: { startsWith: prefix },
    },
  });

  const nextSeq = (count + 1).toString().padStart(6, "0");
  const receiptNumber = `${prefix}${nextSeq}`;

  // Double check uniqueness
  const existing = await client.receipt.findFirst({
    where: { institutionId, receiptNumber },
  });

  if (existing) {
    // Append random 2-digit fallback if rare collision occurs
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    return `${prefix}${nextSeq}-${randomSuffix}`;
  }

  return receiptNumber;
}

/**
 * Generates an atomic Payment Transaction Number: TRX-YYYYMM-XXXXXX
 */
export async function generateUniqueTransactionNumber(
  institutionId: string,
  txPrisma?: typeof prisma
): Promise<string> {
  const client = txPrisma || prisma;
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `TRX-${dateStr}-`;

  const count = await client.paymentTransaction.count({
    where: {
      institutionId,
      transactionNumber: { startsWith: prefix },
    },
  });

  const nextSeq = (count + 1).toString().padStart(6, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Generates an atomic Cashbook Entry Number: CSH-YYYYMM-XXXXXX
 */
export async function generateUniqueCashbookNumber(
  institutionId: string,
  txPrisma?: typeof prisma
): Promise<string> {
  const client = txPrisma || prisma;
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `CSH-${dateStr}-`;

  const count = await client.cashbookEntry.count({
    where: {
      institutionId,
      entryNumber: { startsWith: prefix },
    },
  });

  const nextSeq = (count + 1).toString().padStart(6, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Get Receipt by Payment Transaction ID
 */
export async function getReceiptByPayment(paymentTransactionId: string) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");

  const receipt = await prisma.receipt.findFirst({
    where: {
      institutionId: context.institutionId,
      paymentTransactionId,
    },
    include: {
      paymentTransaction: {
        include: {
          student: true,
          receivedBy: true,
          allocations: {
            include: {
              studentCharge: {
                include: {
                  feeCategory: true,
                },
              },
            },
          },
        },
      },
      issuedBy: true,
    },
  });

  if (!receipt) {
    throw new ReceiptError("Kwitansi tidak ditemukan", 404);
  }

  return receipt;
}

/**
 * List Receipts for Tenant
 */
export async function listReceipts(input?: Partial<ReceiptQueryInput>) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");

  const filter = receiptQuerySchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.receiptNumber) {
    where.receiptNumber = { contains: filter.receiptNumber };
  }
  if (filter.paymentTransactionId) {
    where.paymentTransactionId = filter.paymentTransactionId;
  }
  if (filter.studentId) {
    where.paymentTransaction = { studentId: filter.studentId };
  }

  const [items, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { issuedAt: "desc" },
      include: {
        paymentTransaction: {
          include: {
            student: true,
          },
        },
        issuedBy: true,
      },
    }),
    prisma.receipt.count({ where }),
  ]);

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    totalPages: Math.ceil(total / filter.limit) || 1,
  };
}
