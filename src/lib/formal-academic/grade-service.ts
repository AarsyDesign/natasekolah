import { prisma } from "../prisma";
import type { AssessmentScore, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import {
  recordScoreInputSchema,
  recordBatchScoresInputSchema,
  scoreFilterSchema,
  RecordScoreInput,
  RecordBatchScoresInput,
  ScoreFilterQuery,
} from "../validation/formal-academic";
import {
  AssessmentNotFoundError,
  AssessmentOwnershipError,
  InvalidScoreRangeError,
  InvalidEnrollmentScopeError,
} from "./types";

export interface RosterStudentItem {
  studentId: string;
  enrollmentId: string;
  fullName: string;
  nis: string;
  nisn: string | null;
  score: number | null;
  note: string | null;
  updatedAt: Date | null;
}

/**
 * Mengambil roster siswa pada rombel assessment beserta nilai yang sudah tercatat.
 */
export async function getAssessmentRoster(
  ctx: TenantContext,
  assessmentId: string,
  txPrisma?: typeof prisma
): Promise<{
  assessment: {
    id: string;
    title: string;
    type: string;
    maxScore: number;
    subjectName: string;
    classroomName: string;
  };
  roster: RosterStudentItem[];
}> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const assessment = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id: assessmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: {
        include: {
          classroom: true,
          subject: true,
        },
      },
    },
  });

  if (!assessment) {
    throw new AssessmentNotFoundError(assessmentId);
  }

  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assessment.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda tidak memiliki hak untuk menginput nilai pada penugasan guru lain."
    );
  }

  // Ambil seluruh enrollment aktif di rombel dan tahun ajaran penugasan
  const enrollments = await db.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      classroomId: assessment.teacherAssignment.classroomId,
      academicYearId: assessment.teacherAssignment.academicYearId,
      status: "ENROLLED",
      student: {
        status: "ACTIVE",
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          nis: true,
          nisn: true,
        },
      },
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });

  // Ambil nilai yang sudah terekam
  const existingScores = await db.assessmentScore.findMany({
    where: {
      institutionId: ctx.institutionId,
      assessmentId,
    },
  });

  const scoreMap = new Map<string, AssessmentScore>();
  for (const s of existingScores) {
    scoreMap.set(s.studentId, s);
  }

  const roster: RosterStudentItem[] = enrollments.map((enr) => {
    const existing = scoreMap.get(enr.studentId);
    return {
      studentId: enr.studentId,
      enrollmentId: enr.id,
      fullName: enr.student.fullName,
      nis: enr.student.nis,
      nisn: enr.student.nisn,
      score: existing ? existing.score : null,
      note: existing ? existing.note : null,
      updatedAt: existing ? existing.updatedAt : null,
    };
  });

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      maxScore: assessment.maxScore,
      subjectName: assessment.teacherAssignment.subject.name,
      classroomName: assessment.teacherAssignment.classroom.name,
    },
    roster,
  };
}

/**
 * Mencatat atau memperbarui nilai seorang siswa pada assessment.
 */
export async function recordScore(
  ctx: TenantContext,
  rawInput: RecordScoreInput,
  txPrisma?: typeof prisma
): Promise<AssessmentScore> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = recordScoreInputSchema.parse(rawInput);

  // 1. Validasi keberadaan Assessment
  const assessment = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id: validated.assessmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
    },
  });

  if (!assessment) {
    throw new AssessmentNotFoundError(validated.assessmentId);
  }

  // 2. Resource scope guard
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assessment.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda hanya diizinkan menginput nilai untuk penugasan mengajar milik Anda."
    );
  }

  // 3. Validasi rentang nilai: 0 <= score <= maxScore
  if (validated.score < 0 || validated.score > assessment.maxScore) {
    throw new InvalidScoreRangeError(validated.score, assessment.maxScore);
  }

  // 4. Validasi pendaftaran siswa (Enrollment Scope)
  const enrollment = await db.enrollment.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: validated.studentId,
      classroomId: assessment.teacherAssignment.classroomId,
      academicYearId: assessment.teacherAssignment.academicYearId,
      status: "ENROLLED",
    },
    include: {
      student: { select: { fullName: true } },
    },
  });

  if (!enrollment) {
    throw new InvalidEnrollmentScopeError(
      validated.studentId,
      "Siswa tidak terdaftar di rombel atau tahun ajaran penilaian ini."
    );
  }

  // 5. Upsert AssessmentScore
  return db.assessmentScore.upsert({
    where: {
      assessmentId_studentId: {
        assessmentId: validated.assessmentId,
        studentId: validated.studentId,
      },
    },
    update: {
      score: validated.score,
      note: validated.note ?? null,
      enrollmentId: enrollment.id,
    },
    create: {
      institutionId: ctx.institutionId,
      assessmentId: validated.assessmentId,
      studentId: validated.studentId,
      enrollmentId: enrollment.id,
      score: validated.score,
      note: validated.note ?? null,
    },
  });
}

