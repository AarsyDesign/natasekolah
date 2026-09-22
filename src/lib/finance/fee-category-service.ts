import type { FeeCategory } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { prisma } from "../prisma";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import { validateCreateFeeCategoryInput, validateUpdateFeeCategoryInput, validateFeeCategoryQuery } from "../validation/finance";
import { FinanceConflictError, FinanceNotFoundError } from "./types";

export async function createFeeCategory(ctx: TenantContext, rawInput: unknown): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateCreateFeeCategoryInput(rawInput), ctx);
  const existing = await prisma.feeCategory.findUnique({ where: { institutionId_code: { institutionId: ctx.institutionId, code: input.code } } });
  if (existing) throw new FinanceConflictError("Kode kategori tagihan sudah digunakan: " + input.code);
  const category = await prisma.feeCategory.create({ data: { institutionId: ctx.institutionId, code: input.code, name: input.name, description: input.description || null } });
  await prisma.auditLog.create({ data: { institutionId: ctx.institutionId, userId: ctx.userId, action: "CREATE", entityType: "FeeCategory", entityId: category.id, detailsJson: JSON.stringify({ code: category.code, name: category.name }) } });
  return category;
}

export async function updateFeeCategory(ctx: TenantContext, id: string, rawInput: unknown): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  const input = sanitizeClientInput(validateUpdateFeeCategoryInput(rawInput), ctx);
  const existing = await prisma.feeCategory.findUnique({ where: { id_institutionId: { id, institutionId: ctx.institutionId } } });
  if (!existing) throw new FinanceNotFoundError("Kategori tagihan", id);
  if (input.code && input.code !== existing.code) {
    const conflict = await prisma.feeCategory.findUnique({ where: { institutionId_code: { institutionId: ctx.institutionId, code: input.code } } });
    if (conflict) throw new FinanceConflictError("Kode kategori tagihan sudah digunakan: " + input.code);
  }
  return prisma.feeCategory.update({
    where: { id_institutionId: { id, institutionId: ctx.institutionId } },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
    },
  });
}

export async function setFeeCategoryActive(ctx: TenantContext, id: string, isActive: boolean): Promise<FeeCategory> {
  requirePermission(ctx, "finance:manage");
  const existing = await prisma.feeCategory.findUnique({ where: { id_institutionId: { id, institutionId: ctx.institutionId } } });
  if (!existing) throw new FinanceNotFoundError("Kategori tagihan", id);
  return prisma.feeCategory.update({ where: { id_institutionId: { id, institutionId: ctx.institutionId } }, data: { isActive } });
}

export async function listFeeCategories(ctx: TenantContext, rawQuery?: unknown): Promise<FeeCategory[]> {
  requirePermission(ctx, "finance:view");
  const query = validateFeeCategoryQuery(rawQuery || {});
  return prisma.feeCategory.findMany({
    where: { institutionId: ctx.institutionId, ...(query.activeOnly ? { isActive: true } : {}), ...(query.search ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { name: { contains: query.search, mode: "insensitive" } }] } : {}) },
    orderBy: { name: "asc" },
  });
}
