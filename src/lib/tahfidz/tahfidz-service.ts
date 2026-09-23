import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ResourceNotFoundError } from "../academic";
import {
  TahfidzRecordNotFoundError,
  InvalidAyahRangeError,
  StudentEnrollmentMismatchError,
} from "./types";
import { validateAyahRange } from "./quran";
import {
  validateCreateTahfidzRecordInput,
  validateTahfidzRecordFilter,
} from "../validation/tahfidz";
import type { TahfidzRecord, Prisma } from "@prisma/client";

export interface TahfidzSummaryResult {
  studentId: string;
  studentName: string;
  totalSetoran: number;
  totalMurajaah: number;
  lastSurah: string | null;
  lastSurahNumber: number | null;
  lastAyah: number | null;
  lastDate: Date | null;
  latestRecord: TahfidzRecord | null;
}

/**
 * Mencatat mutaba'ah hafalan santri (Ziyadah/Setoran baru atau Muraja'ah).
 */
export async function createTahfidzRecord(
  ctx: TenantContext,
  rawInput: unknown,
  tx: any = prisma
): Promise<TahfidzRecord> {
  // 1. RBAC Guard: Memerlukan izin tahfidz:manage
  requirePermission(ctx, "tahfidz:manage");

  // 2. Zod Validation
  const validated = validateCreateTahfidzRecordInput(rawInput);

  // 3. Verifikasi Keberadaan Santri dalam Tenant
  const student = await tx.student.findUnique({
    where: {
      id_institutionId: {
        id: validated.studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Santri", validated.studentId);
  }

  // 4. Verifikasi Keberadaan Enrollment dalam Tenant
  const enrollment = await tx.enrollment.findUnique({
    where: {
      id_institutionId: {
        id: validated.enrollmentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!enrollment) {
    throw new ResourceNotFoundError("Enrollment", validated.enrollmentId);
  }

  // 5. Invariant: Enrollment harus cocok dengan santri
  if (enrollment.studentId !== student.id) {
    throw new StudentEnrollmentMismatchError(student.id, enrollment.id);
  }

  // 6. Validasi Rentang Ayat Al-Qur'an
  const ayahValidation = validateAyahRange(
    validated.surah,
    validated.startAyah,
    validated.endAyah
  );

  if (!ayahValidation.isValid) {
    throw new InvalidAyahRangeError(
      ayahValidation.errorMessage ?? "Rentang ayat tidak valid"
    );
  }

  // 7. Simpan Rekaman Tahfidz dengan recordedBy dari Identitas Sesi
  return tx.tahfidzRecord.create({
    data: {
      institutionId: ctx.institutionId,
      studentId: student.id,
      enrollmentId: enrollment.id,
      date: validated.date,
      surah: validated.surah,
      surahName: ayahValidation.surahName,
      startAyah: validated.startAyah,
      endAyah: validated.endAyah,
      type: validated.type,
      quality: validated.quality,
      note: validated.note,
      recordedBy: ctx.userId,
    },
  });
}

/**
 * Mengambil rekaman mutaba'ah tahfidz berdasarkan ID.
 */
export async function getTahfidzRecordById(
  ctx: TenantContext,
  id: string,
  tx: any = prisma
): Promise<TahfidzRecord> {
  requirePermission(ctx, "tahfidz:view");

  const record = await tx.tahfidzRecord.findUnique({
    where: {
      id_institutionId: {
        id,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      enrollment: {
        include: {
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
      recorder: { select: { id: true, name: true, email: true } },
    },
  });

  if (!record) {
    throw new TahfidzRecordNotFoundError(id);
  }

  return record;
}

/**
 * Mendapatkan daftar rekaman mutaba'ah dengan filter dan paginasi.
 */
export async function listTahfidzRecords(
  ctx: TenantContext,
  filter?: unknown,
  tx: any = prisma
): Promise<TahfidzRecord[]> {
  requirePermission(ctx, "tahfidz:view");

  const validated = filter ? validateTahfidzRecordFilter(filter) : {};

  const whereClause: Prisma.TahfidzRecordWhereInput = {
    institutionId: ctx.institutionId,
    ...(validated.studentId ? { studentId: validated.studentId } : {}),
    ...(validated.enrollmentId ? { enrollmentId: validated.enrollmentId } : {}),
    ...(validated.type ? { type: validated.type } : {}),
    ...(validated.quality ? { quality: validated.quality } : {}),
    ...(validated.dateFrom || validated.dateTo
      ? {
          date: {
            ...(validated.dateFrom ? { gte: validated.dateFrom } : {}),
            ...(validated.dateTo ? { lte: validated.dateTo } : {}),
          },
        }
      : {}),
  };

  return tx.tahfidzRecord.findMany({
    where: whereClause,
    orderBy: { date: "desc" },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      enrollment: {
        include: {
          classroom: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
      recorder: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Menghitung ringkasan capaian tahfidz santri.
 */
export async function getTahfidzSummary(
  ctx: TenantContext,
  studentId: string,
  tx: any = prisma
): Promise<TahfidzSummaryResult> {
  requirePermission(ctx, "tahfidz:view");

  // 1. Verifikasi santri
  const student = await tx.student.findUnique({
    where: {
      id_institutionId: {
        id: studentId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!student) {
    throw new ResourceNotFoundError("Santri", studentId);
  }

  // 2. Hitung total setoran & muraja'ah
  const [totalSetoran, totalMurajaah, latestRecords] = await Promise.all([
    tx.tahfidzRecord.count({
      where: {
        institutionId: ctx.institutionId,
        studentId,
        type: "SETORAN",
      },
    }),
    tx.tahfidzRecord.count({
      where: {
        institutionId: ctx.institutionId,
        studentId,
        type: "MURAJAAH",
      },
    }),
    tx.tahfidzRecord.findMany({
      where: {
        institutionId: ctx.institutionId,
        studentId,
      },
      orderBy: { date: "desc" },
      take: 1,
    }),
  ]);

  const latestRecord = latestRecords[0] ?? null;

  return {
    studentId: student.id,
    studentName: student.fullName,
    totalSetoran,
    totalMurajaah,
    lastSurah: latestRecord?.surahName ?? null,
    lastSurahNumber: latestRecord?.surah ?? null,
    lastAyah: latestRecord?.endAyah ?? null,
    lastDate: latestRecord?.date ?? null,
    latestRecord,
  };
}