/**
 * Mencatat nilai massal (batch score entry) dalam satu transaksi atomis.
 */
export async function recordBatchScores(
  ctx: TenantContext,
  rawInput: RecordBatchScoresInput,
  txPrisma?: typeof prisma
): Promise<{ updatedCount: number; assessmentId: string }> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = recordBatchScoresInputSchema.parse(rawInput);

  // 1. Validasi Assessment
  const assessment = await db.assessment.findUnique({
    where: {
      id_institutionId: {
        id: validated.assessmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
    },
  });

  if (!assessment) {
    throw new AssessmentNotFoundError(validated.assessmentId);
  }

  // 2. Resource scope guard
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assessment.teacherAssignment.teacherId !== ctx.userId) {
    throw new AssessmentOwnershipError(
      "Anda hanya diizinkan menginput nilai untuk penugasan mengajar milik Anda."
    );
  }

  // 3. Validasi awal seluruh score
  for (const item of validated.scores) {
    if (item.score < 0 || item.score > assessment.maxScore) {
      throw new InvalidScoreRangeError(item.score, assessment.maxScore);
    }
  }

  // 4. Verifikasi seluruh siswa dalam rombel & tahun ajaran target
  const studentIds = validated.scores.map((s) => s.studentId);
  const enrollments = await db.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      studentId: { in: studentIds },
      classroomId: assessment.teacherAssignment.classroomId,
      academicYearId: assessment.teacherAssignment.academicYearId,
      status: "ENROLLED",
    },
    include: {
      student: { select: { id: true, fullName: true } },
    },
  });

  const enrollmentMap = new Map<string, string>();
  for (const enr of enrollments) {
    enrollmentMap.set(enr.studentId, enr.id);
  }

  for (const item of validated.scores) {
    if (!enrollmentMap.has(item.studentId)) {
      throw new InvalidEnrollmentScopeError(
        item.studentId,
        "Siswa tidak terdaftar di rombel atau tahun ajaran penilaian ini."
      );
    }
  }

  // 5. Eksekusi batch upsert
  const runTransaction = async (tx: any) => {
    let count = 0;
    for (const item of validated.scores) {
      const enrollmentId = enrollmentMap.get(item.studentId)!;
      await tx.assessmentScore.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: validated.assessmentId,
            studentId: item.studentId,
          },
        },
        update: {
          score: item.score,
          note: item.note ?? null,
          enrollmentId,
        },
        create: {
          institutionId: ctx.institutionId,
          assessmentId: validated.assessmentId,
          studentId: item.studentId,
          enrollmentId,
          score: item.score,
          note: item.note ?? null,
        },
      });
      count++;
    }
    return count;
  };

  const updatedCount =
    typeof (db as any).$transaction === "function" && !txPrisma
      ? await (db as any).$transaction(async (tx: any) => runTransaction(tx))
      : await runTransaction(db);

  return {
    updatedCount,
    assessmentId: validated.assessmentId,
  };
}

/**
 * Mengambil daftar nilai dengan filter.
 */
export async function listScores(
  ctx: TenantContext,
  query?: ScoreFilterQuery,
  txPrisma?: typeof prisma
): Promise<AssessmentScore[]> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = scoreFilterSchema.parse(query || {});

  const where: Prisma.AssessmentScoreWhereInput = {
    institutionId: ctx.institutionId,
  };

  if (validated.assessmentId) where.assessmentId = validated.assessmentId;
  if (validated.studentId) where.studentId = validated.studentId;
  if (validated.enrollmentId) where.enrollmentId = validated.enrollmentId;

  return db.assessmentScore.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      assessment: { select: { id: true, title: true, type: true, maxScore: true } },
    },
  });
}
