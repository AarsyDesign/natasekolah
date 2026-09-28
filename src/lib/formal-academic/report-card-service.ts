import { prisma } from "../prisma";
import type { ReportCard, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import {
  generateReportCardInputSchema,
  publishReportCardInputSchema,
  reportCardFilterSchema,
  GenerateReportCardInput,
  PublishReportCardInput,
  ReportCardFilterQuery,
} from "../validation/formal-academic";
import {
  ReportCardNotFoundError,
  ReportCardAlreadyPublishedError,
  FormalAcademicError,
} from "./types";
import { calculateStudentSubjectGrades } from "./calculation-service";
import { resolveStudentGuardianRecipient } from "../notification/guardian-resolver";
import { notifyReportCardPublished } from "../notification/events";

export interface FrozenReportCardSnapshot {
  frozenAt: string;
  publishedBy: string;
  semester: string;
  student: {
    id: string;
    fullName: string;
    nis: string;
    nisn: string | null;
    gender: string;
  };
  classroom: {
    id: string;
    name: string;
  };
  academicYear: {
    id: string;
    name: string;
  };
  notes: string | null;
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    finalScore: number;
    letterGrade: string | null;
    comments: string | null;
  }>;
  attendance: {
    present: number;
    sick: number;
    excused: number;
    absent: number;
  };
}

export type ReportCardWithDetails = ReportCard & {
  student: {
    id: string;
    fullName: string;
    nis: string;
    nisn: string | null;
    gender: string;
  };
  classroom: {
    id: string;
    name: string;
  };
  academicYear: {
    id: string;
    name: string;
  };
  publishedBy?: {
    id: string;
    name: string;
  } | null;
  subjects: Array<{
    id: string;
    subjectId: string;
    finalScore: number;
    letterGrade: string | null;
    comments: string | null;
    subject: {
      id: string;
      name: string;
      code: string | null;
    };
  }>;
  parsedSnapshot?: FrozenReportCardSnapshot | null;
};

/**
 * Membuat atau memperbarui Draft Raport Akademik.
 * Menghitung nilai berjalan dari seluruh assessment yang tersedia.
 */
export async function generateDraftReportCard(
  ctx: TenantContext,
  rawInput: GenerateReportCardInput,
  txPrisma?: typeof prisma
): Promise<ReportCardWithDetails> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = generateReportCardInputSchema.parse(rawInput);

  // 1. Verifikasi Enrollment aktif di tenant
  const enrollment = await db.enrollment.findFirst({
    where: {
      institutionId: ctx.institutionId,
      studentId: validated.studentId,
      classroomId: validated.classroomId,
      academicYearId: validated.academicYearId,
    },
    include: {
      student: true,
      classroom: true,
      academicYear: true,
    },
  });

  if (!enrollment) {
    throw new FormalAcademicError(
      "Data pendaftaran siswa (enrollment) pada rombel dan tahun ajaran tersebut tidak ditemukan.",
      "ENROLLMENT_NOT_FOUND",
      404
    );
  }

  // 2. Periksa apakah raport untuk semester ini sudah pernah diterbitkan (PUBLISHED)
  const existingReport = await db.reportCard.findUnique({
    where: {
      enrollmentId_semester: {
        enrollmentId: enrollment.id,
        semester: validated.semester,
      },
    },
  });

  if (existingReport && existingReport.status === "PUBLISHED") {
    throw new ReportCardAlreadyPublishedError(existingReport.id);
  }

  // 3. Hitung hasil akademik dari seluruh mata pelajaran di rombel
  const subjectGrades = await calculateStudentSubjectGrades(
    ctx,
    {
      studentId: validated.studentId,
      enrollmentId: enrollment.id,
      classroomId: validated.classroomId,
      academicYearId: validated.academicYearId,
    },
    undefined,
    db
  );

  // 4. Simpan atau perbarui ReportCard (DRAFT)
  const reportCard = await db.reportCard.upsert({
    where: {
      enrollmentId_semester: {
        enrollmentId: enrollment.id,
        semester: validated.semester,
      },
    },
    update: {
      status: "DRAFT",
      notes: validated.notes ?? null,
      updatedAt: new Date(),
    },
    create: {
      institutionId: ctx.institutionId,
      studentId: validated.studentId,
      enrollmentId: enrollment.id,
      academicYearId: validated.academicYearId,
      classroomId: validated.classroomId,
      semester: validated.semester,
      status: "DRAFT",
      notes: validated.notes ?? null,
    },
  });

  // 5. Simpan nilai per mata pelajaran (ReportCardSubject)
  for (const grade of subjectGrades) {
    await db.reportCardSubject.upsert({
      where: {
        reportCardId_subjectId: {
          reportCardId: reportCard.id,
          subjectId: grade.subjectId,
        },
      },
      update: {
        finalScore: grade.finalScore,
        letterGrade: grade.letterGrade,
      },
      create: {
        institutionId: ctx.institutionId,
        reportCardId: reportCard.id,
        subjectId: grade.subjectId,
        finalScore: grade.finalScore,
        letterGrade: grade.letterGrade,
      },
    });
  }

  return getReportCard(ctx, reportCard.id, db);
}

/**
 * Menerbitkan dan membekukan (FREEZE) raport siswa.
 * Setelah PUBLISHED, raport menjadi historical snapshot abadi.
 */
