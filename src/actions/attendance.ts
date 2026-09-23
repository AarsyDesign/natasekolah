"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createAttendanceSession,
  createLivingAttendanceSession,
  getAttendanceSession,
  listAttendanceSessions,
  closeAttendanceSession,
  getAttendanceRoster,
  markAttendance,
  markAttendanceBatch,
  getAttendanceRecords,
  normalizeAttendanceDate,
  formatAttendanceDate,
} from "../lib/attendance";
import { listTeacherAssignments } from "../lib/teaching";
import { prisma } from "../lib/prisma";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

/**
 * Mengambil daftar penugasan mengajar hari ini beserta status sesi absensinya.
 */
export async function getTodayAssignmentsWithAttendanceAction(targetDateStr?: string) {
  try {
    const ctx = await getContext();
    const targetDate = targetDateStr ? normalizeAttendanceDate(targetDateStr) : normalizeAttendanceDate(new Date());

    // Ambil assignment yang relevan dengan hak akses (guru hanya miliknya, admin semua)
    const assignmentsResult = await listTeacherAssignments(ctx, { pageSize: 100 });
    const assignments = assignmentsResult.items;

    // Cari sesi absensi yang sudah ada pada tanggal ini untuk penugasan-penugasan tersebut
    const assignmentIds = assignments.map((a) => a.id);
    const existingSessions = await prisma.attendanceSession.findMany({
      where: {
        institutionId: ctx.institutionId,
        teacherAssignmentId: { in: assignmentIds },
        attendanceDate: targetDate,
      },
      include: {
        records: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const sessionByAssignmentId = new Map(existingSessions.map((s) => [s.teacherAssignmentId, s]));

    const result = assignments.map((a) => {
      const session = sessionByAssignmentId.get(a.id);
      return {
        assignment: a,
        session: session
          ? {
              id: session.id,
              status: session.status,
              openedAt: session.openedAt,
              closedAt: session.closedAt,
              recordCount: session.records.length,
            }
          : null,
      };
    });

    return {
      success: true,
      data: {
        dateStr: formatAttendanceDate(targetDate),
        items: result,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar absensi hari ini.",
    };
  }
}

export async function createAttendanceSessionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const session = await createAttendanceSession(ctx, input);
    revalidatePath("/attendance");
    revalidatePath("/attendance/history");
    return { success: true, data: session };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat sesi absensi.",
    };
  }
}

export async function getAttendanceSessionAction(sessionId: string) {
  try {
    const ctx = await getContext();
    const session = await getAttendanceSession(ctx, sessionId);
    return { success: true, data: session };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat sesi absensi.",
    };
  }
}

export async function getAttendanceRosterAction(sessionId: string) {
  try {
    const ctx = await getContext();
    const roster = await getAttendanceRoster(ctx, sessionId);
    return { success: true, data: roster };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar siswa absensi.",
    };
  }
}

export async function markAttendanceAction(input: unknown) {
  try {
    const ctx = await getContext();
    const record = await markAttendance(ctx, input);
    revalidatePath("/attendance");
    return { success: true, data: record };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mencatat kehadiran.",
    };
  }
}

export async function markAttendanceBatchAction(input: unknown) {
  try {
    const ctx = await getContext();
    const result = await markAttendanceBatch(ctx, input);
    revalidatePath("/attendance");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mencatat kehadiran massal.",
    };
  }
}

export async function closeAttendanceSessionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const session = await closeAttendanceSession(ctx, input);
    revalidatePath("/attendance");
    revalidatePath("/attendance/history");
    return { success: true, data: session };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menutup sesi absensi.",
    };
  }
}

export async function listAttendanceSessionsAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await listAttendanceSessions(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat histori absensi.",
    };
  }
}

export async function createLivingAttendanceSessionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const session = await createLivingAttendanceSession(ctx, input);
    revalidatePath("/attendance");
    revalidatePath("/dormitories");
    return { success: true, data: session };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuka sesi absensi asrama.",
    };
  }
}
