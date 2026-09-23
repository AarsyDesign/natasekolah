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
    select: { id: true, fullName: true, nis: true },
  });

  if (validStudents.length === 0) {
    throw new ChargeError("Tidak ada siswa valid yang ditemukan", 404);
  }

  // Duplicate prevention: check existing non-VOID charges for feeCategory + period / academicYear
  const existingCharges = await client.studentCharge.findMany({
    where: {
      institutionId: context.institutionId,
      studentId: { in: validStudents.map((s) => s.id) },
      feeCategoryId: feeCategory.id,
      status: { not: "VOID" },
      ...(validated.period ? { period: validated.period } : {}),
      ...(validated.academicYearId ? { academicYearId: validated.academicYearId } : {}),
    },
    select: { studentId: true },
  });

  const existingStudentIds = new Set(existingCharges.map((c) => c.studentId));
  const studentsToCharge = validStudents.filter((s) => !existingStudentIds.has(s.id));

  if (studentsToCharge.length === 0) {
    return {
      count: 0,
      skippedCount: validStudents.length,
      createdForStudentIds: [],
    };
  }

  const data = studentsToCharge.map((st) => ({
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
    skippedCount: validStudents.length - studentsToCharge.length,
    createdForStudentIds: studentsToCharge.map((s) => s.id),
  };
}

/**
 * Query candidate students for billing generation with duplicate preview
 */
export async function getTargetStudentsForBilling(
  query: {
    classroomId?: string | null;
    feeCategoryId?: string | null;
    period?: string | null;
    academicYearId?: string | null;
  },
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  let candidateStudents: Array<{ id: string; fullName: string; nis: string }> = [];

  if (query.classroomId) {
    // Query active enrollments for the classroom
    const enrollments = await client.enrollment.findMany({
      where: {
        classroomId: query.classroomId,
        institutionId: context.institutionId,
        status: "ENROLLED",
      },
      include: {
        student: {
          select: { id: true, fullName: true, nis: true, status: true },
        },
      },
      orderBy: { student: { fullName: "asc" } },
    });

    candidateStudents = enrollments
      .filter((e) => e.student.status === "ACTIVE")
      .map((e) => ({
        id: e.student.id,
        fullName: e.student.fullName,
        nis: e.student.nis,
      }));
  } else {
    // Query all active students in the tenant
    candidateStudents = await client.student.findMany({
      where: {
        institutionId: context.institutionId,
        status: "ACTIVE",
      },
      select: { id: true, fullName: true, nis: true },
      orderBy: { fullName: "asc" },
      take: 500,
    });
  }

  // Check existing charges if feeCategoryId is provided
  let existingStudentIds = new Set<string>();
  if (query.feeCategoryId && candidateStudents.length > 0) {
    const existing = await client.studentCharge.findMany({
      where: {
        institutionId: context.institutionId,
        feeCategoryId: query.feeCategoryId,
        studentId: { in: candidateStudents.map((s) => s.id) },
        status: { not: "VOID" },
        ...(query.period ? { period: query.period } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      },
      select: { studentId: true },
    });
    existingStudentIds = new Set(existing.map((c) => c.studentId));
  }

  const mappedStudents = candidateStudents.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    nis: s.nis,
    isAlreadyCharged: existingStudentIds.has(s.id),
  }));

  const alreadyChargedCount = mappedStudents.filter((s) => s.isAlreadyCharged).length;
  const eligibleCount = mappedStudents.length - alreadyChargedCount;

  return {
    totalStudents: mappedStudents.length,
    eligibleCount,
    alreadyChargedCount,
    students: mappedStudents,
  };
}

/**
 * Get Billing Summary (Aggregated metrics for charges & outstanding balances)
 */
export async function getBillingSummary(txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const now = new Date();

  const charges = await client.studentCharge.findMany({
    where: {
      institutionId: context.institutionId,
      status: { not: "VOID" },
    },
    include: {
      allocations: {
        select: { amount: true },
      },
    },
  });

  let totalChargesAmount = 0;
  let totalPaidAmount = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let paidCount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const c of charges) {
    totalChargesAmount += c.amount;
    const paid = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    totalPaidAmount += paid;
    const remaining = Math.max(0, c.amount - paid);

    if (c.status === "PAID") {
      paidCount++;
    } else if (c.status === "PARTIAL") {
      partialCount++;
    } else {
      unpaidCount++;
    }

    const isOverdue = c.dueDate && c.dueDate < now && remaining > 0;
    if (isOverdue) {
      overdueCount++;
      overdueAmount += remaining;
    }
  }

  const totalOutstandingAmount = Math.max(0, totalChargesAmount - totalPaidAmount);

  return {
    totalChargesCount: charges.length,
    totalChargesAmount,
    totalPaidAmount,
    totalOutstandingAmount,
    unpaidCount,
    partialCount,
    paidCount,
    overdueCount,
    overdueAmount,
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

  if (filter.status === "OVERDUE") {
    where.status = { in: ["UNPAID", "PARTIAL"] };
    where.dueDate = { lt: new Date() };
  } else if (filter.status) {
    where.status = filter.status;
  }

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

  const now = new Date();

  // Compute allocated totals on demand (no mutable balance stored on student/charge)
  const items = rawItems.map((c) => {
    const allocatedAmount = c.allocations.reduce((sum, a) => sum + a.amount, 0);
    const remainingAmount = Math.max(0, c.amount - allocatedAmount);
    const isOverdue = Boolean(c.dueDate && c.dueDate < now && remainingAmount > 0);
    return {
      ...c,
      allocatedAmount,
      remainingAmount,
      isOverdue,
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
