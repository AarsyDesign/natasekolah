import { prisma } from "../prisma";
import type { TeacherAssignment, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateTeacherAssignmentInput,
  validateUpdateTeacherAssignmentInput,
  validateTeacherAssignmentFilter,
} from "../validation/teaching";
import {
  DuplicateAssignmentError,
  TeacherAssignmentAccessDeniedError,
  InvalidTeacherRoleError,
  ResourceNotFoundError,
} from "./types";
import { AcademicYearMismatchError } from "../academic/types";

/**
 * Layanan Domain Penugasan Mengajar (Teacher Teaching Assignment Engine) NataSekolah.
 *
 * PRINSIP & INVARIANT:
 * 1. Guru, Mata Pelajaran, Rombel, dan Tahun Ajaran WAJIB berada pada institusi yang sama.
 * 2. Rombel WAJIB berada pada Tahun Ajaran yang sama dengan target penugasan.
 * 3. Tidak boleh ada duplikasi penugasan: (teacherId + subjectId + classroomId + academicYearId) unik.
 * 4. Guru (role TEACHER) hanya boleh melihat penugasan miliknya sendiri tanpa izin administratif.
 *    Admin / Principal dapat melihat dan mengelola seluruh penugasan lembaga.
 */

export async function createTeacherAssignment(
  ctx: TenantContext,
  rawInput: unknown
): Promise<TeacherAssignment> {
  // 1. RBAC Guard: Hanya peran administratif dengan academic:manage yang boleh menugaskan
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateCreateTeacherAssignmentInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Invariant: Verifikasi Guru ada, milik tenant, dan memiliki peran TEACHER
  const user = await prisma.user.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.teacherId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new ResourceNotFoundError("Guru", sanitized.teacherId);
  }

  let roles: string[] = [];
  try {
    roles = JSON.parse(user.roles || "[]");
  } catch {
    roles = [];
  }

  if (!roles.includes("TEACHER")) {
    throw new InvalidTeacherRoleError(sanitized.teacherId);
  }

  // 5. Invariant: Verifikasi Mata Pelajaran ada dan milik tenant
  const subject = await prisma.subject.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.subjectId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!subject) {
    throw new ResourceNotFoundError("Mata Pelajaran", sanitized.subjectId);
  }

  // 6. Invariant: Verifikasi Tahun Ajaran ada dan milik tenant
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

  // 7. Invariant: Verifikasi Rombel ada dan milik tenant
  const classroom = await prisma.classroom.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.classroomId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!classroom) {
    throw new ResourceNotFoundError("Rombel", sanitized.classroomId);
  }

  // 8. Invariant: Rombel WAJIB terdaftar pada Tahun Ajaran yang sama
  if (classroom.academicYearId !== sanitized.academicYearId) {
    throw new AcademicYearMismatchError(
      classroom.id,
      classroom.academicYearId,
      sanitized.academicYearId
    );
  }

  // 9. Invariant: Cek duplikasi assignment
  const existing = await prisma.teacherAssignment.findUnique({
    where: {
      teacherId_subjectId_classroomId_academicYearId: {
        teacherId: sanitized.teacherId,
        subjectId: sanitized.subjectId,
        classroomId: sanitized.classroomId,
        academicYearId: sanitized.academicYearId,
      },
    },
  });

  if (existing) {
    throw new DuplicateAssignmentError(
      user.name,
      subject.name,
      classroom.name,
      academicYear.name
    );
  }

  // 10. Eksekusi Simpan dengan Compound Foreign Keys terverifikasi
  return prisma.teacherAssignment.create({
    data: {
      teacherId: sanitized.teacherId,
      subjectId: sanitized.subjectId,
      classroomId: sanitized.classroomId,
      academicYearId: sanitized.academicYearId,
      institutionId: ctx.institutionId,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      subject: true,
      classroom: true,
      academicYear: true,
    },
  });
}

