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
  assignment: {
    id: string;
    teacherName: string;
    subjectName: string;
    classroomName: string;
    academicYearName: string;
  };
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
      records: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sessionId);
  }

  // 3. Resource Scope Guard: Guru hanya boleh melihat roster sesinya sendiri
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru tidak diizinkan mengakses roster absensi rekan guru lain."
    );
  }

  // 4. Ambil seluruh siswa terdaftar (Enrollment) aktif pada rombel dan tahun ajaran penugasan
  const enrollments = await prisma.enrollment.findMany({
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
  });

  // 5. Petakan record yang telah tersimpan
  const recordsMap = new Map<string, AttendanceRecord>();
  for (const record of session.records) {
    recordsMap.set(record.studentId, record);
  }

  let present = 0;
  let excused = 0;
  let sick = 0;
  let absent = 0;
  let markedCount = 0;

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
    assignment: {
      id: session.teacherAssignment.id,
      teacherName: session.teacherAssignment.teacher.name,
      subjectName: session.teacherAssignment.subject.name,
      classroomName: session.teacherAssignment.classroom.name,
      academicYearName: session.teacherAssignment.academicYear.name,
    },
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
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sanitized.attendanceSessionId);
  }

  // 5. Invariant Immutability: Sesi CLOSED tidak boleh diubah
  if (session.status === "CLOSED") {
    throw new AttendanceSessionClosedError(session.id);
  }

  // 6. Resource Scope Guard: Guru hanya boleh mengisi sesinya sendiri
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru tidak diizinkan mengubah catatan absensi rekan guru lain."
    );
  }

  // 7. Domain Invariant: Siswa WAJIB terdaftar (Enrollment aktif) pada rombel & tahun ajaran penugasan
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
      enrollmentId: enrollment.id,
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
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru tidak diizinkan mengubah catatan absensi rekan guru lain."
    );
  }

  // 7. Domain Invariant: Ambil seluruh enrollment siswa yang sah untuk assignment ini
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

  const enrollmentByStudentId = new Map<string, string>();
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
  if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
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
