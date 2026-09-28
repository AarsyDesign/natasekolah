import { z } from "zod";
import { prisma } from "../../prisma";
import type { TenantContext } from "../../tenant/context";
import { requirePermission, hasPermission } from "../../auth/permissions";
import { sanitizeClientInput } from "../../tenant/guard";
import {
  AttendanceAccessDeniedError,
  ResourceNotFoundError,
  AttendanceStatus,
} from "../types";
import { BatchSyncInput, BatchSyncResult, BatchSyncItemResult } from "./types";

export const batchSyncInputSchema = z.object({
  sessionId: z.string().trim().min(1, "ID sesi wajib diisi"),
  mutations: z
    .array(
      z.object({
        clientMutationId: z.string().trim().min(1, "Client mutation ID wajib"),
        sessionId: z.string().trim().min(1, "ID sesi wajib"),
        studentId: z.string().trim().min(1, "ID siswa wajib"),
        status: z.enum(["PRESENT", "EXCUSED", "SICK", "ABSENT"]),
        note: z.string().trim().max(500).optional().nullable(),
        baseUpdatedAt: z.string().optional().nullable(),
        clientTimestamp: z.string().optional().nullable(),
        forceOverwrite: z.boolean().optional().default(false),
      })
    )
    .min(1, "Minimal sertakan 1 mutasi presensi"),
});

export async function syncAttendanceBatch(
  ctx: TenantContext,
  rawInput: unknown,
  txPrisma?: typeof prisma
): Promise<BatchSyncResult> {
  const db = txPrisma || prisma;

  // 1. RBAC Guard: Memerlukan izin attendance:manage
  requirePermission(ctx, "attendance:manage");

  // 2. Zod Validation
  const validated = batchSyncInputSchema.parse(rawInput);

  // 3. Sanitasi Anti-Tampering
  const sanitized = sanitizeClientInput(validated, ctx) as BatchSyncInput;

  // 4. Verifikasi Sesi Absensi & Tenant Boundary
  const session = await db.attendanceSession.findUnique({
    where: {
      id_institutionId: {
        id: sanitized.sessionId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignment: true,
      dormitoryRoom: true,
    },
  });

  if (!session) {
    throw new ResourceNotFoundError("Sesi Absensi", sanitized.sessionId);
  }

  // 5. Resource Scope Guard: Guru hanya boleh menyinkronkan sesinya sendiri
  if (session.context === "LIVING") {
    // Living context: Authorized via attendance:manage
  } else if (session.teacherAssignment) {
    const isManager = hasPermission(ctx, "academic:manage");
    if (!isManager && session.teacherAssignment.teacherId !== ctx.userId) {
      throw new AttendanceAccessDeniedError(
        "Guru tidak diizinkan menyinkronkan catatan absensi milik guru lain."
      );
    }
  }

  // 6. Invariant: Sesi CLOSED bersifat KEKAL (immutable)
  if (session.status === "CLOSED") {
    const results: BatchSyncItemResult[] = sanitized.mutations.map((m) => ({
      clientMutationId: m.clientMutationId,
      studentId: m.studentId,
      status: "CONFLICT",
      message: "Sesi presensi sudah ditutup di server (status: CLOSED). Catatan kehadiran tidak dapat diubah lagi.",
    }));

    return {
      sessionId: session.id,
      processedCount: sanitized.mutations.length,
      syncedCount: 0,
      conflictCount: sanitized.mutations.length,
      rejectedCount: 0,
      results,
    };
  }

  // 7. Resolusi Enrollment yang sah pada rombel / asrama
  const enrollmentByStudentId = new Map<string, string>();

  if (session.context === "LIVING" && session.dormitoryRoomId) {
    const activeAssignments = await db.studentDormitoryAssignment.findMany({
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
  } else if (session.teacherAssignment) {
    const eligibleEnrollments = await db.enrollment.findMany({
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
  }

  // 8. Ambil seluruh record yang ada saat ini pada sesi untuk komparasi & deteksi konflik
  const existingRecords = await db.attendanceRecord.findMany({
    where: {
      attendanceSessionId: session.id,
      institutionId: ctx.institutionId,
    },
  });

  const recordByStudentId = new Map(existingRecords.map((r) => [r.studentId, r]));

  const results: BatchSyncItemResult[] = [];
  let syncedCount = 0;
  let conflictCount = 0;
  let rejectedCount = 0;

  for (const item of sanitized.mutations) {
    const enrollmentId = enrollmentByStudentId.get(item.studentId);

    // Verifikasi kelayakan siswa
    if (!enrollmentId) {
      rejectedCount++;
      results.push({
        clientMutationId: item.clientMutationId,
        studentId: item.studentId,
        status: "REJECTED",
        message: "Siswa bukan anggota terdaftar pada rombel dan tahun ajaran sesi ini.",
      });
      continue;
    }

    const existing = recordByStudentId.get(item.studentId);

    if (existing) {
      // Idempotency check: jika status dan catatan sudah sama persis
      const isAlreadySame =
        existing.status === item.status &&
        (item.note === undefined || item.note === null || existing.note === item.note);

      if (isAlreadySame) {
        syncedCount++;
        results.push({
          clientMutationId: item.clientMutationId,
          studentId: item.studentId,
          status: "SYNCED",
          recordId: existing.id,
          message: "Catatan kehadiran sudah mutakhir di server (idempotent).",
        });
        continue;
      }

      // Conflict Detection:
      // Jika server telah dimodifikasi setelah snapshot klien diambil dan status berbeda
      if (!item.forceOverwrite && item.baseUpdatedAt) {
        const clientBaseTime = new Date(item.baseUpdatedAt).getTime();
        const serverTime = existing.updatedAt.getTime();

        // Toleransi selisih 1 detik (1000ms) untuk pembulatan timestamp
        if (serverTime > clientBaseTime + 1000 && existing.status !== item.status) {
          conflictCount++;
          results.push({
            clientMutationId: item.clientMutationId,
            studentId: item.studentId,
            status: "CONFLICT",
            recordId: existing.id,
            serverStatus: existing.status as AttendanceStatus,
            serverUpdatedAt: existing.updatedAt.toISOString(),
            message: `Konflik: Data di server telah diubah menjadi ${existing.status} pada ${existing.updatedAt.toLocaleTimeString("id-ID")}.`,
          });
          continue;
        }
      }

      // Perbarui record yang ada
      const updated = await db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: item.status,
          note: item.note ?? existing.note,
          markedAt: new Date(),
        },
      });

      // Update in-memory map
      recordByStudentId.set(item.studentId, updated);
      syncedCount++;
      results.push({
        clientMutationId: item.clientMutationId,
        studentId: item.studentId,
        status: "SYNCED",
        recordId: updated.id,
      });
    } else {
      // Buat record baru
      const created = await db.attendanceRecord.create({
        data: {
          institutionId: ctx.institutionId,
          attendanceSessionId: session.id,
          studentId: item.studentId,
          enrollmentId,
          status: item.status,
          note: item.note ?? null,
          markedAt: new Date(),
        },
      });

      recordByStudentId.set(item.studentId, created);
      syncedCount++;
      results.push({
        clientMutationId: item.clientMutationId,
        studentId: item.studentId,
        status: "SYNCED",
        recordId: created.id,
      });
    }
  }

  return {
    sessionId: session.id,
    processedCount: sanitized.mutations.length,
    syncedCount,
    conflictCount,
    rejectedCount,
    results,
  };
}
