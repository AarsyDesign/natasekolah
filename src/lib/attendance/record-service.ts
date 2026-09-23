import { prisma } from "../prisma";
import type { AttendanceRecord } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateMarkAttendanceInput,
  validateMarkAttendanceBatchInput,
} from "../validation/attendance";
import {
  AttendanceStatus,
  AttendanceSessionClosedError,
  AttendanceAccessDeniedError,
  InvalidAttendanceContextError,
  ResourceNotFoundError,
} from "./types";

/**
 * Item Siswa dalam Roster Absensi Sesi.
 */
export interface AttendanceRosterItem {
  studentId: string;
  enrollmentId: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  gender: string;
  recordId?: string;
  status: AttendanceStatus | "UNRECORDED";
  note?: string | null;
  markedAt?: Date;
}

export interface AttendanceRosterResult {
  sessionId: string;
  status: string;
  attendanceDate: Date;
  context?: string;
  assignment?: {
    id: string;
    teacherName: string;
    subjectName: string;
    classroomName: string;
    academicYearName: string;
  } | null;
  dormitoryRoom?: {
    id: string;
    name: string;
    dormitoryName: string;
  } | null;
  summary: {
    totalEligible: number;
    totalMarked: number;
    totalUnrecorded: number;
    present: number;
    excused: number;
    sick: number;
    absent: number;
  };
  roster: AttendanceRosterItem[];
}

/**
 * Mendapatkan daftar siswa (roster) untuk sebuah sesi absensi berdasarkan relasi sakral Enrollment.
 */
