import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  FeeCategoryInput,
  feeCategoryInputSchema,
  UpdateFeeCategoryInput,
  updateFeeCategoryInputSchema,
  FeeCategoryFilterInput,
  feeCategoryFilterSchema,
} from "../validation/finance";

export class FeeCategoryError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "FeeCategoryError";
  }
}

/**
 * Create master FeeCategory for institution
 */
export async function createFeeCategory(input: FeeCategoryInput, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");

  const validated = feeCategoryInputSchema.parse(input);
  const client = txPrisma || prisma;

  // Check code uniqueness per institution
  const existing = await client.feeCategory.findFirst({
    where: {
      institutionId: context.institutionId,
      code: validated.code,
    },
  });

  if (existing) {
    throw new FeeCategoryError(
      `Kode kategori biaya [${validated.code}] sudah terdaftar di lembaga ini`,
      400
    );
  }

  const feeCategory = await client.feeCategory.create({
    data: {
      institutionId: context.institutionId,
      code: validated.code,
      name: validated.name,
      description: validated.description,
      amount: validated.amount,
      frequency: validated.frequency,
      isActive: validated.isActive,
    },
  });

  return feeCategory;
}

/**
 * Update FeeCategory details (Does NOT alter historical StudentCharge snapshots)
 */
export async function updateFeeCategory(
  id: string,
  input: UpdateFeeCategoryInput,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:manage");
  const client = txPrisma || prisma;

  const category = await client.feeCategory.findFirst({
    where: { id, institutionId: context.institutionId },
  });

  if (!category) {
    throw new FeeCategoryError("Kategori biaya tidak ditemukan", 404);
  }

  const validated = updateFeeCategoryInputSchema.parse(input);

  if (validated.code && validated.code !== category.code) {
    const existing = await client.feeCategory.findFirst({
      where: {
        institutionId: context.institutionId,
        code: validated.code,
      },
    });
    if (existing) {
      throw new FeeCategoryError(
        `Kode kategori biaya [${validated.code}] sudah terdaftar`,
        400
      );
    }
  }

  const updated = await client.feeCategory.update({
    where: { id: category.id },
    data: {
      ...(validated.code && { code: validated.code }),
      ...(validated.name && { name: validated.name }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.amount !== undefined && { amount: validated.amount }),
      ...(validated.frequency && { frequency: validated.frequency }),
      ...(validated.isActive !== undefined && { isActive: validated.isActive }),
    },
  });

  return updated;
}

/**
 * List FeeCategories for current institution
 */
export async function listFeeCategories(
  input?: Partial<FeeCategoryFilterInput>,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const filter = feeCategoryFilterSchema.parse(input || {});
  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.frequency) where.frequency = filter.frequency;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;
  if (filter.search) {
    where.OR = [
      { code: { contains: filter.search } },
      { name: { contains: filter.search } },
    ];
  }

  const [items, total] = await Promise.all([
    client.feeCategory.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { code: "asc" },
    }),
    client.feeCategory.count({ where }),
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
 * Get FeeCategory by ID
 */
export async function getFeeCategory(id: string, txPrisma?: typeof prisma) {
  const context = requireTenantContext();
  requirePermission(context, "finance:view");
  const client = txPrisma || prisma;

  const category = await client.feeCategory.findFirst({
    where: { id, institutionId: context.institutionId },
  });

  if (!category) {
    throw new FeeCategoryError("Kategori biaya tidak ditemukan", 404);
  }

  return category;
}
