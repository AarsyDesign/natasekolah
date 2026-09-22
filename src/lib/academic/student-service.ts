import { prisma } from "../prisma";
import type { Student, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateStudentInput,
  validateUpdateStudentInput,
  validateArchiveStudentInput,
  validateStudentFilter,
} from "../validation/student";
import { DuplicateNisError, ResourceNotFoundError } from "./types";

/**
 * Layanan Domain Kesiswaan (Buku Induk) NataSekolah.
 * Menerapkan rantai otorisasi: Sesi -> Tenant -> RBAC -> Validasi Zod -> Domain Invariants -> Prisma.
 */

export async function createStudent(
  ctx: TenantContext,
  rawInput: unknown
): Promise<Student> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:create");

  // 2. Zod Validation
  const validated = validateCreateStudentInput(rawInput);

  // 3. Sanitasi Anti-Tampering (membuang institutionId/role jika disusupi klien)
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Domain Invariant: Cek keunikan NIS dalam institusi yang sama
  const existingNis = await prisma.student.findUnique({
    where: {
      institutionId_nis: {
        institutionId: ctx.institutionId,
        nis: sanitized.nis,
      },
    },
  });

  if (existingNis) {
    throw new DuplicateNisError(sanitized.nis);
  }

  // 5. Eksekusi Prisma
  return prisma.student.create({
    data: {
      fullName: sanitized.fullName,
      nis: sanitized.nis,
      nisn: sanitized.nisn || null,
      nik: sanitized.nik || null,
      nickname: sanitized.nickname || null,
      gender: sanitized.gender,
      birthPlace: sanitized.birthPlace || null,
      birthDate: sanitized.birthDate || null,
      religion: sanitized.religion || null,
      address: sanitized.address || null,
      phone: sanitized.phone || null,
      email: sanitized.email || null,
      status: sanitized.status || "ACTIVE",
      institutionId: ctx.institutionId, // Mutlak dari sesi terautentikasi
    },
  });
}

export async function updateStudent(
  ctx: TenantContext,
  studentId: string,
  rawInput: unknown
): Promise<Student> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:edit");

  // 2. Zod Validation
  const validated = validateUpdateStudentInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi keberadaan dan kepemilikan tenant
  const existing = await prisma.student.findUnique({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Siswa", studentId);
  }

  // 5. Jika NIS diubah, pastikan tidak konflik dengan siswa lain di institusi yang sama
  if (sanitized.nis && sanitized.nis !== existing.nis) {
    const conflict = await prisma.student.findUnique({
      where: {
        institutionId_nis: {
          institutionId: ctx.institutionId,
          nis: sanitized.nis,
        },
      },
    });

    if (conflict) {
      throw new DuplicateNisError(sanitized.nis);
    }
  }

  // 6. Eksekusi Update
  return prisma.student.update({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      ...(sanitized.fullName ? { fullName: sanitized.fullName } : {}),
      ...(sanitized.nis ? { nis: sanitized.nis } : {}),
      ...(sanitized.nisn !== undefined ? { nisn: sanitized.nisn || null } : {}),
      ...(sanitized.nik !== undefined ? { nik: sanitized.nik || null } : {}),
      ...(sanitized.nickname !== undefined ? { nickname: sanitized.nickname || null } : {}),
      ...(sanitized.gender ? { gender: sanitized.gender } : {}),
      ...(sanitized.birthPlace !== undefined ? { birthPlace: sanitized.birthPlace || null } : {}),
      ...(sanitized.birthDate !== undefined ? { birthDate: sanitized.birthDate || null } : {}),
      ...(sanitized.religion !== undefined ? { religion: sanitized.religion || null } : {}),
      ...(sanitized.address !== undefined ? { address: sanitized.address || null } : {}),
      ...(sanitized.phone !== undefined ? { phone: sanitized.phone || null } : {}),
      ...(sanitized.email !== undefined ? { email: sanitized.email || null } : {}),
      ...(sanitized.status ? { status: sanitized.status } : {}),
    },
  });
}

export async function getStudent(
  ctx: TenantContext,
  studentId: string
) {
  // 1. RBAC Guard
  requirePermission(ctx, "student:view");

  // 2. Query terisolasi tenant dengan relasi histori enrollment
  const student = await prisma.student.findUnique({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      enrollments: {
        include: {
          academicYear: true,
          classroom: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      guardians: {
        include: {
          guardian: true,
        },
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Siswa", studentId);
  }

  return student;
}

export async function listStudents(
  ctx: TenantContext,
  rawQuery?: unknown
): Promise<{
  data: Student[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:view");

  // 2. Validasi parameter query/filter
  const filter = validateStudentFilter(rawQuery || {});

  // 3. Susun klausa where terisolasi tenant
  const whereClause: Prisma.StudentWhereInput = {
    institutionId: ctx.institutionId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search
      ? {
          OR: [
            { fullName: { contains: filter.search, mode: "insensitive" } },
            { nis: { contains: filter.search, mode: "insensitive" } },
            { nisn: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  // 4. Eksekusi query paginasi paralel
  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { fullName: "asc" },
      include: {
        enrollments: {
          include: {
            academicYear: true,
            classroom: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1, // Current active enrollment
        },
      },
    }),
    prisma.student.count({ where: whereClause }),
  ]);

  return {
    data,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
  };
}

export async function archiveStudent(
  ctx: TenantContext,
  studentId: string,
  rawInput: unknown
): Promise<Student> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:archive");

  // 2. Zod Validation
  const validated = validateArchiveStudentInput(rawInput);

  // 3. Verifikasi kepemilikan tenant
  const existing = await prisma.student.findUnique({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Siswa", studentId);
  }

  // 4. Soft Archive: status diubah, rekaman enrollment masa lalu tetap abadi
  return prisma.student.update({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: validated.status,
    },
  });
}