export async function getAttendanceRoster(
  ctx: TenantContext,
  sessionId: string
): Promise<AttendanceRosterResult> {
  // 1. RBAC Guard: Memerlukan izin attendance:view
  requirePermission(ctx, "attendance:view");

  // 2. Ambil data sesi dan assignment
  const session = await prisma.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: sessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          subject: true,
          classroom: true,
          academicYear: true,
        },
      },
      dormitoryRoom: {
        include: {
          dormitory: true,
        },
      },
      records: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sessionId);
  }

  // 3. Resource Scope Guard: Guru hanya boleh melihat roster sesinya sendiri
  if (session.context === "LIVING") {
    // Living context: Authorized via attendance:view
  } else if (session.teacherAssignment) {
    const isManager = hasPermission(ctx, "academic:manage");
    if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError(
        "Guru tidak diizinkan mengakses roster absensi rekan guru lain."
      );
    }
  }

  // Petakan record yang telah tersimpan
  const recordsMap = new Map<string, AttendanceRecord>();
  for (const record of session.records) {
    recordsMap.set(record.studentId, record);
  }

  let present = 0;
  let excused = 0;
  let sick = 0;
  let absent = 0;
  let markedCount = 0;

  // 4A. Penanganan Sesi Asrama (LIVING)
  if (session.context === "LIVING" && session.dormitoryRoom) {
    const activeAssignments = await prisma.studentDormitoryAssignment.findMany({
      where: {
        institutionId: ctx.institutionId,
        roomId: session.dormitoryRoom.id,
        status: "ACTIVE",
      },
      include: {
        student: {
          select: {
            id: true,
            nis: true,
            nisn: true,
            fullName: true,
            gender: true,
          },
        },
      },
      orderBy: {
        student: {
          fullName: "asc",
        },
      },
    });

    const roster: AttendanceRosterItem[] = activeAssignments.map((a) => {
      const existing = recordsMap.get(a.student.id);
      let itemStatus: AttendanceStatus | "UNRECORDED" = "UNRECORDED";
      let recordId: string | undefined;
      let note: string | null = null;
      let markedAt: Date | undefined;

      if (existing) {
        itemStatus = existing.status as AttendanceStatus;
        recordId = existing.id;
        note = existing.note;
        markedAt = existing.markedAt;
        markedCount++;

        if (itemStatus === "PRESENT") present++;
        else if (itemStatus === "EXCUSED") excused++;
        else if (itemStatus === "SICK") sick++;
        else if (itemStatus === "ABSENT") absent++;
      }

      return {
        studentId: a.student.id,
        enrollmentId: "",
        nis: a.student.nis,
        nisn: a.student.nisn,
        fullName: a.student.fullName,
        gender: a.student.gender,
        recordId,
        status: itemStatus,
        note,
        markedAt,
      };
    });

    return {
      sessionId: session.id,
      status: session.status,
      attendanceDate: session.attendanceDate,
      context: session.context,
      assignment: null,
      dormitoryRoom: {
        id: session.dormitoryRoom.id,
        name: session.dormitoryRoom.name,
        dormitoryName: session.dormitoryRoom.dormitory.name,
      },
      summary: {
        totalEligible: activeAssignments.length,
        totalMarked: markedCount,
        totalUnrecorded: activeAssignments.length - markedCount,
        present,
        excused,
        sick,
        absent,
      },
      roster,
    };
  }

  // 4B. Penanganan Sesi Akademik (ACADEMIC)
  const enrollments = session.teacherAssignment
    ? await prisma.enrollment.findMany({
        where: {
          institutionId: ctx.institutionId,
          academicYearId: session.teacherAssignment.academicYearId,
          classroomId: session.teacherAssignment.classroomId,
          status: "ENROLLED",
          student: {
            status: "ACTIVE",
          },
        },
        include: {
          student: {
            select: {
              id: true,
              nis: true,
              nisn: true,
              fullName: true,
              gender: true,
            },
          },
        },
        orderBy: {
          student: {
            fullName: "asc",
          },
        },
      })
    : [];

  const roster: AttendanceRosterItem[] = enrollments.map((enr) => {
    const existing = recordsMap.get(enr.studentId);
    let itemStatus: AttendanceStatus | "UNRECORDED" = "UNRECORDED";
    let recordId: string | undefined;
    let note: string | null = null;
    let markedAt: Date | undefined;

    if (existing) {
      itemStatus = existing.status as AttendanceStatus;
      recordId = existing.id;
      note = existing.note;
      markedAt = existing.markedAt;
      markedCount++;

      if (itemStatus === "PRESENT") present++;
      else if (itemStatus === "EXCUSED") excused++;
      else if (itemStatus === "SICK") sick++;
      else if (itemStatus === "ABSENT") absent++;
    }

    return {
      studentId: enr.student.id,
      enrollmentId: enr.id,
      nis: enr.student.nis,
      nisn: enr.student.nisn,
      fullName: enr.student.fullName,
      gender: enr.student.gender,
      recordId,
      status: itemStatus,
      note,
      markedAt,
    };
  });

  return {
    sessionId: session.id,
    status: session.status,
    attendanceDate: session.attendanceDate,
    context: session.context,
    assignment: session.teacherAssignment
      ? {
          id: session.teacherAssignment.id,
          teacherName: session.teacherAssignment.teacher.name,
          subjectName: session.teacherAssignment.subject.name,
          classroomName: session.teacherAssignment.classroom.name,
          academicYearName: session.teacherAssignment.academicYear.name,
        }
      : null,
    dormitoryRoom: null,
    summary: {
      totalEligible: enrollments.length,
      totalMarked: markedCount,
      totalUnrecorded: enrollments.length - markedCount,
      present,
      excused,
      sick,
      absent,
    },
    roster,
  };
}

/**
 * Mencatat kehadiran satu siswa dalam sebuah sesi absensi.
 */
