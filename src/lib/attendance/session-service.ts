import { prisma } from "../prisma";
import type { AttendanceSession, Prisma } from "@prisma/client";
import type { TenantContext } from "../tenant/context";
import { requirePermission, hasPermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validateCreateAttendanceSessionInput,
  validateCreateLivingAttendanceSessionInput,
  validateCloseAttendanceSessionInput,
  validateAttendanceQuery,
} from "../validation/attendance";
import {
  AttendanceSessionAlreadyExistsError,
  LivingAttendanceSessionAlreadyExistsError,
  AttendanceSessionClosedError,
  AttendanceIncompleteError,
  AttendanceAccessDeniedError,
  ResourceNotFoundError,
  formatAttendanceDate,
  normalizeAttendanceDate,
} from "./types";
import { resolveGuardianPhone } from "../notification/guardian-resolver";
import { notifyAttendanceAlert } from "../notification/events";

/**
 * Layanan Domain Sesi Absensi (Attendance Session Service) NataSekolah.
 *
 * PRINSIP & INVARIANT:
 * 1. Guru hanya boleh membuka, melihat, dan menutup sesi untuk TeacherAssignment miliknya sendiri.
 * 2. Admin / Principal dengan izin administratif dapat mengakses seluruh sesi pada institusi.
 * 3. Satu TeacherAssignment hanya boleh memiliki 1 sesi absensi per tanggal kalender akademik.
 * 4. Tanggal absensi dinormalkan ke UTC midnight untuk mencegah bug pergeseran tanggal.
 * 5. Sesi yang telah berstatus CLOSED bersifat IMMUTABLE (kekal).
 * 6. Sesi hanya dapat ditutup jika seluruh siswa eligible dalam rombel telah dicatat kehadirannya.
 */

export async function createAttendanceSession(
  ctx: TenantContext,
  rawInput: unknown,
  txPrisma?: typeof prisma
): Promise<AttendanceSession> {
  const db = txPrisma || prisma;

  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Zod Validation
  const validated = validateCreateAttendanceSessionInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi TeacherAssignment ada dan milik tenant
  const assignment = await db.teacherAssignment.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.teacherAssignmentId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      classroom: true,
      academicYear: true,
      subject: true,
    },
  });

  if (!assignment) {
    throw new ResourceNotFoundError("Penugasan Mengajar", sanitized.teacherAssignmentId);
  }

  // 5. Resource Scope Guard: Guru hanya boleh membuka sesi miliknya sendiri
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && assignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru hanya diizinkan membuka sesi absensi untuk penugasan mengajar miliknya sendiri."
    );
  }

  // 6. Invariant: 1 Sesi per Assignment per Hari Kalender
  const existingSession = await db.attendanceSession.findUnique({
    where: {
      teacherAssignmentId_attendanceDate: {
        teacherAssignmentId: sanitized.teacherAssignmentId,
        attendanceDate: sanitized.attendanceDate,
      },
    },
  });

  if (existingSession) {
    throw new AttendanceSessionAlreadyExistsError(
      sanitized.teacherAssignmentId,
      formatAttendanceDate(sanitized.attendanceDate)
    );
  }

  // 7. Eksekusi Pembuatan Sesi
  return db.attendanceSession.create({
    data: {
      institutionId: ctx.institutionId,
      teacherAssignmentId: sanitized.teacherAssignmentId,
      attendanceDate: sanitized.attendanceDate,
      status: "OPEN",
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
    },
  });
}

export async function getAttendanceSession(
  ctx: TenantContext,
  sessionId: string
) {
  // 1. RBAC Guard: Memerlukan izin attendance:view
  requirePermission(ctx, "attendance:view");

  // 2. Query Sesi dengan filter tenant
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
      records: {
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
      },
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sessionId);
  }

  // 3. Resource Scope Guard
  const isManager = hasPermission(ctx, "academic:manage");
  if (!isManager && session.teacherAssignment && session.teacherAssignment.teacherId !== ctx.userId) {
    throw new AttendanceAccessDeniedError(
      "Guru tidak diizinkan mengakses sesi absensi rekan guru lain."
    );
  }

  return session;
}

