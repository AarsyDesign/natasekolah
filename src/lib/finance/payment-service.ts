import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  PaymentTransactionInput,
  paymentTransactionInputSchema,
  PaymentTransactionFilterInput,
  paymentTransactionFilterSchema,
} from "../validation/finance";
import {
  generateUniqueTransactionNumber,
  generateUniqueCashbookNumber,
  generateUniqueReceiptNumber,
} from "./receipt-service";
import { resolveStudentGuardianRecipient } from "../notification/guardian-resolver";
import { notifyPaymentCompleted } from "../notification/events";

export class PaymentError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * Atomic Payment Transaction Orchestrator
 * All operations execute within a single Prisma $transaction boundary.
 * If any step fails, EVERYTHING is rolled back cleanly.
 */
export async function createPaymentTransaction(
  input: PaymentTransactionInput,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");

  const validated = paymentTransactionInputSchema.parse(input);
  const rootClient = txPrisma || prisma;

  // 1. Validate total allocation does not exceed payment amount
  const totalAllocated = validated.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (totalAllocated > validated.amount) {
    throw new PaymentError(
      `Total alokasi (${totalAllocated.toLocaleString("id-ID")}) melebihi nominal pembayaran (${validated.amount.toLocaleString("id-ID")})`,
      400
    );
  }

  // Execute atomic Prisma transaction
  const result = await rootClient.$transaction(async (tx) => {
    // 2. Validate Student belongs to current tenant
    const student = await tx.student.findFirst({
      where: { id: validated.studentId, institutionId: context.institutionId },
    });

    if (!student) {
      throw new PaymentError("Siswa tidak ditemukan dalam lembaga ini", 404);
    }

    // 3. Fetch and validate all target charges
    const chargeIds = validated.allocations.map((a) => a.studentChargeId);
    const charges = await tx.studentCharge.findMany({
      where: {
        id: { in: chargeIds },
        institutionId: context.institutionId,
      },
      include: {
        allocations: true,
        feeCategory: true,
      },
    });

    if (charges.length !== chargeIds.length) {
      throw new PaymentError("Satu atau lebih tagihan tidak ditemukan dalam lembaga ini", 404);
    }

    // Validate charges eligibility and amounts
    for (const alloc of validated.allocations) {
      const charge = charges.find((c) => c.id === alloc.studentChargeId);
      if (!charge) continue;

      if (charge.studentId !== student.id) {
        throw new PaymentError(
          `Tagihan [${charge.feeCategory.name}] tidak dimiliki oleh siswa [${student.fullName}]`,
          400
        );
      }

      if (charge.status === "VOID") {
        throw new PaymentError(
          `Tagihan [${charge.feeCategory.name}] berstatus VOID dan tidak dapat menerima pembayaran`,
          400
        );
      }

      const existingAllocated = charge.allocations.reduce((sum, a) => sum + a.amount, 0);
      const remainingUnpaid = Math.max(0, charge.amount - existingAllocated);

      if (alloc.amount > remainingUnpaid) {
        throw new PaymentError(
          `Alokasi untuk tagihan [${charge.feeCategory.name}] (${alloc.amount.toLocaleString(
            "id-ID"
          )}) melebihi sisa tagihan (${remainingUnpaid.toLocaleString("id-ID")})`,
          400
        );
      }
    }

    // 4. Generate unique transaction number
    const transactionNumber = await generateUniqueTransactionNumber(
      context.institutionId,
      tx as any
    );

    // 5. Create PaymentTransaction
    const payment = await tx.paymentTransaction.create({
      data: {
        institutionId: context.institutionId,
        studentId: student.id,
        transactionNumber,
        paymentDate: validated.paymentDate || new Date(),
        amount: validated.amount,
        paymentMethod: validated.paymentMethod,
        note: validated.note || null,
        receivedById: context.userId,
      },
    });

    // 6. Create PaymentAllocations
    for (const alloc of validated.allocations) {
      await tx.paymentAllocation.create({
        data: {
          institutionId: context.institutionId,
          paymentTransactionId: payment.id,
          studentChargeId: alloc.studentChargeId,
          amount: alloc.amount,
        },
      });
    }

    // 7. Update StudentCharge statuses based on new allocated total
    for (const charge of charges) {
      const currentAlloc = validated.allocations.find(
        (a) => a.studentChargeId === charge.id
      );
      const addedAmount = currentAlloc ? currentAlloc.amount : 0;
      const existingAllocated = charge.allocations.reduce((sum, a) => sum + a.amount, 0);
      const newTotalAllocated = existingAllocated + addedAmount;

      let newStatus: "UNPAID" | "PARTIAL" | "PAID" = "UNPAID";
      if (newTotalAllocated >= charge.amount) {
        newStatus = "PAID";
      } else if (newTotalAllocated > 0) {
        newStatus = "PARTIAL";
      }

      await tx.studentCharge.update({
        where: { id: charge.id },
        data: { status: newStatus },
      });
    }

    // 8. Create CashbookEntry (Type: INCOME)
    const entryNumber = await generateUniqueCashbookNumber(context.institutionId, tx as any);
    await tx.cashbookEntry.create({
      data: {
        institutionId: context.institutionId,
        entryNumber,
        entryDate: payment.paymentDate,
        type: "INCOME",
        amount: payment.amount,
        paymentTransactionId: payment.id,
        description: `Pembayaran ${student.fullName} (${transactionNumber})`,
        createdById: context.userId,
      },
    });

    // 9. Create Receipt (Kwitansi)
    const receiptNumber = await generateUniqueReceiptNumber(context.institutionId, tx as any);
    const receipt = await tx.receipt.create({
      data: {
        institutionId: context.institutionId,
        paymentTransactionId: payment.id,
        receiptNumber,
        issuedAt: payment.paymentDate,
        issuedById: context.userId,
      },
    });

    return {
      payment,
      receipt,
      student,
    };
  });

  // Post-commit event: Queue payment receipt notification outbox
  try {
    const recipient = await resolveStudentGuardianRecipient(
      result.student.id,
      context.institutionId,
      rootClient as any
    );

    if (recipient) {
      await notifyPaymentCompleted(
        {
          recipientPhone: recipient.recipientPhone,
          studentName: result.student.fullName,
          receiptNo: result.receipt.receiptNumber,
          amount: result.payment.amount,
          categoryName: "Pembayaran Tagihan Siswa",
          paymentDate: result.payment.paymentDate.toLocaleDateString("id-ID"),
          idempotencyKey: `PAYMENT_RECEIPT:${result.payment.id}`,
        },
        rootClient as any
      );
    }
  } catch (notifErr) {
    console.error("[PaymentNotification] Failed to queue payment receipt outbox:", notifErr);
  }

  return result;
}