export async function markAttendance(
  ctx: TenantContext,
  rawInput: unknown
): Promise<AttendanceRecord> {
  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Zod Validation
  const validated = validateMarkAttendanceInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi Sesi Absensi & Tenant Boundary
  const session = await prisma.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.attendanceSessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
      dormitoryRoom: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sanitized.attendanceSessionId);
  }

  // 5. Invariant Immutability: Sesi CLOSED tidak boleh diubah
  if (session.status === "CLOSED") {
    throw new AttendanceSessionClosedError(session.id);
  }

  // 6. Resource Scope Guard: Guru hanya boleh mengisi sesinya sendiri jika konteks akademik
  if (session.context === "LIVING") {
    // Living context: authorized via attendance:manage
  } else if (session.teacherAssignment) {
    const isManager = hasPermission(ctx, "academic:manage");
    if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError(
        "Guru tidak diizinkan mengubah catatan absensi rekan guru lain."
      );
    }
  }

  // 7. Domain Invariant: Dapatkan Enrollment yang sah
  let enrollmentId: string | null = null;
  if (session.context === "LIVING" && session.dormitoryRoomId) {
    const assignment = await prisma.studentDormitoryAssignment.findFirst({
      where: {
        institutionId: ctx.institutionId,
        studentId: sanitized.studentId,
        roomId: session.dormitoryRoomId,
        status: "ACTIVE",
      },
    });

    if (!assignment) {
      throw new InvalidAttendanceContextError(
        `Santri (${sanitized.studentId}) tidak terdaftar aktif di kamar asrama sesi ini.`
      );
    }

    const latestEnrollment = await prisma.enrollment.findFirst({
      where: {
        institutionId: ctx.institutionId,
        studentId: sanitized.studentId,
      },
      orderBy: { enrolledAt: "desc" },
    });

    if (!latestEnrollment) {
      throw new InvalidAttendanceContextError(
        `Santri (${sanitized.studentId}) belum memiliki rekaman Enrollment di lembaga ini.`
      );
    }
    enrollmentId = latestEnrollment.id;
  } else if (session.teacherAssignment) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        institutionId: ctx.institutionId,
        studentId: sanitized.studentId,
        academicYearId: session.teacherAssignment.academicYearId,
        classroomId: session.teacherAssignment.classroomId,
        status: "ENROLLED",
        student: {
          status: "ACTIVE",
        },
      },
    });

    if (!enrollment) {
      throw new InvalidAttendanceContextError(
        `Siswa (${sanitized.studentId}) tidak memiliki riwayat pendaftaran aktif (Enrollment) pada rombel dan tahun ajaran penugasan ini.`
      );
    }
    enrollmentId = enrollment.id;
  }

  if (!enrollmentId) {
    throw new InvalidAttendanceContextError(
      `Tidak dapat menentukan konteks pendaftaran (Enrollment) untuk siswa (${sanitized.studentId}).`
    );
  }

  // 8. Upsert Record Kehadiran (Menyimpan studentId DAN enrollmentId untuk keselamatan histori)
  return prisma.attendanceRecord.upsert({
    where: {
      attendanceSessionId_studentId: {
        attendanceSessionId: sanitized.attendanceSessionId,
        studentId: sanitized.studentId,
      },
    },
    create: {
      institutionId: ctx.institutionId,
      attendanceSessionId: sanitized.attendanceSessionId,
      studentId: sanitized.studentId,
      enrollmentId,
      status: sanitized.status,
      note: sanitized.note,
      markedAt: new Date(),
    },
    update: {
      status: sanitized.status,
      note: sanitized.note,
      markedAt: new Date(),
    },
    include: {
      student: {
        select: {
          id: true,
          nis: true,
          fullName: true,
        },
      },
      enrollment: true,
    },
  });
}

/**
 * Mencatat kehadiran rombel secara massal (Batch Attendance Marking) dalam satu transaksi database.
 */
