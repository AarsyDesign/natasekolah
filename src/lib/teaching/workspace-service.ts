import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { assertTeacherAssignmentAccess } from "./assignment-service";
import { ResourceNotFoundError, TeacherAssignmentAccessDeniedError } from "./types";
import { isPluginEnabled, requirePlugin, DomainFeatureDisabledError } from "../plugins/guard";
import { PLUGINS } from "../plugins/registry";
import { normalizeAttendanceDate } from "../attendance/types";

export interface TeacherAssignmentCardItem {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  subjectCategory: string | null;
  classroomId: string;
  classroomName: string;
  academicYearId: string;
  academicYearName: string;
  studentCount: number;
  todaySession: {
    id: string;
    status: "OPEN" | "CLOSED";
    recordsCount: number;
  } | null;
  assessmentCount: number;
}

export interface TeacherWorkspaceSummary {
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  activeAcademicYear: {
    id: string;
    name: string;
  } | null;
  metrics: {
    totalClasses: number;
    totalSubjects: number;
    totalAssignments: number;
    totalStudentsTaught: number;
    todaySessionsTotal: number;
    todaySessionsCompleted: number;
    todaySessionsPending: number;
    pendingAssessments: number;
  };
  isFormalAcademicEnabled: boolean;
  assignments: TeacherAssignmentCardItem[];
}

export interface StudentRosterItemWithStats {
  id: string;
  fullName: string;
  nis: string;
  nisn: string | null;
  gender: string;
  status: string;
  attendance: {
    totalSessions: number;
    present: number;
    sick: number;
    excused: number;
    absent: number;
    attendanceRate: number;
  };
  academic: {
    assessmentsTaken: number;
    averageScore: number | null;
  };
}

export interface TeacherClassDetail {
  assignment: {
    id: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    classroomId: string;
    classroomName: string;
    academicYearId: string;
    academicYearName: string;
  };
  isFormalAcademicEnabled: boolean;
  summary: {
    totalStudents: number;
    totalSessionsHeld: number;
    totalAssessments: number;
    classAverageScore: number | null;
    classAttendanceRate: number;
  };
  todaySession: {
    id: string;
    status: "OPEN" | "CLOSED";
  } | null;
  students: StudentRosterItemWithStats[];
}

export interface TeacherStudentAcademicDetail {
  student: {
    id: string;
    fullName: string;
    nis: string;
    nisn: string | null;
    gender: string;
    status: string;
  };
  assignment: {
    id: string;
    subjectName: string;
    subjectCode: string | null;
    classroomName: string;
    academicYearName: string;
  };
  isFormalAcademicEnabled: boolean;
  attendance: {
    totalSessions: number;
    present: number;
    sick: number;
    excused: number;
    absent: number;
    attendanceRate: number;
    history: Array<{
      sessionId: string;
      date: Date | string;
      status: string;
      note: string | null;
    }>;
  };
  academic: {
    averageScore: number | null;
    scores: Array<{
      assessmentId: string;
      title: string;
      type: string;
      maxScore: number;
      score: number | null;
      date: Date | string;
      note: string | null;
    }>;
  };
}

/**
 * Layanan Workspace Guru (Teacher Workspace Service) NataSekolah.
 *
 * Mengagregasi seluruh alur kerja harian guru (Penugasan, Presensi, Asesmen, Rekap Siswa)
 * dalam satu tempat terpadu dengan penegakan batasan resource scope guru yang ketat.
 */

