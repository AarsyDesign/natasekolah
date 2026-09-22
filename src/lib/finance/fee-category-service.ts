import { Prisma, type FeeCategory } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { prisma } from "../prisma";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { validateCreateFeeCategoryInput, validateUpdateFeeCategoryInput, validateFeeCategoryQuery } from "../validation/finance";
import { FinanceConflictError, FinanceNotFoundError } from "./types";

export async function createFeeCategory(ctx: TenantContext, rawInput: unknown): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateCreateFeeCategoryInput(rawInput), ctx);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeCategory.findUnique({ where: { institutionId_code: { institutionId: ctx.institutionId, code: input.code } } });
    if (existing) throw new FinanceConflictError("Kode kategori tagihan sudah digunakan: " + input.code);
    const category = await tx.feeCategory.create({ data: { institutionId: ctx.institutionId, code: input.code, name: input.name, description: input.description || null } });
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "FeeCategory",
        entityId: category.id,
        detailsJson: JSON.stringify({ code: category.code, name: category.name, isActive: category.isActive }),
      },
    });
    return category;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateFeeCategory(ctx: TenantContext, id: string, rawInput: unknown): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateUpdateFeeCategoryInput(rawInput), ctx);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeCategory.findUnique({ where: { id_institutionId: { id, institutionId: ctx.institutionId } } });
    if (!existing) throw new FinanceNotFoundError("Kategori tagihan", id);
    if (input.code && input.code !== existing.code) {
      const conflict = await tx.feeCategory.findUnique({ where: { institutionId_code: { institutionId: ctx.institutionId, code: input.code } } });
      if (conflict) throw new FinanceConflictError("Kode kategori tagihan sudah digunakan: " + input.code);
    }
    const category = await tx.feeCategory.update({
      where: { id_institutionId: { id, institutionId: ctx.institutionId } },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "FeeCategory",
        entityId: id,
        detailsJson: JSON.stringify({ before: { code: existing.code, name: existing.name, description: existing.description }, after: { code: category.code, name: category.name, description: category.description } }),
      },
    });
    return category;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function setFeeCategoryActive(ctx: TenantContext, id: string, isActive: boolean): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeCategory.findUnique({ where: { id_institutionId: { id, institutionId: ctx.institutionId } } });
    if (!existing) throw new FinanceNotFoundError("Kategori tagihan", id);
    const category = await tx.feeCategory.update({
      where: { id_institutionId: { id, institutionId: ctx.institutionId } },
      data: { isActive },
    });
    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "FeeCategory",
        entityId: id,
        detailsJson: JSON.stringify({ field: "isActive", before: existing.isActive, after: category.isActive }),
      },
    });
    return category;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listFeeCategories(ctx: TenantContext, rawQuery?: unknown): Promise<FeeCategory[]> {
  requirePermission(ctx, "finance:view");
  const query = validateFeeCategoryQuery(rawQuery || {});
  return prisma.feeCategory.findMany({
    where: { institutionId: ctx.institutionId, ...(query.activeOnly ? { isActive: true } : {}), ...(query.search ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { name: { contains: query.search, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" },
  });
}