export async function updateTeacherAssignment(
  ctx: TenantContext,
  assignmentId: string,
  rawInput: unknown
): Promise<TeacherAssignment> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateUpdateTeacherAssignmentInput(rawInput);

  // 3. Verifikasi kepemilikan tenant
  const existing = await prisma.teacherAssignment.findUnique({
    where: {
      id_institutionId: {
        id: assignmentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Penugasan Mengajar", assignmentId);
  }

  // 4. Jika rombel diubah, pastikan rombel baru berada pada tahun ajaran yang sama
  if (validated.classroomId && validated.classroomId !== existing.classroomId) {
    const newClassroom = await prisma.classroom.findUnique({
      where: {
        id_institutionId: {
          id: validated.classroomId,
          institutionId: ctx.institutionId,
        },
      },
    });

    if (!newClassroom) {
      throw new ResourceNotFoundError("Rombel", validated.classroomId);
    }

    if (newClassroom.academicYearId !== existing.academicYearId) {
      throw new AcademicYearMismatchError(
        newClassroom.id,
        newClassroom.academicYearId,
        existing.academicYearId
      );
    }
  }

  // 5. Eksekusi Update
  return prisma.teacherAssignment.update({
    where: {
      id_institutionId: {
        id: assignmentId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      ...(validated.subjectId ? { subjectId: validated.subjectId } : {}),
      ...(validated.classroomId ? { classroomId: validated.classroomId } : {}),
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      subject: true,
      classroom: true,
      academicYear: true,
    },
  });
}

export async function deleteTeacherAssignment(
  ctx: TenantContext,
  assignmentId: string
): Promise<TeacherAssignment> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Verifikasi kepemilikan tenant
  const existing = await prisma.teacherAssignment.findUnique({
    where: {
      id_institutionId: {
        id: assignmentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Penugasan Mengajar", assignmentId);
  }

  // 3. Eksekusi Hapus
  return prisma.teacherAssignment.delete({
    where: {
      id_institutionId: {
        id: assignmentId,
        institutionId: ctx.institutionId,
      },
    },
  });
}

export async function listTeacherAssignments(
  ctx: TenantContext,
  rawQuery?: unknown
) {
  // 1. Validasi filter
  const filter = validateTeacherAssignmentFilter(rawQuery || {});

  // 2. Resource Scope Enforcement:
  // Jika pengguna adalah TEACHER murni (tanpa izin academic:manage)
  const isManager = hasPermission(ctx, "academic:manage");
  let targetTeacherId = filter.teacherId;

  if (!isManager) {
    // Teacher hanya boleh melihat assignment miliknya sendiri
    if (filter.teacherId && filter.teacherId !== ctx.userId) {
      throw new TeacherAssignmentAccessDeniedError("Guru tidak diizinkan melihat penugasan mengajar rekan guru lain.");
    }
    targetTeacherId = ctx.userId;
  }

  // 3. Susun klausa where
  const whereClause: Prisma.TeacherAssignmentWhereInput = {
    institutionId: ctx.institutionId,
    ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
    ...(targetTeacherId ? { teacherId: targetTeacherId } : {}),
    ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
    ...(filter.classroomId ? { classroomId: filter.classroomId } : {}),
  };

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  const [data, total] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        subject: true,
        classroom: true,
        academicYear: true,
      },
    }),
    prisma.teacherAssignment.count({ where: whereClause }),
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

export async function getTeacherAssignments(
  ctx: TenantContext,
  teacherId: string
) {
  // Resource Scope Enforcement
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && teacherId !== ctx.userId) {
    throw new TeacherAssignmentAccessDeniedError();
  }

  return prisma.teacherAssignment.findMany({
    where: {
      institutionId: ctx.institutionId,
      teacherId,
    },
    include: {
      subject: true,
      classroom: true,
      academicYear: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Penjaga otorisasi penugasan untuk operasi pengajaran harian (presensi/nilai).
 */
export async function assertTeacherAssignmentAccess(
  ctx: TenantContext,
  assignmentId: string,
  txPrisma?: typeof prisma
): Promise<TeacherAssignment> {
  const db = txPrisma || prisma;
  const assignment = await db.teacherAssignment.findUnique({
    where: {
      id_institutionId: {
        id: assignmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      subject: true,
      classroom: true,
      academicYear: true,
    },
  });

  if (!assignment) {
    throw new ResourceNotFoundError("Penugasan Mengajar", assignmentId);
  }

  // Jika bukan manajer akademik dan bukan guru yang ditugaskan, tolak keras
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assignment.teacherId !== ctx.userId) {
    throw new TeacherAssignmentAccessDeniedError("Anda tidak memiliki akses penugasan mengajar ini.");
  }

  return assignment;
}
