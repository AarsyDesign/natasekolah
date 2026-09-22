import { prisma } from "../prisma";
import type { Subject, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateSubjectInput,
  validateUpdateSubjectInput,
  validateSubjectFilter,
} from "../validation/teaching";
import { DuplicateSubjectCodeError, ResourceNotFoundError } from "./types";

/**
 * Layanan Domain Mata Pelajaran (Subject) NataSekolah.
 * Seluruh subjek terikat ketat pada institusi aktif.
 */

export async function createSubject(
  ctx: TenantContext,
  rawInput: unknown
): Promise<Subject> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateCreateSubjectInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Invariant: Cek keunikan kode mata pelajaran dalam institusi yang sama
  if (sanitized.code) {
    const existingCode = await prisma.subject.findUnique({
      where: {
        institutionId_code: {
          institutionId: ctx.institutionId,
          code: sanitized.code,
        },
      },
    });

    if (existingCode) {
      throw new DuplicateSubjectCodeError(sanitized.code);
    }
  }

  // 5. Eksekusi Simpan
  return prisma.subject.create({
    data: {
      name: sanitized.name,
      code: sanitized.code || null,
      shortName: sanitized.shortName || null,
      category: sanitized.category || "UMUM",
      isActive: sanitized.isActive !== undefined ? sanitized.isActive : true,
      institutionId: ctx.institutionId,
    },
  });
}

export async function updateSubject(
  ctx: TenantContext,
  subjectId: string,
  rawInput: unknown
): Promise<Subject> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateUpdateSubjectInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi keberadaan dan kepemilikan tenant
  const existing = await prisma.subject.findUnique({
    where: {
      id_institutionId: {
        id: subjectId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Mata Pelajaran", subjectId);
  }

  // 5. Jika kode diubah, pastikan tidak duplikat dengan subjek lain
  if (sanitized.code && sanitized.code !== existing.code) {
    const conflict = await prisma.subject.findUnique({
      where: {
        institutionId_code: {
          institutionId: ctx.institutionId,
          code: sanitized.code,
        },
      },
    });

    if (conflict) {
      throw new DuplicateSubjectCodeError(sanitized.code);
    }
  }

  // 6. Eksekusi Update
  return prisma.subject.update({
    where: {
      id_institutionId: {
        id: subjectId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      ...(sanitized.name ? { name: sanitized.name } : {}),
      ...(sanitized.code !== undefined ? { code: sanitized.code || null } : {}),
      ...(sanitized.shortName !== undefined ? { shortName: sanitized.shortName || null } : {}),
      ...(sanitized.category ? { category: sanitized.category } : {}),
      ...(sanitized.isActive !== undefined ? { isActive: sanitized.isActive } : {}),
    },
  });
}

export async function listSubjects(
  ctx: TenantContext,
  rawQuery?: unknown
): Promise<{
  data: Subject[];
  items: Subject[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:view");

  // 2. Validasi filter
  const filter = validateSubjectFilter(rawQuery || {});

  // 3. Susun klausa where
  const whereClause: Prisma.SubjectWhereInput = {
    institutionId: ctx.institutionId,
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
    ...(filter.search
      ? {
          OR: [
            { name: { contains: filter.search, mode: "insensitive" } },
            { code: { contains: filter.search, mode: "insensitive" } },
            { shortName: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  const [data, total] = await Promise.all([
    prisma.subject.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { teacherAssignments: true },
        },
      },
    }),
    prisma.subject.count({ where: whereClause }),
  ]);

  return {
    data,
    items: data,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
  };
}

export async function getSubject(
  ctx: TenantContext,
  subjectId: string
): Promise<Subject> {
  requirePermission(ctx, "academic:view");

  const subject = await prisma.subject.findUnique({
    where: {
      id_institutionId: {
        id: subjectId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignments: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true, isActive: true } },
        },
      },
    },
  });

  if (!subject) {
    throw new ResourceNotFoundError("Mata Pelajaran", subjectId);
  }

  return subject;
}
