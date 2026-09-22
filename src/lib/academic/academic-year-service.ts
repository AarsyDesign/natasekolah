import { prisma } from "../prisma";
import type { AcademicYear } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateAcademicYearInput,
  validateUpdateAcademicYearInput,
} from "../validation/academic";
import { ResourceNotFoundError } from "./types";

/**
 * Layanan Domain Tahun Ajaran (AcademicYear) NataSekolah.
 * Invariant: Satu institusi TIDAK BOLEH memiliki lebih dari satu tahun ajaran aktif.
 */

export async function createAcademicYear(
  ctx: TenantContext,
  rawInput: unknown
): Promise<AcademicYear> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateCreateAcademicYearInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Invariant Enforcement: Jika isActive bernilai true, nonaktifkan tahun ajaran lainnya
  return prisma.$transaction(async (tx) => {
    if (sanitized.isActive) {
      await tx.academicYear.updateMany({
        where: {
          institutionId: ctx.institutionId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    return tx.academicYear.create({
      data: {
        name: sanitized.name,
        startDate: sanitized.startDate || null,
        endDate: sanitized.endDate || null,
        isActive: Boolean(sanitized.isActive),
        institutionId: ctx.institutionId,
      },
    });
  });
}

export async function setActiveAcademicYear(
  ctx: TenantContext,
  academicYearId: string
): Promise<AcademicYear> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Verifikasi kepemilikan tenant
  const target = await prisma.academicYear.findUnique({
    where: {
      id_institutionId: {
        id: academicYearId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!target) {
    throw new ResourceNotFoundError("Tahun Ajaran", academicYearId);
  }

  // 3. Transaksi atomik: nonaktifkan semua tahun ajaran di institusi ini, lalu aktifkan target
  return prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: {
        institutionId: ctx.institutionId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return tx.academicYear.update({
      where: {
        id_institutionId: {
          id: academicYearId,
          institutionId: ctx.institutionId,
        },
      },
      data: {
        isActive: true,
      },
    });
  });
}

export async function listAcademicYears(
  ctx: TenantContext
): Promise<AcademicYear[]> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:view");

  // 2. Query terisolasi tenant
  return prisma.academicYear.findMany({
    where: {
      institutionId: ctx.institutionId,
    },
    include: {
      classrooms: {
        select: { id: true, name: true },
      },
      _count: {
        select: { enrollments: true, classrooms: true },
      },
    },
    orderBy: {
      name: "desc",
    },
  });
}

export async function getAcademicYear(
  ctx: TenantContext,
  academicYearId: string
): Promise<AcademicYear> {
  requirePermission(ctx, "academic:view");

  const academicYear = await prisma.academicYear.findUnique({
    where: {
      id_institutionId: {
        id: academicYearId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      classrooms: true,
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!academicYear) {
    throw new ResourceNotFoundError("Tahun Ajaran", academicYearId);
  }

  return academicYear;
}