export async function listAttendanceSessions(
  ctx: TenantContext,
  rawQuery?: unknown
) {
  // 1. RBAC Guard
  requirePermission(ctx, "attendance:view");

  // 2. Zod Validation
  const query = validateAttendanceQuery(rawQuery || {});

  // 3. Resource Scope Guard: Guru dibatasi hanya melihat sesi penugasan miliknya
  const isManager = hasPermission(ctx, "academic:manage");
  let teacherFilterId = query.teacherId;

  if (!isManager) {
    if (query.teacherId && query.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError("Guru tidak diizinkan melihat riwayat absensi guru lain.");
    }
    teacherFilterId = ctx.userId;
  }

  // 4. Susun klausa where
  const whereClause: Prisma.AttendanceSessionWhereInput = {
    institutionId: ctx.institutionId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.teacherAssignmentId ? { teacherAssignmentId: query.teacherAssignmentId } : {}),
    ...(query.startDate || query.endDate
      ? {
          attendanceDate: {
            ...(query.startDate ? { gte: normalizeAttendanceDate(query.startDate) } : {}),
            ...(query.endDate ? { lte: normalizeAttendanceDate(query.endDate) } : {}),
          },
        }
      : {}),
    teacherAssignment: {
      institutionId: ctx.institutionId,
      ...(teacherFilterId ? { teacherId: teacherFilterId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classroomId ? { classroomId: query.classroomId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    },
  };

  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const [data, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
      include: {
        teacherAssignment: {
          include: {
            teacher: { select: { id: true, name: true, email: true } },
            subject: true,
            classroom: true,
            academicYear: true,
          },
        },
        records: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.attendanceSession.count({ where: whereClause }),
  ]);

  return {
    data,
    items: data,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize) || 1,
  };
}

export async function closeAttendanceSession(
  ctx: TenantContext,
  rawInput: unknown
): Promise<AttendanceSession> {
  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Validasi Input
  const { attendanceSessionId } = validateCloseAttendanceSessionInput(rawInput);

  // 3. Verifikasi Keberadaan Sesi dan Tenant Boundary
  const session = await prisma.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: attendanceSessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
      records: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", attendanceSessionId);
  }

  // 4. Resource Scope Guard
  if (session.context === "LIVING") {
    // Pengasuh asrama atau admin dengan izin attendance:manage dapat menutup sesi
  } else if (session.teacherAssignment) {
    const isManager = hasPermission(ctx, "academic:manage");
    if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError(
        "Guru tidak diizinkan menutup sesi absensi milik guru lain."
      );
    }
  }

  // 5. Invariant: Sesi yang sudah ditutup tidak boleh ditutup lagi
  if (session.status === "CLOSED") {
    throw new AttendanceSessionClosedError(attendanceSessionId);
  }

  // 6. Invariant: Semua siswa yang eligible wajib memiliki catatan kehadiran
  let eligibleStudentIds: string[] = [];
  if (session.context === "LIVING" && session.dormitoryRoomId) {
    const activeAssignments = await prisma.studentDormitoryAssignment.findMany({
      where: {
        institutionId: ctx.institutionId,
        roomId: session.dormitoryRoomId,
        status: "ACTIVE",
      },
      select: {
        studentId: true,
      },
    });
    eligibleStudentIds = activeAssignments.map((a) => a.studentId);
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
        studentId: true,
      },
    });
    eligibleStudentIds = eligibleEnrollments.map((e) => e.studentId);
  }

  const recordedStudentIds = new Set(session.records.map((r) => r.studentId));
  const missingStudents = eligibleStudentIds.filter((id) => !recordedStudentIds.has(id));

  if (missingStudents.length > 0) {
    throw new AttendanceIncompleteError(
      missingStudents.length,
      `Sesi absensi tidak dapat ditutup: Masih ada ${missingStudents.length} santri/siswa yang belum dicatat kehadirannya.`
    );
  }

  // 7. Eksekusi Penutupan Sesi (Kunci Status menjadi CLOSED & Rekam Timestamp closedAt)
  const updatedSession = await prisma.attendanceSession.update({
    where: {
      id_institutionId: {
        id: attendanceSessionId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
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
    },
  });

  // 8. POST-CLOSE: Automated Communication Outbox Integration
  // Sesi sudah resmi CLOSED. Sekarang proses notifikasi kehadiran untuk siswa yang tidak hadir.
  // HANYA proses status: ABSENT, SICK, EXCUSED (JANGAN kirim notifikasi untuk PRESENT).
  // Kegagalan notifikasi santri manapun TIDAK BOLEH membatalkan status penutupan sesi (defensive boundary).
  try {
    const alertRecords = await prisma.attendanceRecord.findMany({
      where: {
        attendanceSessionId: updatedSession.id,
        institutionId: ctx.institutionId,
        status: { in: ["ABSENT", "SICK", "EXCUSED"] },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    const subjectName = updatedSession.teacherAssignment?.subject?.name || undefined;
    const attendanceDateFormatted = updatedSession.attendanceDate
      ? new Date(updatedSession.attendanceDate).toLocaleDateString("id-ID")
      : new Date().toLocaleDateString("id-ID");

    for (const record of alertRecords) {
      try {
        const recipientPhone = await resolveGuardianPhone(
          ctx.institutionId,
          record.studentId,
          prisma
        );

        if (recipientPhone) {
          await notifyAttendanceAlert({
            recipientPhone,
            studentName: record.student.fullName,
            status: record.status as "ABSENT" | "SICK" | "EXCUSED",
            date: attendanceDateFormatted,
            subjectName,
            idempotencyKey: `attendance:${updatedSession.id}:${record.studentId}`,
          });
        }
      } catch (studentError) {
        // Error boundary per siswa: satu siswa gagal, siswa lain tetap diproses
        console.error(
          `[AttendanceService] Non-fatal notification error for student ${record.studentId}:`,
          studentError
        );
      }
    }
  } catch (outboxError) {
    // Error boundary level sesi: sesi tetap berstatus CLOSED
    console.error(
      "[AttendanceService] Non-fatal attendance notification enqueue error:",
      outboxError
    );
  }

  return updatedSession;
}

/**
 * Membuka sesi absensi asrama santri (Living Attendance Session).
 */
export async function createLivingAttendanceSession(
  ctx: TenantContext,
  rawInput: unknown
): Promise<AttendanceSession> {
  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Zod Validation
  const validated = validateCreateLivingAttendanceSessionInput(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx);

  // 4. Verifikasi Kamar Asrama ada dan milik tenant
  const room = await prisma.dormitoryRoom.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.dormitoryRoomId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      dormitory: true,
    },
  });

  if (!room) {
    throw new ResourceNotFoundError("Kamar Asrama", sanitized.dormitoryRoomId);
  }

  // 5. Invariant: 1 Sesi per Kamar per Hari Kalender
  const existingSession = await prisma.attendanceSession.findFirst({
    where: {
      institutionId: ctx.institutionId,
      dormitoryRoomId: sanitized.dormitoryRoomId,
      attendanceDate: sanitized.attendanceDate,
      context: "LIVING",
    },
  });

  if (existingSession) {
    throw new LivingAttendanceSessionAlreadyExistsError(
      sanitized.dormitoryRoomId,
      formatAttendanceDate(sanitized.attendanceDate)
    );
  }

  // 6. Eksekusi Pembuatan Sesi
  return prisma.attendanceSession.create({
    data: {
      institutionId: ctx.institutionId,
      dormitoryRoomId: sanitized.dormitoryRoomId,
      context: "LIVING",
      attendanceDate: sanitized.attendanceDate,
      status: "OPEN",
    },
    include: {
      dormitoryRoom: {
        include: {
          dormitory: true,
        },
      },
    },
  });
}