export async function markAttendanceBatch(
  ctx: TenantContext,
  rawInput: unknown
): Promise<{ count: number; sessionId: string }> {
  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Zod Validation
  const validated = validateMarkAttendanceBatchInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi Sesi Absensi & Tenant Boundary
  const session = await prisma.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.attendanceSessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
      dormitoryRoom: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sanitized.attendanceSessionId);
  }

  // 5. Invariant Immutability
  if (session.status === "CLOSED") {
    throw new AttendanceSessionClosedError(session.id);
  }

  // 6. Resource Scope Guard
  if (session.context === "LIVING") {
    // Living context: authorized via attendance:manage
  } else if (session.teacherAssignment) {
    const isManager = hasPermission(ctx, "academic:manage");
    if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError(
        "Guru tidak diizinkan mengubah catatan absensi rekan guru lain."
      );
    }
  }

  // 7. Domain Invariant: Ambil seluruh enrollment siswa yang sah
  const enrollmentByStudentId = new Map<string, string>();

  if (session.context === "LIVING" && session.dormitoryRoomId) {
    const activeAssignments = await prisma.studentDormitoryAssignment.findMany({
      where: {
        institutionId: ctx.institutionId,
        roomId: session.dormitoryRoomId,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: {
            enrollments: {
              orderBy: { enrolledAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    for (const a of activeAssignments) {
      if (a.student.enrollments.length > 0) {
        enrollmentByStudentId.set(a.studentId, a.student.enrollments[0].id);
      }
    }

    for (const item of sanitized.records) {
      if (!enrollmentByStudentId.has(item.studentId)) {
        throw new InvalidAttendanceContextError(
          `Santri (${item.studentId}) bukan penghuni aktif di kamar asrama sesi ini.`
        );
      }
    }
  } else if (session.teacherAssignment) {
    const eligibleEnrollments = await prisma.enrollment.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: session.teacherAssignment.academicYearId,
        classroomId: session.teacherAssignment.classroomId,
        status: "ENROLLED",
        student: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        studentId: true,
      },
    });

    for (const enr of eligibleEnrollments) {
      enrollmentByStudentId.set(enr.studentId, enr.id);
    }

    // Validasi bahwa seluruh siswa dalam batch adalah siswa sah rombel ini
    for (const item of sanitized.records) {
      if (!enrollmentByStudentId.has(item.studentId)) {
        throw new InvalidAttendanceContextError(
          `Siswa (${item.studentId}) bukan anggota terdaftar pada rombel dan tahun ajaran sesi ini.`
        );
      }
    }
  }

  // 8. Eksekusi Batch Upsert dalam satu transaksi atomik
  const now = new Date();
  await prisma.$transaction(
    sanitized.records.map((item) => {
      const enrollmentId = enrollmentByStudentId.get(item.studentId)!;
      return prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sanitized.attendanceSessionId,
            studentId: item.studentId,
          },
        },
        create: {
          institutionId: ctx.institutionId,
          attendanceSessionId: sanitized.attendanceSessionId,
          studentId: item.studentId,
          enrollmentId,
          status: item.status,
          note: item.note,
          markedAt: now,
        },
        update: {
          status: item.status,
          note: item.note,
          markedAt: now,
        },
      });
    })
  );

  return {
    count: sanitized.records.length,
    sessionId: sanitized.attendanceSessionId,
  };
}

/**
 * Mengambil rekaman absensi untuk sebuah sesi.
 */
export async function getAttendanceRecords(
  ctx: TenantContext,
  sessionId: string
): Promise<AttendanceRecord[]> {
  // 1. RBAC Guard: Memerlukan izin attendance:view
  requirePermission(ctx, "attendance:view");

  // 2. Verifikasi Sesi & Scope
  const session = await prisma.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: sessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sessionId);
  }

  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && session.teacherAssignment && session.teacherAssignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru tidak diizinkan mengakses rekaman absensi rekan guru lain."
    );
  }

  // 3. Ambil seluruh record
  return prisma.attendanceRecord.findMany({
    where: {
      institutionId: ctx.institutionId,
      attendanceSessionId: sessionId,
    },
    include: {
      student: {
        select: {
          id: true,
          nis: true,
          nisn: true,
          fullName: true,
          gender: true,
        },
      },
      enrollment: true,
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });
}