export async function getTeacherWorkspaceSummary(
  ctx: TenantContext,
  txPrisma?: typeof prisma
): Promise<TeacherWorkspaceSummary> {
  const db = txPrisma || prisma;

  // 1. RBAC Guard: Guru atau Staf Akademik
  requirePermission(ctx, "academic:view");

  // 2. Identifikasi Pengguna Guru
  const user = await db.user.findUnique({
    where: {
      id_institutionId: {
        id: ctx.userId,
        institutionId: ctx.institutionId,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
    },
  });

  if (!user) {
    throw new ResourceNotFoundError("Guru", ctx.userId);
  }

  // 3. Periksa status plugin FORMAL_ACADEMIC
  let isFormalAcademicEnabled = true;
  if (db.institution?.findUnique) {
    const institution = await db.institution.findUnique({
      where: { id: ctx.institutionId },
      select: { enabledPlugins: true },
    });
    if (institution) {
      isFormalAcademicEnabled = isPluginEnabled(institution, PLUGINS.FORMAL_ACADEMIC);
    }
  }

  // 4. Ambil Tahun Ajaran Aktif lembaga
  const activeYear = await db.academicYear.findFirst({
    where: {
      institutionId: ctx.institutionId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  // 5. Query Penugasan Mengajar Guru (Resource Scope: Teacher hanya melihat miliknya)
  const isManager = hasPermission(ctx, "academic:manage");
  const assignments = await db.teacherAssignment.findMany({
    where: {
      institutionId: ctx.institutionId,
      // Jika bukan manajer akademik institusi, batasi mutlak ke userId guru yang login
      ...(!isManager ? { teacherId: ctx.userId } : { teacherId: ctx.userId }),
    },
    include: {
      subject: true,
      classroom: true,
      academicYear: true,
    },
    orderBy: [{ classroom: { name: "asc" } }, { subject: { name: "asc" } }],
  });

  const assignmentIds = assignments.map((a) => a.id);

  // 6. Cek Sesi Presensi Hari Ini (Normalized UTC Date)
  const todayNormalized = normalizeAttendanceDate(new Date());
  const todaySessions = assignmentIds.length > 0
    ? await db.attendanceSession.findMany({
        where: {
          institutionId: ctx.institutionId,
          teacherAssignmentId: { in: assignmentIds },
          attendanceDate: todayNormalized,
        },
        include: {
          records: {
            select: { id: true },
          },
        },
      })
    : [];

  const sessionByAssignmentId = new Map(
    todaySessions.map((s) => [s.teacherAssignmentId, s])
  );

  // 7. Ambil Jumlah Siswa Terdaftar (Enrollment) per Kelas & Tahun Ajaran
  const classroomsYears = assignments.map((a) => ({
    classroomId: a.classroomId,
    academicYearId: a.academicYearId,
  }));

  const enrollmentsCounts = await Promise.all(
    classroomsYears.map(async (cy) => {
      const count = await db.enrollment.count({
        where: {
          institutionId: ctx.institutionId,
          classroomId: cy.classroomId,
          academicYearId: cy.academicYearId,
          status: "ENROLLED",
          student: {
            status: "ACTIVE",
          },
        },
      });
      return { key: `${cy.classroomId}_${cy.academicYearId}`, count };
    })
  );

  const enrollmentCountMap = new Map(
    enrollmentsCounts.map((ec) => [ec.key, ec.count])
  );

  // 8. Ambil Penilaian (Asesmen) per Assignment (jika plugin FORMAL_ACADEMIC aktif)
  const assessmentCountMap = new Map<string, number>();
  let pendingAssessmentsCount = 0;

  if (isFormalAcademicEnabled && assignmentIds.length > 0 && db.assessment?.findMany) {
    const assessments = await db.assessment.findMany({
      where: {
        institutionId: ctx.institutionId,
        teacherAssignmentId: { in: assignmentIds },
      },
      include: {
        _count: {
          select: { scores: true },
        },
      },
    });

    for (const asm of assessments) {
      const current = assessmentCountMap.get(asm.teacherAssignmentId) || 0;
      assessmentCountMap.set(asm.teacherAssignmentId, current + 1);

      // Cek apakah asesmen ini belum lengkap diisi
      const targetAssignment = assignments.find((a) => a.id === asm.teacherAssignmentId);
      if (targetAssignment) {
        const studentCount = enrollmentCountMap.get(`${targetAssignment.classroomId}_${targetAssignment.academicYearId}`) || 0;
        if (studentCount > 0 && (asm._count?.scores || 0) < studentCount) {
          pendingAssessmentsCount++;
        }
      }
    }
  }

  // 9. Susun Array Assignment Card Items
  const uniqueClassroomIds = new Set<string>();
  const uniqueSubjectIds = new Set<string>();
  let totalStudentsSum = 0;
  let todaySessionsCompleted = 0;
  let todaySessionsPending = 0;

  const assignmentCards: TeacherAssignmentCardItem[] = assignments.map((a) => {
    uniqueClassroomIds.add(a.classroomId);
    uniqueSubjectIds.add(a.subjectId);

    const studentCount = enrollmentCountMap.get(`${a.classroomId}_${a.academicYearId}`) || 0;
    totalStudentsSum += studentCount;

    const session = sessionByAssignmentId.get(a.id);
    let todaySessionInfo: TeacherAssignmentCardItem["todaySession"] = null;

    if (session) {
      todaySessionInfo = {
        id: session.id,
        status: session.status as "OPEN" | "CLOSED",
        recordsCount: session.records.length,
      };

      if (session.status === "CLOSED") {
        todaySessionsCompleted++;
      } else {
        todaySessionsPending++;
      }
    }

    return {
      id: a.id,
      subjectId: a.subject.id,
      subjectName: a.subject.name,
      subjectCode: a.subject.code,
      subjectCategory: a.subject.category,
      classroomId: a.classroom.id,
      classroomName: a.classroom.name,
      academicYearId: a.academicYear.id,
      academicYearName: a.academicYear.name,
      studentCount,
      todaySession: todaySessionInfo,
      assessmentCount: assessmentCountMap.get(a.id) || 0,
    };
  });

  return {
    teacher: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    activeAcademicYear: activeYear
      ? {
          id: activeYear.id,
          name: activeYear.name,
        }
      : null,
    metrics: {
      totalClasses: uniqueClassroomIds.size,
      totalSubjects: uniqueSubjectIds.size,
      totalAssignments: assignments.length,
      totalStudentsTaught: totalStudentsSum,
      todaySessionsTotal: todaySessions.length,
      todaySessionsCompleted,
      todaySessionsPending,
      pendingAssessments: pendingAssessmentsCount,
    },
    isFormalAcademicEnabled,
    assignments: assignmentCards,
  };
}

/**
 * Mengambil rincian kelas/rombel dan daftar siswa untuk penugasan mengajar tertentu.
 * Menghitung rekapitulasi absensi dan rata-rata nilai per santri.
 */
export async function getTeacherClassDetail(
  ctx: TenantContext,
  assignmentId: string,
  txPrisma?: typeof prisma
): Promise<TeacherClassDetail> {
  const db = txPrisma || prisma;

  // 1. RBAC Guard: academic:view atau attendance:view
  requirePermission(ctx, "academic:view");

  // 2. Resource Scope Guard: Verifikasi kepemilikan penugasan
  const assignment = await assertTeacherAssignmentAccess(ctx, assignmentId, db);

  // 3. Periksa status plugin FORMAL_ACADEMIC
  let isFormalAcademicEnabled = true;
  if (db.institution?.findUnique) {
    const institution = await db.institution.findUnique({
      where: { id: ctx.institutionId },
      select: { enabledPlugins: true },
    });
    if (institution) {
      isFormalAcademicEnabled = isPluginEnabled(institution, PLUGINS.FORMAL_ACADEMIC);
    }
  }

  // 4. Ambil seluruh siswa aktif yang terdaftar (Enrollment) pada rombel & tahun ajaran ini
  const enrollments = await db.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      classroomId: assignment.classroomId,
      academicYearId: assignment.academicYearId,
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
          gender: true,
          status: true,
        },
      },
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });

  // 5. Ambil seluruh sesi absensi penugasan ini
  const sessions = await db.attendanceSession.findMany({
    where: {
      institutionId: ctx.institutionId,
      teacherAssignmentId: assignment.id,
    },
    include: {
      records: true,
    },
  });

  // Sesi hari ini
  const todayNormalized = normalizeAttendanceDate(new Date());
  const todaySession = sessions.find(
    (s) => s.attendanceDate.getTime() === todayNormalized.getTime()
  );

  // Petakan statistik absensi per siswa
  // studentId -> { present, sick, excused, absent, total }
  const attendanceStatsMap = new Map<
    string,
    { present: number; sick: number; excused: number; absent: number; total: number }
  >();

  for (const session of sessions) {
    for (const record of session.records) {
      let stats = attendanceStatsMap.get(record.studentId);
      if (!stats) {
        stats = { present: 0, sick: 0, excused: 0, absent: 0, total: 0 };
        attendanceStatsMap.set(record.studentId, stats);
      }
      stats.total++;
      if (record.status === "PRESENT") stats.present++;
      else if (record.status === "SICK") stats.sick++;
      else if (record.status === "EXCUSED") stats.excused++;
      else if (record.status === "ABSENT") stats.absent++;
    }
  }

  // 6. Ambil asesmen dan nilai (jika FORMAL_ACADEMIC aktif)
  let totalAssessmentsCount = 0;
  // studentId -> { totalScores, count }
  const scoreStatsMap = new Map<string, { sum: number; count: number }>();

  if (isFormalAcademicEnabled && db.assessment?.findMany) {
    const assessments = await db.assessment.findMany({
      where: {
        institutionId: ctx.institutionId,
        teacherAssignmentId: assignment.id,
      },
      include: {
        scores: true,
      },
    });

    totalAssessmentsCount = assessments.length;

    for (const asm of assessments) {
      for (const sc of asm.scores) {
        if (sc.score !== null) {
          let sStats = scoreStatsMap.get(sc.studentId);
          if (!sStats) {
            sStats = { sum: 0, count: 0 };
            scoreStatsMap.set(sc.studentId, sStats);
          }
          sStats.sum += sc.score;
          sStats.count++;
        }
      }
    }
  }

  // 7. Agregasi per Siswa
  let classScoreSum = 0;
  let classScoreCount = 0;
  let classAttendanceRateSum = 0;

  const studentsRoster: StudentRosterItemWithStats[] = enrollments.map((enr) => {
    const att = attendanceStatsMap.get(enr.student.id) || {
      present: 0,
      sick: 0,
      excused: 0,
      absent: 0,
      total: 0,
    };

    const attendanceRate =
      sessions.length > 0 ? Math.round((att.present / sessions.length) * 100) : 100;
    classAttendanceRateSum += attendanceRate;

    const sc = scoreStatsMap.get(enr.student.id);
    const averageScore = sc && sc.count > 0 ? Math.round((sc.sum / sc.count) * 10) / 10 : null;

    if (averageScore !== null) {
      classScoreSum += averageScore;
      classScoreCount++;
    }

    return {
      id: enr.student.id,
      fullName: enr.student.fullName,
      nis: enr.student.nis,
      nisn: enr.student.nisn,
      gender: enr.student.gender,
      status: enr.student.status,
      attendance: {
        totalSessions: sessions.length,
        present: att.present,
        sick: att.sick,
        excused: att.excused,
        absent: att.absent,
        attendanceRate,
      },
      academic: {
        assessmentsTaken: sc ? sc.count : 0,
        averageScore,
      },
    };
  });

  const classAverageScore =
    classScoreCount > 0 ? Math.round((classScoreSum / classScoreCount) * 10) / 10 : null;

  const classAttendanceRate =
    studentsRoster.length > 0
      ? Math.round(classAttendanceRateSum / studentsRoster.length)
      : 100;

  return {
    assignment: {
      id: assignment.id,
      subjectId: (assignment as any).subject?.id || assignment.subjectId,
      subjectName: (assignment as any).subject?.name || "Mata Pelajaran",
      subjectCode: (assignment as any).subject?.code || null,
      classroomId: (assignment as any).classroom?.id || assignment.classroomId,
      classroomName: (assignment as any).classroom?.name || "Rombel",
      academicYearId: (assignment as any).academicYear?.id || assignment.academicYearId,
      academicYearName: (assignment as any).academicYear?.name || "Tahun Ajaran",
    },
    isFormalAcademicEnabled,
    summary: {
      totalStudents: studentsRoster.length,
      totalSessionsHeld: sessions.length,
      totalAssessments: totalAssessmentsCount,
      classAverageScore,
      classAttendanceRate,
    },
    todaySession: todaySession
      ? {
          id: todaySession.id,
          status: todaySession.status as "OPEN" | "CLOSED",
        }
      : null,
    students: studentsRoster,
  };
}