export async function publishReportCard(
  ctx: TenantContext,
  rawInput: PublishReportCardInput,
  txPrisma?: typeof prisma
): Promise<ReportCardWithDetails> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "report:manage");

  const validated = publishReportCardInputSchema.parse(rawInput);

  // 1. Ambil ReportCard
  const reportCard = await db.reportCard.findUnique({
    where: {
      id_institutionId: {
        id: validated.reportCardId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      student: true,
      classroom: true,
      academicYear: true,
      subjects: {
        include: {
          subject: true,
        },
      },
    },
  });

  if (!reportCard) {
    throw new ReportCardNotFoundError(validated.reportCardId);
  }

  // 2. Invariant: Raport yang sudah PUBLISHED dilarang di-publish ulang
  if (reportCard.status === "PUBLISHED") {
    throw new ReportCardAlreadyPublishedError(reportCard.id);
  }

  // 3. Kumpulkan ringkasan absensi siswa pada enrollment ini
  const attendanceRecords = await db.attendanceRecord.findMany({
    where: {
      institutionId: ctx.institutionId,
      enrollmentId: reportCard.enrollmentId,
    },
    select: {
      status: true,
    },
  });

  const attendanceCount = {
    present: 0,
    sick: 0,
    excused: 0,
    absent: 0,
  };

  for (const rec of attendanceRecords) {
    if (rec.status === "PRESENT") attendanceCount.present++;
    else if (rec.status === "SICK") attendanceCount.sick++;
    else if (rec.status === "EXCUSED") attendanceCount.excused++;
    else if (rec.status === "ABSENT") attendanceCount.absent++;
  }

  // 4. Susun snapshot abadi (Frozen Snapshot)
  const frozenSnapshot: FrozenReportCardSnapshot = {
    frozenAt: new Date().toISOString(),
    publishedBy: ctx.userId,
    semester: reportCard.semester,
    student: {
      id: reportCard.student.id,
      fullName: reportCard.student.fullName,
      nis: reportCard.student.nis,
      nisn: reportCard.student.nisn,
      gender: reportCard.student.gender,
    },
    classroom: {
      id: reportCard.classroom.id,
      name: reportCard.classroom.name,
    },
    academicYear: {
      id: reportCard.academicYear.id,
      name: reportCard.academicYear.name,
    },
    notes: validated.notes ?? reportCard.notes,
    subjects: reportCard.subjects.map((sub) => ({
      subjectId: sub.subjectId,
      subjectName: sub.subject.name,
      subjectCode: sub.subject.code,
      finalScore: sub.finalScore,
      letterGrade: sub.letterGrade,
      comments: sub.comments,
    })),
    attendance: attendanceCount,
  };

  // 5. Simpan dan bekukan status ke PUBLISHED
  await db.reportCard.update({
    where: {
      id_institutionId: {
        id: reportCard.id,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishedById: ctx.userId,
      notes: validated.notes ?? reportCard.notes,
      frozenData: JSON.stringify(frozenSnapshot),
    },
  });

  const publishedReportCard = await getReportCard(ctx, reportCard.id, db);

  // 6. Post-Publish Event: Queue report card notification outbox
  try {
    const recipient = await resolveStudentGuardianRecipient(
      reportCard.studentId,
      ctx.institutionId,
      db as any
    );

    if (recipient) {
      await notifyReportCardPublished(
        {
          recipientPhone: recipient.recipientPhone,
          studentName: reportCard.student.fullName,
          reportCardId: reportCard.id,
          semester: Number(reportCard.semester) || 1,
          academicYear: reportCard.academicYear.name,
          classroomName: reportCard.classroom.name,
          reportUrl: `/wali/akademik/raport/${reportCard.id}`,
          idempotencyKey: `REPORT_CARD_PUBLISHED:${reportCard.id}`,
        },
        db as any
      );
    }
  } catch (notifErr) {
    console.error("[ReportCardNotification] Failed to queue report card notification:", notifErr);
  }

  return publishedReportCard;
}

/**
 * Mengambil detail raport siswa.
 * Jika berstatus PUBLISHED, parsed snapshot menjadi sumber kebenaran abadi.
 */
export async function getReportCard(
  ctx: TenantContext,
  id: string,
  txPrisma?: typeof prisma
): Promise<ReportCardWithDetails> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const reportCard = await db.reportCard.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          nis: true,
          nisn: true,
          gender: true,
        },
      },
      classroom: {
        select: {
          id: true,
          name: true,
        },
      },
      academicYear: {
        select: {
          id: true,
          name: true,
        },
      },
      publishedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      subjects: {
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          subject: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!reportCard) {
    throw new ReportCardNotFoundError(id);
  }

  let parsedSnapshot: FrozenReportCardSnapshot | null = null;
  if (reportCard.status === "PUBLISHED" && reportCard.frozenData) {
    try {
      parsedSnapshot = JSON.parse(reportCard.frozenData);
    } catch {
      // fallback
    }
  }

  return {
    ...reportCard,
    parsedSnapshot,
  } as ReportCardWithDetails;
}

/**
 * Mengambil daftar buku raport dengan filter dan pagination.
 */
export async function listReportCards(
  ctx: TenantContext,
  query?: ReportCardFilterQuery,
  txPrisma?: typeof prisma
): Promise<{ items: ReportCardWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
  const db = txPrisma || prisma;
  requirePermission(ctx, "academic:view");

  const validated = reportCardFilterSchema.parse(query || {});
  const page = validated.page ?? 1;
  const limit = validated.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Prisma.ReportCardWhereInput = {
    institutionId: ctx.institutionId,
  };

  if (validated.classroomId) where.classroomId = validated.classroomId;
  if (validated.academicYearId) where.academicYearId = validated.academicYearId;
  if (validated.studentId) where.studentId = validated.studentId;
  if (validated.semester) where.semester = validated.semester;
  if (validated.status) where.status = validated.status;

  const [total, items] = await Promise.all([
    db.reportCard.count({ where }),
    db.reportCard.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            nis: true,
            nisn: true,
            gender: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
          },
        },
        publishedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        subjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: items as ReportCardWithDetails[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
