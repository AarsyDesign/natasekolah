import { z } from "zod";
import { idSchema, validate } from "./common";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_SESSION_STATUSES,
  normalizeAttendanceDate,
} from "../attendance/types";

/**
 * Skema validasi pembukaan Sesi Absensi (AttendanceSession).
 */
export const createAttendanceSessionInputSchema = z.object({
  teacherAssignmentId: idSchema,
  attendanceDate: z
    .union([
      z.string().trim().regex(/^\d{4}-\d{2}-\d{2}/, "Format tanggal absensi harus YYYY-MM-DD"),
      z.date(),
    ])
    .transform((val) => normalizeAttendanceDate(val)),
});

export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionInputSchema>;

/**
 * Skema validasi pencatatan kehadiran satu siswa (AttendanceRecord).
 */
export const markAttendanceInputSchema = z.object({
  attendanceSessionId: idSchema,
  studentId: idSchema,
  status: z.enum(ATTENDANCE_STATUSES, {
    message: "Status kehadiran tidak valid. Pilihan: PRESENT, EXCUSED, SICK, ABSENT",
  }),
  note: z
    .string()
    .trim()
    .max(255, "Catatan maksimal 255 karakter")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceInputSchema>;

/**
 * Skema validasi pencatatan kehadiran rombel secara massal (Batch Attendance Marking).
 */
export const markAttendanceBatchInputSchema = z.object({
  attendanceSessionId: idSchema,
  records: z
    .array(
      z.object({
        studentId: idSchema,
        status: z.enum(ATTENDANCE_STATUSES, {
          message: "Status kehadiran tidak valid. Pilihan: PRESENT, EXCUSED, SICK, ABSENT",
        }),
        note: z
          .string()
          .trim()
          .max(255, "Catatan maksimal 255 karakter")
          .optional()
          .or(z.literal(""))
          .transform((v) => (v === "" ? undefined : v)),
      })
    )
    .min(1, "Minimal 1 siswa dalam batch kehadiran"),
});

export type MarkAttendanceBatchInput = z.infer<typeof markAttendanceBatchInputSchema>;

/**
 * Skema penutupan sesi absensi.
 */
export const closeAttendanceSessionInputSchema = z.object({
  attendanceSessionId: idSchema,
});

export type CloseAttendanceSessionInput = z.infer<typeof closeAttendanceSessionInputSchema>;

/**
 * Skema query filter histori sesi absensi.
 */
export const attendanceQuerySchema = z.object({
  teacherAssignmentId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  classroomId: idSchema.optional(),
  subjectId: idSchema.optional(),
  teacherId: idSchema.optional(),
  status: z.enum(ATTENDANCE_SESSION_STATUSES).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

// Helper functions
export function validateCreateAttendanceSessionInput(input: unknown): CreateAttendanceSessionInput {
  return validate(createAttendanceSessionInputSchema, input);
}

export function validateMarkAttendanceInput(input: unknown): MarkAttendanceInput {
  return validate(markAttendanceInputSchema, input);
}

export function validateMarkAttendanceBatchInput(input: unknown): MarkAttendanceBatchInput {
  return validate(markAttendanceBatchInputSchema, input);
}

export function validateCloseAttendanceSessionInput(input: unknown): CloseAttendanceSessionInput {
  return validate(closeAttendanceSessionInputSchema, input);
}

export function validateAttendanceQuery(input: unknown): AttendanceQuery {
  return validate(attendanceQuerySchema, input);
}
