import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  StudentChargeInput,
  studentChargeInputSchema,
  BulkChargeInput,
  bulkChargeInputSchema,
  StudentChargeFilterInput,
  studentChargeFilterSchema,
} from "../validation/finance";

export class ChargeError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "ChargeError";
  }
}

/**
 * Create a single StudentCharge with nominal snapshot
 */
export async function createStudentCharge(input: StudentChargeInput, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");

  const validated = studentChargeInputSchema.parse(input);
  const client = txPrisma || prisma;

  // Validate student belongs to tenant
  const student = await client.student.findFirst({
    where: { id: validated.studentId, institutionId: context.institutionId },
  });

  if (!student) {
    throw new ChargeError("Siswa tidak ditemukan dalam lembaga ini", 404);
  }

  // Validate fee category belongs to tenant
  const feeCategory = await client.feeCategory.findFirst({
    where: { id: validated.feeCategoryId, institutionId: context.institutionId },
  });

  if (!feeCategory) {
    throw new ChargeError("Kategori biaya tidak ditemukan dalam lembaga ini", 404);
  }

  const charge = await client.studentCharge.create({
    data: {
      institutionId: context.institutionId,
      studentId: student.id,
      feeCategoryId: feeCategory.id,
      academicYearId: validated.academicYearId || null,
      period: validated.period || null,
      dueDate: validated.dueDate || null,
      amount: validated.amount, // Snapshot amount
      status: "UNPAID",
    },
    include: {
      student: true,
      feeCategory: true,
    },
  });

  return charge;
}

/**
 * Bulk create StudentCharges for multiple students
 */
export async function bulkCreateStudentCharges(input: BulkChargeInput, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");
  const client = txPrisma || prisma;

  const validated = bulkChargeInputSchema.parse(input);

  const feeCategory = await client.feeCategory.findFirst({
    where: { id: validated.feeCategoryId, institutionId: context.institutionId },
  });

  if (!feeCategory) {
    throw new ChargeError("Kategori biaya tidak ditemukan", 404);
  }

  // Verify all students belong to tenant
  const validStudents = await client.student.findMany({
    where: {
      id: { in: validated.studentIds },
      institutionId: context.institutionId,
    },
    select: { id: true },
  });

  if (validStudents.length === 0) {
    throw new ChargeError("Tidak ada siswa valid yang ditemukan", 404);
  }

  const data = validStudents.map((st) => ({
    institutionId: context.institutionId,
    studentId: st.id,
    feeCategoryId: feeCategory.id,
    academicYearId: validated.academicYearId || null,
    period: validated.period || null,
    dueDate: validated.dueDate || null,
    amount: validated.amount, // Snapshot amount
    status: "UNPAID",
  }));

  const result = await client.studentCharge.createMany({ data });

  return {
    count: result.count,
    createdForStudentIds: validStudents.map((s) => s.id),
  };
}

/**
 * List StudentCharges with status and allocated totals calculation
 */
export async function listStudentCharges(
  input?: Partial<StudentChargeFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = studentChargeFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.studentId) where.studentId = filter.studentId;
  if (filter.feeCategoryId) where.feeCategoryId = filter.feeCategoryId;
  if (filter.academicYearId) where.academicYearId = filter.academicYearId;
  if (filter.period) where.period = filter.period;
  if (filter.status) where.status = filter.status;

  if (filter.search) {
    where.OR = [
      { student: { fullName: { contains: filter.search } } },
      { student: { nis: { contains: filter.search } } },
      { feeCategory: { name: { contains: filter.search } } },
    ];
  }

  const [rawItems, total] = await Promise.all([
    client.studentCharge.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { createdAt: "desc" },
      include: {
        student: true,
        feeCategory: true,
        academicYear: true,
        allocations: true,
      },
    }),
    client.studentCharge.count({ where }),
  ]);

  // Compute allocated totals on demand (no mutable balance stored on student/charge)
  const items = rawItems.map((c) => {
    const allocatedAmount = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    const remainingAmount = Math.max(0, c.amount - allocatedAmount);
    return {
      ...c,
      allocatedAmount,
      remainingAmount,
    };
  });

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    totalPages: Math.ceil(total / filter.limit) || 1,
  };
}

/**
 * Get StudentCharge details
 */
export async function getStudentCharge(id: string, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const charge = await client.studentCharge.findFirst({
    where: { id, institutionId: context.institutionId },
    include: {
      student: true,
      feeCategory: true,
      academicYear: true,
      allocations: {
        include: {
          paymentTransaction: {
            include: {
              receivedBy: true,
              receipt: true,
            },
          },
        },
      },
    },
  });

  if (!charge) {
    throw new ChargeError("Tagihan tidak ditemukan", 404);
  }

  const allocatedAmount = charge.allocations.reduce((sum, a) => sum + a.amount, 0);
  const remainingAmount = Math.max(0, charge.amount - allocatedAmount);

  return {
    ...charge,
    allocatedAmount,
    remainingAmount,
  };
}

/**
 * Void a StudentCharge (cannot void if allocations exist)
 */
export async function voidStudentCharge(id: string, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");
  const client = txPrisma || prisma;

  const charge = await client.studentCharge.findFirst({
    where: { id, institutionId: context.institutionId },
    include: { allocations: true },
  });

  if (!charge) {
    throw new ChargeError("Tagihan tidak ditemukan", 404);
  }

  if (charge.allocations.length > 0) {
    throw new ChargeError(
      "Tagihan yang sudah memiliki alokasi pembayaran tidak dapat di-void",
      400
    );
  }

  return await client.studentCharge.update({
    where: { id: charge.id },
    data: { status: "VOID" },
  });
}

/**
 * Calculate Student Financial Summary (Calculated from transactions, NOT stored as mutable balance)
 */
export async function calculateStudentFinancialSummary(studentId: string, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const charges = await client.studentCharge.findMany({
    where: {
      studentId,
      institutionId: context.institutionId,
      status: { not: "VOID" },
    },
    include: { allocations: true },
  });

  let totalCharges = 0;
  let totalPaid = 0;

  for (const c of charges) {
    totalCharges += c.amount;
    const allocated = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    totalPaid += allocated;
  }

  const totalOutstanding = Math.max(0, totalCharges - totalPaid);

  return {
    studentId,
    totalCharges,
    totalPaid,
    totalOutstanding,
    chargeCount: charges.length,
  };
}