/**
 * List PaymentTransactions for Tenant
 */
export async function listPaymentTransactions(
  input?: Partial<PaymentTransactionFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = paymentTransactionFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.studentId) where.studentId = filter.studentId;
  if (filter.paymentMethod) where.paymentMethod = filter.paymentMethod;

  if (filter.search) {
    where.OR = [
      { transactionNumber: { contains: filter.search } },
      { student: { fullName: { contains: filter.search } } },
      { student: { nis: { contains: filter.search } } },
    ];
  }

  if (filter.startDate || filter.endDate) {
    where.paymentDate = {};
    if (filter.startDate) where.paymentDate.gte = filter.startDate;
    if (filter.endDate) where.paymentDate.lte = filter.endDate;
  }

  const [items, total] = await Promise.all([
    client.paymentTransaction.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { paymentDate: "desc" },
      include: {
        student: true,
        receivedBy: true,
        receipt: true,
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
    }),
    client.paymentTransaction.count({ where }),
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
 * Get PaymentTransaction by ID (Immutable, no delete or amount edit allowed)
 */
export async function getPaymentTransaction(id: string, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const payment = await client.paymentTransaction.findFirst({
    where: { id, institutionId: context.institutionId },
    include: {
      student: true,
      receivedBy: true,
      receipt: true,
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
  });

  if (!payment) {
    throw new PaymentError("Transaksi pembayaran tidak ditemukan", 404);
  }

  return payment;
}
