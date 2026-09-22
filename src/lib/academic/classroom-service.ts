import { prisma } from "../prisma";
import type { Classroom } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateClassroomInput,
  validateUpdateClassroomInput,
} from "../validation/academic";
import { ResourceNotFoundError } from "./types";

/**
 * Layanan Domain Rombongan Belajar (Classroom) NataSekolah.
 * Seluruh operasi rombel terikat ketat pada institusi dan tahun ajaran resmi.
 */

export async function createClassroom(
  ctx: TenantContext,
  rawInput: unknown
): Promise<Classroom> {
  // 1. RBAC Guard
  requirePermission(ctx, "classroom:manage");

  // 2. Zod Validation
  const validated = validateCreateClassroomInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Invariant: Pastikan Tahun Ajaran ada dan dimiliki institusi sesi
  const academicYear = await prisma.academicYear.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.academicYearId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!academicYear) {
    throw new ResourceNotFoundError("Tahun Ajaran", sanitized.academicYearId);
  }

  // 5. Simpan Rombel
  return prisma.classroom.create({
    data: {
      name: sanitized.name,
      gradeLevel: sanitized.gradeLevel || null,
      capacity: sanitized.capacity || null,
      academicYearId: sanitized.academicYearId,
      institutionId: ctx.institutionId,
    },
  });
}

export async function listClassrooms(
  ctx: TenantContext,
  academicYearId?: string
): Promise<Classroom[]> {
  // 1. RBAC Guard
  requirePermission(ctx, "classroom:view");

  // 2. Query terisolasi tenant
  return prisma.classroom.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(academicYearId ? { academicYearId } : {}),
    },
    include: {
      academicYear: true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getClassroom(
  ctx: TenantContext,
  classroomId: string
): Promise<Classroom> {
  requirePermission(ctx, "classroom:view");

  const classroom = await prisma.classroom.findUnique({
    where: {
      id_institutionId: {
        id: classroomId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      academicYear: true,
      enrollments: {
        include: {
          student: true,
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  if (!classroom) {
    throw new ResourceNotFoundError("Rombel", classroomId);
  }

  return classroom;
}
