import { prisma } from "../prisma";
import type { Enrollment } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateEnrollmentInput,
  validateUpdateEnrollmentInput,
} from "../validation/academic";
import {
  DuplicateEnrollmentError,
  AcademicYearMismatchError,
  ResourceNotFoundError,
} from "./types";

/**
 * Layanan Domain Penempatan Siswa (Enrollment Engine) NataSekolah.
 *
 * PRINSIP SAKRAL:
 * 1. Siswa TIDAK PERNAH menyimpan classroomId langsung pada model Student.
 * 2. Relasi kelas dan riwayat akademik tersimpan abadi via entitas Enrollment.
 * 3. Satu siswa hanya boleh memiliki 1 rombel per tahun ajaran.
 * 4. Rombel, Tahun Ajaran, dan Siswa WAJIB berada pada institusi yang sama (Integritas Tenant).
 * 5. Tahun ajaran pada Rombel WAJIB cocok dengan Tahun ajaran pada Enrollment.
 */

export async function enrollStudent(
  ctx: TenantContext,
  rawInput: unknown
): Promise<Enrollment> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateCreateEnrollmentInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Invariant: Verifikasi Siswa ada dan milik institusi sesi
  const student = await prisma.student.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Siswa", sanitized.studentId);
  }

  // 5. Invariant: Verifikasi Tahun Ajaran ada dan milik institusi sesi
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

  // 6. Invariant: Verifikasi Rombel ada dan milik institusi sesi
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

  // 7. Invariant: Rombel WAJIB berada pada Tahun Ajaran yang sama dengan target enrollment
  if (classroom.academicYearId !== sanitized.academicYearId) {
    throw new AcademicYearMismatchError(
      classroom.id,
      classroom.academicYearId,
      sanitized.academicYearId
    );
  }

  // 8. Invariant: Cek duplikasi enrollment siswa pada tahun ajaran ini
  const existingEnrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_academicYearId: {
        studentId: sanitized.studentId,
        academicYearId: sanitized.academicYearId,
      },
    },
  });

  if (existingEnrollment) {
    throw new DuplicateEnrollmentError(sanitized.studentId, sanitized.academicYearId);
  }

  // 9. Simpan Enrollment dengan Compound Foreign Keys terverifikasi
  return prisma.enrollment.create({
    data: {
      studentId: sanitized.studentId,
      academicYearId: sanitized.academicYearId,
      classroomId: sanitized.classroomId,
      status: sanitized.status || "ENROLLED",
      enrolledAt: sanitized.enrolledAt || new Date(),
      institutionId: ctx.institutionId,
    },
    include: {
      student: true,
      academicYear: true,
      classroom: true,
    },
  });
}

export async function updateEnrollment(
  ctx: TenantContext,
  enrollmentId: string,
  rawInput: unknown
): Promise<Enrollment> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation
  const validated = validateUpdateEnrollmentInput(rawInput);

  // 3. Verifikasi kepemilikan tenant
  const existing = await prisma.enrollment.findUnique({
    where: {
      id_institutionId: {
        id: enrollmentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!existing) {
    throw new ResourceNotFoundError("Enrollment", enrollmentId);
  }

  // 4. Jika rombel dipindahkan, pastikan rombel baru milik tenant dan tahun ajaran yang sama
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

  // 5. Eksekusi update
  return prisma.enrollment.update({
    where: {
      id_institutionId: {
        id: enrollmentId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      ...(validated.classroomId ? { classroomId: validated.classroomId } : {}),
      ...(validated.status ? { status: validated.status } : {}),
      ...(validated.endedAt ? { endedAt: validated.endedAt } : {}),
    },
    include: {
      student: true,
      academicYear: true,
      classroom: true,
    },
  });
}

export async function getStudentEnrollments(
  ctx: TenantContext,
  studentId: string
): Promise<Enrollment[]> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:view");

  // 2. Verifikasi siswa ada di tenant aktif
  const student = await prisma.student.findUnique({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Siswa", studentId);
  }

  // 3. Ambil seluruh histori penempatan kelas (Sacred History)
  return prisma.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      studentId,
    },
    include: {
      academicYear: true,
      classroom: true,
    },
    orderBy: {
      enrolledAt: "desc",
    },
  });
}

export async function getCurrentEnrollment(
  ctx: TenantContext,
  studentId: string
): Promise<Enrollment | null> {
  requirePermission(ctx, "student:view");

  // 1. Cari tahun ajaran aktif institusi
  const activeYear = await prisma.academicYear.findFirst({
    where: {
      institutionId: ctx.institutionId,
      isActive: true,
    },
  });

  if (!activeYear) {
    return null;
  }

  // 2. Cari enrollment siswa pada tahun ajaran aktif
  return prisma.enrollment.findUnique({
    where: {
      studentId_academicYearId: {
        studentId,
        academicYearId: activeYear.id,
      },
    },
    include: {
      academicYear: true,
      classroom: true,
    },
  });
}
