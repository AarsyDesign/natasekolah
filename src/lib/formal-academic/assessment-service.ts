import { prisma } from "../prisma";
import type { Assessment, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import {
  createAssessmentInputSchema,
  updateAssessmentInputSchema,
  assessmentFilterSchema,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  AssessmentFilterQuery,
} from "../validation/formal-academic";
import {
  AssessmentNotFoundError,
  AssessmentOwnershipError,
  FormalAcademicError,
} from "./types";

export type AssessmentWithDetails = Assessment & {
  teacherAssignment: {
    id: string;
    teacherId: string;
    subject: { id: string; name: string; code: string | null };
    classroom: { id: string; name: string };
    academicYear: { id: string; name: string };
    teacher: { id: string; name: string; email: string };
  };
  _count?: {
    scores: number;
  };
};

/**
 * Membuat rencana penilaian / assessment akademik.
 */
export async function createAssessment(
  ctx: TenantContext,
  rawInput: CreateAssessmentInput,
  txPrisma?: typeof prisma
): Promise<Assessment> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = createAssessmentInputSchema.parse(rawInput);

  // 1. Verifikasi Penugasan Mengajar ada pada tenant
  const assignment = await db.teacherAssignment.findUnique({
    where: {
      id_institutionId: {
        id: validated.teacherAssignmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      subject: true,
      classroom: true,
      academicYear: true,
    },
  });

  if (!assignment) {
    throw new FormalAcademicError(
      `Penugasan mengajar dengan ID [${validated.teacherAssignmentId}] tidak ditemukan.`,
      "ASSIGNMENT_NOT_FOUND",
      404
    );
  }

  // 2. Resource Scope Guard: Guru hanya boleh membuat assessment untuk penugasan miliknya
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Guru hanya diizinkan membuat penilaian untuk penugasan mengajar miliknya sendiri."
    );
  }

  const assessmentDate = validated.assessmentDate
    ? new Date(validated.assessmentDate)
    : new Date();

  return db.assessment.create({
    data: {
      institutionId: ctx.institutionId,
      teacherAssignmentId: validated.teacherAssignmentId,
      title: validated.title,
      type: validated.type,
      assessmentDate,
      maxScore: validated.maxScore ?? 100,
      isPublished: validated.isPublished ?? false,
    },
  });
}

/**
 * Memperbarui penilaian akademik.
 */
export async function updateAssessment(
  ctx: TenantContext,
  id: string,
  rawInput: UpdateAssessmentInput,
  txPrisma?: typeof prisma
): Promise<Assessment> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = updateAssessmentInputSchema.parse(rawInput);

  const existing = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
    },
  });

  if (!existing) {
    throw new AssessmentNotFoundError(id);
  }

  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && existing.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda tidak memiliki hak untuk mengubah penilaian ini."
    );
  }

  const data: Prisma.AssessmentUpdateInput = {};
  if (validated.title !== undefined) data.title = validated.title;
  if (validated.type !== undefined) data.type = validated.type;
  if (validated.maxScore !== undefined) data.maxScore = validated.maxScore;
  if (validated.isPublished !== undefined) data.isPublished = validated.isPublished;
  if (validated.assessmentDate !== undefined) {
    data.assessmentDate = new Date(validated.assessmentDate);
  }

  return db.assessment.update({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    data,
  });
}

/**
 * Menghapus penilaian akademik.
 */
export async function deleteAssessment(
  ctx: TenantContext,
  id: string,
  txPrisma?: typeof prisma
): Promise<Assessment> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const existing = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
    },
  });

  if (!existing) {
    throw new AssessmentNotFoundError(id);
  }

  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && existing.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda tidak memiliki hak untuk menghapus penilaian ini."
    );
  }

  return db.assessment.delete({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
  });
}

/**
 * Mengambil detail penilaian beserta relasi kuartet akademiknya.
 */
export async function getAssessment(
  ctx: TenantContext,
  id: string,
  txPrisma?: typeof prisma
): Promise<AssessmentWithDetails> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const assessment = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: { scores: true },
      },
    },
  });

  if (!assessment) {
    throw new AssessmentNotFoundError(id);
  }

  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assessment.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda tidak memiliki akses ke penilaian pada penugasan guru lain."
    );
  }

  return assessment as AssessmentWithDetails;
}

/**
 * Mengambil daftar penilaian dengan filter dan tenant isolation.
 */
export async function listAssessments(
  ctx: TenantContext,
  query?: AssessmentFilterQuery,
  txPrisma?: typeof prisma
): Promise<{ items: AssessmentWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = assessmentFilterSchema.parse(query || {});
  const page = validated.page ?? 1;
  const limit = validated.limit ?? 50;
  const skip = (page - 1) * limit;

  const isManager = hasPermission(ctx, "academic:manage");

  const where: Prisma.AssessmentWhereInput = {
    institutionId: ctx.institutionId,
  };

  // Scope guru: Hanya assignment miliknya jika bukan manager
  if (!isManager) {
    where.teacherAssignment = {
      teacherId: ctx.userId,
    };
  }

  if (validated.teacherAssignmentId) {
    where.teacherAssignmentId = validated.teacherAssignmentId;
  }

  if (validated.type) {
    where.type = validated.type;
  }

  if (validated.classroomId) {
    where.teacherAssignment = {
      ...(where.teacherAssignment as Prisma.TeacherAssignmentWhereInput),
      classroomId: validated.classroomId,
    };
  }

  if (validated.subjectId) {
    where.teacherAssignment = {
      ...(where.teacherAssignment as Prisma.TeacherAssignmentWhereInput),
      subjectId: validated.subjectId,
    };
  }

  if (validated.academicYearId) {
    where.teacherAssignment = {
      ...(where.teacherAssignment as Prisma.TeacherAssignmentWhereInput),
      academicYearId: validated.academicYearId,
    };
  }

  if (validated.search) {
    where.title = {
      contains: validated.search,
      mode: "insensitive",
    };
  }

  const [total, items] = await Promise.all([
    db.assessment.count({ where }),
    db.assessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { assessmentDate: "desc" },
      include: {
        teacherAssignment: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            classroom: { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: { scores: true },
        },
      },
    }),
  ]);

  return {
    items: items as AssessmentWithDetails[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