/**
 * Mengambil ringkasan kemajuan akademik dan absensi seorang siswa untuk penugasan mengajar tertentu.
 * Menjamin isolasi data siswa: TIDAK mengekspos data keuangan maupun data wali murid.
 */
export async function getTeacherStudentAcademicSummary(
  ctx: TenantContext,
  assignmentId: string,
  studentId: string,
  txPrisma?: typeof prisma
): Promise<TeacherStudentAcademicDetail> {
  const db = txPrisma || prisma;

  // 1. RBAC Guard
  requirePermission(ctx, "academic:view");

  // 2. Resource Scope Guard: Verifikasi kepemilikan penugasan
  const assignment = await assertTeacherAssignmentAccess(ctx, assignmentId, db);

  // 3. Periksa apakah siswa tersebut memang terdaftar di rombel dan tahun ajaran penugasan
  const enrollment = await db.enrollment.findUnique({
    where: {
      studentId_academicYearId: {
        studentId,
        academicYearId: assignment.academicYearId,
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
          status: true,
          institutionId: true,
        },
      },
      classroom: true,
      academicYear: true,
    },
  });

  if (
    !enrollment ||
    enrollment.classroomId !== assignment.classroomId ||
    enrollment.institutionId !== ctx.institutionId
  ) {
    throw new ResourceNotFoundError("Siswa pada penugasan ini", studentId);
  }

  // 4. Periksa plugin FORMAL_ACADEMIC
  let isFormalAcademicEnabled = true;
  if (db.institution?.findUnique) {
    const institution = await db.institution.findUnique({
      where: { id: ctx.institutionId },
      select: { enabledPlugins: true },
    });
    if (institution) {
      isFormalAcademicEnabled = isPluginEnabled(institution, PLUGINS.FORMAL_ACADEMIC);
    }
  }

  // 5. Histori Absensi Siswa pada Penugasan Ini
  const sessions = await db.attendanceSession.findMany({
    where: {
      institutionId: ctx.institutionId,
      teacherAssignmentId: assignment.id,
    },
    include: {
      records: {
        where: { studentId },
      },
    },
    orderBy: {
      attendanceDate: "desc",
    },
  });

  let present = 0;
  let sick = 0;
  let excused = 0;
  let absent = 0;

  const attendanceHistory = sessions.map((s) => {
    const rec = s.records[0];
    const status = rec ? rec.status : "UNRECORDED";
    if (status === "PRESENT") present++;
    else if (status === "SICK") sick++;
    else if (status === "EXCUSED") excused++;
    else if (status === "ABSENT") absent++;

    return {
      sessionId: s.id,
      date: s.attendanceDate,
      status,
      note: rec?.note || null,
    };
  });

  const attendanceRate =
    sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 100;

  // 6. Asesmen dan Nilai Siswa pada Penugasan Ini
  let scoresList: TeacherStudentAcademicDetail["academic"]["scores"] = [];
  let scoreSum = 0;
  let scoreCount = 0;

  if (isFormalAcademicEnabled && db.assessment?.findMany) {
    const assessments = await db.assessment.findMany({
      where: {
        institutionId: ctx.institutionId,
        teacherAssignmentId: assignment.id,
      },
      include: {
        scores: {
          where: { studentId },
        },
      },
      orderBy: {
        assessmentDate: "desc",
      },
    });

    scoresList = assessments.map((asm) => {
      const sc = asm.scores[0];
      const val = sc?.score ?? null;
      if (val !== null) {
        scoreSum += val;
        scoreCount++;
      }

      return {
        assessmentId: asm.id,
        title: asm.title,
        type: asm.type,
        maxScore: asm.maxScore,
        score: val,
        date: asm.assessmentDate,
        note: sc?.note || null,
      };
    });
  }

  const averageScore =
    scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null;

  return {
    student: {
      id: enrollment.student.id,
      fullName: enrollment.student.fullName,
      nis: enrollment.student.nis,
      nisn: enrollment.student.nisn,
      gender: enrollment.student.gender,
      status: enrollment.student.status,
    },
    assignment: {
      id: assignment.id,
      subjectName: (assignment as any).subject?.name || "Mata Pelajaran",
      subjectCode: (assignment as any).subject?.code || null,
      classroomName: (assignment as any).classroom?.name || enrollment.classroom.name,
      academicYearName: (assignment as any).academicYear?.name || enrollment.academicYear.name,
    },
    isFormalAcademicEnabled,
    attendance: {
      totalSessions: sessions.length,
      present,
      sick,
      excused,
      absent,
      attendanceRate,
      history: attendanceHistory,
    },
    academic: {
      averageScore,
      scores: scoresList,
    },
  };
}
