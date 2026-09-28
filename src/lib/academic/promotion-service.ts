import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { sanitizeClientInput } from "../tenant/guard";
import {
  validatePreviewBulkPromotionInput,
  validateExecuteBulkPromotionInput,
  validatePromotionCandidateFilter,
} from "../validation/promotion";
import {
  ResourceNotFoundError,
  AcademicYearMismatchError,
  DuplicateEnrollmentError,
} from "./types";
import {
  PromotionPreviewSummary,
  PromotionPreviewRow,
  PromotionExecutionResult,
  PromotionValidationError,
} from "./promotion-types";

/**
 * Layanan Domain Kenaikan Kelas Massal (Bulk Promotion Workflow) NataSekolah.
 *
 * PRINSIP INTEGRITAS SAKRAL:
 * 1. Historical Data Sacred: Tidak pernah menghapus atau mengubah rekaman enrollment tahun ajaran sebelumnya.
 * 2. Invarian Database: 1 siswa hanya memiliki 1 rombel per tahun ajaran (@@unique([studentId, academicYearId])).
 * 3. Batas Tenant Mutlak: Seluruh entitas (Tahun Ajaran, Rombel, Siswa, Enrollment, AuditLog) terisolasi pada ctx.institutionId.
 * 4. Atomisitas Transaksional: Seluruh proses promosi dieksekusi dalam transaksi atomik dengan pencatatan AuditLog resmi.
 */

/**
 * 1. Ambil daftar calon siswa kenaikan kelas dengan filter, pencarian, dan paginasi.
 */
export async function getPromotionCandidates(
  ctx: TenantContext,
  rawQuery: unknown
) {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Validasi input
  const filter = validatePromotionCandidateFilter(rawQuery);

  // 3. Verifikasi Tahun Ajaran Asal milik tenant
  const sourceYear = await prisma.academicYear.findUnique({
    where: {
      id_institutionId: {
        id: filter.sourceAcademicYearId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!sourceYear) {
    throw new ResourceNotFoundError("Tahun Ajaran Asal", filter.sourceAcademicYearId);
  }

  // 4. Jika ada rombel asal, verifikasi kepemilikan dan relasi tahun ajaran
  if (filter.sourceClassroomId) {
    const sourceRoom = await prisma.classroom.findUnique({
      where: {
        id_institutionId: {
          id: filter.sourceClassroomId,
          institutionId: ctx.institutionId,
        },
      },
    });

    if (!sourceRoom) {
      throw new ResourceNotFoundError("Rombel Asal", filter.sourceClassroomId);
    }

    if (sourceRoom.academicYearId !== filter.sourceAcademicYearId) {
      throw new AcademicYearMismatchError(
        sourceRoom.id,
        sourceRoom.academicYearId,
        filter.sourceAcademicYearId
      );
    }
  }

  // 5. Susun query where terisolasi tenant
  const where: any = {
    institutionId: ctx.institutionId,
    academicYearId: filter.sourceAcademicYearId,
    ...(filter.sourceClassroomId ? { classroomId: filter.sourceClassroomId } : {}),
  };

  if (filter.search) {
    where.student = {
      OR: [
        { fullName: { contains: filter.search, mode: "insensitive" } },
        { nis: { contains: filter.search, mode: "insensitive" } },
        { nisn: { contains: filter.search, mode: "insensitive" } },
      ],
    };
  }

  const skip = (filter.page - 1) * filter.pageSize;
  const take = filter.pageSize;

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      include: {
        student: true,
        classroom: true,
      },
      orderBy: [
        { classroom: { name: "asc" } },
        { student: { fullName: "asc" } },
      ],
    }),
    prisma.enrollment.count({ where }),
  ]);

  // 6. Jika tahun ajaran target diberikan, periksa apakah siswa sudah memiliki enrollment di target
  let targetEnrolledStudentIds = new Set<string>();
  if (filter.targetAcademicYearId && enrollments.length > 0) {
    const studentIds = enrollments.map((e) => e.studentId);
    const existingTargetEnrollments = await prisma.enrollment.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: filter.targetAcademicYearId,
        studentId: { in: studentIds },
      },
      select: { studentId: true },
    });
    targetEnrolledStudentIds = new Set(existingTargetEnrollments.map((e) => e.studentId));
  }

  const items = enrollments.map((e) => ({
    studentId: e.studentId,
    fullName: e.student.fullName,
    nis: e.student.nis,
    nisn: e.student.nisn,
    gender: e.student.gender,
    status: e.student.status,
    classroomId: e.classroomId,
    classroomName: e.classroom.name,
    gradeLevel: e.classroom.gradeLevel,
    isAlreadyEnrolledInTarget: targetEnrolledStudentIds.has(e.studentId),
  }));

  return {
    data: items,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
  };
}

/**
 * 2. Prapinjau Kenaikan Kelas Massal (Review & Preview Validation).
 * Melakukan validasi menyeluruh tanpa mutasi database.
 */
export async function previewBulkPromotion(
  ctx: TenantContext,
  rawInput: unknown
): Promise<PromotionPreviewSummary> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation & Sanitasi
  const validated = validatePreviewBulkPromotionInput(rawInput);
  const sanitized = sanitizeClientInput(validated, ctx);

  // 3. Verifikasi Tahun Ajaran Asal & Target
  const [sourceYear, targetYear] = await Promise.all([
    prisma.academicYear.findUnique({
      where: {
        id_institutionId: {
          id: sanitized.sourceAcademicYearId,
          institutionId: ctx.institutionId,
        },
      },
    }),
    prisma.academicYear.findUnique({
      where: {
        id_institutionId: {
          id: sanitized.targetAcademicYearId,
          institutionId: ctx.institutionId,
        },
      },
    }),
  ]);

  if (!sourceYear) {
    throw new ResourceNotFoundError("Tahun Ajaran Asal", sanitized.sourceAcademicYearId);
  }
  if (!targetYear) {
    throw new ResourceNotFoundError("Tahun Ajaran Target", sanitized.targetAcademicYearId);
  }

  // 4. Verifikasi seluruh Rombel Asal & Target
  const sourceRoomIds = Array.from(new Set(sanitized.classroomMappings.map((m) => m.sourceClassroomId)));
  const targetRoomIds = Array.from(new Set(sanitized.classroomMappings.map((m) => m.targetClassroomId)));

  const [sourceRooms, targetRooms] = await Promise.all([
    prisma.classroom.findMany({
      where: {
        institutionId: ctx.institutionId,
        id: { in: sourceRoomIds },
      },
    }),
    prisma.classroom.findMany({
      where: {
        institutionId: ctx.institutionId,
        id: { in: targetRoomIds },
      },
    }),
  ]);

  const sourceRoomMap = new Map(sourceRooms.map((r) => [r.id, r]));
  const targetRoomMap = new Map(targetRooms.map((r) => [r.id, r]));

  // Validasi pemetaan rombel
  for (const mapping of sanitized.classroomMappings) {
    const sRoom = sourceRoomMap.get(mapping.sourceClassroomId);
    if (!sRoom) {
      throw new ResourceNotFoundError("Rombel Asal", mapping.sourceClassroomId);
    }
    if (sRoom.academicYearId !== sanitized.sourceAcademicYearId) {
      throw new AcademicYearMismatchError(
        sRoom.id,
        sRoom.academicYearId,
        sanitized.sourceAcademicYearId
      );
    }

    const tRoom = targetRoomMap.get(mapping.targetClassroomId);
    if (!tRoom) {
      throw new ResourceNotFoundError("Rombel Target", mapping.targetClassroomId);
    }
    if (tRoom.academicYearId !== sanitized.targetAcademicYearId) {
      throw new AcademicYearMismatchError(
        tRoom.id,
        tRoom.academicYearId,
        sanitized.targetAcademicYearId
      );
    }
  }

  // Pemetaan cepat: sourceClassroomId -> targetClassroomId
  const mappingLookup = new Map<string, string>();
  for (const m of sanitized.classroomMappings) {
    mappingLookup.set(m.sourceClassroomId, m.targetClassroomId);
  }

  // 5. Ambil data enrollment siswa asal
  const candidateEnrollments = await prisma.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      academicYearId: sanitized.sourceAcademicYearId,
      classroomId: { in: sourceRoomIds },
      ...(sanitized.selectedStudentIds && sanitized.selectedStudentIds.length > 0
        ? { studentId: { in: sanitized.selectedStudentIds } }
        : {}),
    },
    include: {
      student: true,
      classroom: true,
    },
    orderBy: [
      { classroom: { name: "asc" } },
      { student: { fullName: "asc" } },
    ],
  });

  const candidateStudentIds = candidateEnrollments.map((e) => e.studentId);

  // 6. Cek apakah ada siswa yang SUDAH terdaftar di tahun ajaran target
  const existingTargetEnrollments = await prisma.enrollment.findMany({
    where: {
      institutionId: ctx.institutionId,
      academicYearId: sanitized.targetAcademicYearId,
      studentId: { in: candidateStudentIds },
    },
    include: {
      classroom: true,
    },
  });

  const existingTargetMap = new Map(
    existingTargetEnrollments.map((e) => [e.studentId, e.classroom.name])
  );

  // 7. Evaluasi kesiapan tiap siswa (READY, WARNING, ERROR)
  const rows: PromotionPreviewRow[] = [];
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const enrollment of candidateEnrollments) {
    const student = enrollment.student;
    const targetRoomId = mappingLookup.get(enrollment.classroomId);
    const targetRoom = targetRoomId ? targetRoomMap.get(targetRoomId) : null;

    let rowStatus: "READY" | "WARNING" | "ERROR" = "READY";
    let message: string | undefined = undefined;

    // Evaluasi ERROR: Target enrollment sudah ada
    if (existingTargetMap.has(student.id)) {
      rowStatus = "ERROR";
      const existingRoomName = existingTargetMap.get(student.id);
      message = `Target enrollment sudah ada untuk ${student.fullName} di rombel '${existingRoomName}'.`;
      errorCount++;
    } else if (!targetRoom) {
      rowStatus = "ERROR";
      message = `Rombel target tidak ditemukan untuk rombel asal '${enrollment.classroom.name}'.`;
      errorCount++;
    } else if (student.status !== "ACTIVE") {
      // Evaluasi WARNING: Status siswa bukan ACTIVE (misal INACTIVE, GRADUATED, TRANSFERRED)
      rowStatus = "WARNING";
      message = `Status kesiswaan saat ini '${student.status}' (bukan ACTIVE).`;
      warningCount++;
    } else {
      readyCount++;
    }

    rows.push({
      studentId: student.id,
      studentName: student.fullName,
      nis: student.nis,
      studentStatus: student.status,
      sourceClassroomId: enrollment.classroomId,
      sourceClassroomName: enrollment.classroom.name,
      targetClassroomId: targetRoomId || "",
      targetClassroomName: targetRoom ? targetRoom.name : "Belum Dipetakan",
      status: rowStatus,
      message,
    });
  }

  return {
    totalStudents: rows.length,
    readyCount,
    warningCount,
    errorCount,
    sourceAcademicYear: {
      id: sourceYear.id,
      name: sourceYear.name,
    },
    targetAcademicYear: {
      id: targetYear.id,
      name: targetYear.name,
    },
    rows,
  };
}

/**
 * 3. Eksekusi Kenaikan Kelas Massal (Atomic Transaction & Audit Log).
 */
export async function executeBulkPromotion(
  ctx: TenantContext,
  rawInput: unknown
): Promise<PromotionExecutionResult> {
  // 1. RBAC Guard
  requirePermission(ctx, "academic:manage");

  // 2. Zod Validation & Sanitasi
  const validated = validateExecuteBulkPromotionInput(rawInput);
  const sanitized = sanitizeClientInput(validated, ctx);

  // 3. Verifikasi Tahun Ajaran Asal & Target
  const [sourceYear, targetYear] = await Promise.all([
    prisma.academicYear.findUnique({
      where: {
        id_institutionId: {
          id: sanitized.sourceAcademicYearId,
          institutionId: ctx.institutionId,
        },
      },
    }),
    prisma.academicYear.findUnique({
      where: {
        id_institutionId: {
          id: sanitized.targetAcademicYearId,
          institutionId: ctx.institutionId,
        },
      },
    }),
  ]);

  if (!sourceYear) {
    throw new ResourceNotFoundError("Tahun Ajaran Asal", sanitized.sourceAcademicYearId);
  }
  if (!targetYear) {
    throw new ResourceNotFoundError("Tahun Ajaran Target", sanitized.targetAcademicYearId);
  }

  // 4. Verifikasi seluruh Rombel Target
  const targetRoomIds = Array.from(new Set(sanitized.promotions.map((p) => p.targetClassroomId)));
  const targetRooms = await prisma.classroom.findMany({
    where: {
      institutionId: ctx.institutionId,
      id: { in: targetRoomIds },
    },
  });

  const targetRoomMap = new Map(targetRooms.map((r) => [r.id, r]));

  for (const roomId of targetRoomIds) {
    const room = targetRoomMap.get(roomId);
    if (!room) {
      throw new ResourceNotFoundError("Rombel Target", roomId);
    }
    if (room.academicYearId !== sanitized.targetAcademicYearId) {
      throw new AcademicYearMismatchError(
        room.id,
        room.academicYearId,
        sanitized.targetAcademicYearId
      );
    }
  }

  // 5. Verifikasi seluruh Siswa dan Enrollment Asal
  const studentIds = sanitized.promotions.map((p) => p.studentId);
  const [students, sourceEnrollments] = await Promise.all([
    prisma.student.findMany({
      where: {
        institutionId: ctx.institutionId,
        id: { in: studentIds },
      },
    }),
    prisma.enrollment.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: sanitized.sourceAcademicYearId,
        studentId: { in: studentIds },
      },
      include: {
        classroom: true,
      },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const sourceEnrollmentMap = new Map(sourceEnrollments.map((e) => [e.studentId, e]));

  // Validasi pra-transaksi
  const validationErrors: string[] = [];

  for (const item of sanitized.promotions) {
    const student = studentMap.get(item.studentId);
    if (!student) {
      validationErrors.push(`Siswa dengan ID '${item.studentId}' tidak ditemukan di lembaga ini.`);
      continue;
    }

    const sourceEnrollment = sourceEnrollmentMap.get(item.studentId);
    if (!sourceEnrollment) {
      validationErrors.push(`Siswa '${student.fullName}' (${student.nis}) tidak memiliki enrollment di tahun ajaran asal.`);
      continue;
    }

    if (!sanitized.allowWarnings && student.status !== "ACTIVE") {
      validationErrors.push(`Siswa '${student.fullName}' berstatus '${student.status}'. Operasi dibatalkan karena tidak mengizinkan warning.`);
    }
  }

  if (validationErrors.length > 0) {
    throw new PromotionValidationError(
      `Validasi kenaikan kelas gagal: ${validationErrors.join("; ")}`,
      validationErrors
    );
  }

  // 6. Transaksi Atomik: Cek Idempotency, Buat Enrollment Baru, Catat AuditLog
  return prisma.$transaction(async (tx) => {
    // 6.1 Idempotency Check: Pastikan tidak ada yang sudah terdaftar di target
    const existingTargetEnrollments = await tx.enrollment.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: sanitized.targetAcademicYearId,
        studentId: { in: studentIds },
      },
      include: {
        student: true,
        classroom: true,
      },
    });

    if (existingTargetEnrollments.length > 0) {
      const conflict = existingTargetEnrollments[0];
      throw new DuplicateEnrollmentError(
        conflict.student.fullName || conflict.studentId,
        targetYear.name
      );
    }

    // 6.2 Buat Enrollment Baru untuk setiap siswa
    // Historical Data Sacred: Rekaman lama di sourceYear tetap utuh dan tidak ditimpa
    const createdEnrollments = [];
    const executionItems = [];

    for (const item of sanitized.promotions) {
      const student = studentMap.get(item.studentId)!;

      const newEnrollment = await tx.enrollment.create({
        data: {
          institutionId: ctx.institutionId,
          studentId: item.studentId,
          academicYearId: sanitized.targetAcademicYearId,
          classroomId: item.targetClassroomId,
          status: "ENROLLED",
          enrolledAt: new Date(),
        },
      });

      createdEnrollments.push(newEnrollment);
      executionItems.push({
        studentId: item.studentId,
        studentName: student.fullName,
        targetClassroomId: item.targetClassroomId,
        status: "PROMOTED" as const,
      });
    }

    // 6.3 Catat riwayat ke AuditLog resmi lembaga
    const audit = await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: ctx.userId || null,
        action: "BULK_PROMOTION",
        entityType: "Enrollment",
        detailsJson: JSON.stringify({
          sourceAcademicYearId: sanitized.sourceAcademicYearId,
          sourceAcademicYearName: sourceYear.name,
          targetAcademicYearId: sanitized.targetAcademicYearId,
          targetAcademicYearName: targetYear.name,
          totalPromoted: executionItems.length,
          promotions: executionItems.map((e) => ({
            studentId: e.studentId,
            studentName: e.studentName,
            targetClassroomId: e.targetClassroomId,
          })),
        }),
      },
    });

    return {
      success: true,
      totalPromoted: executionItems.length,
      sourceAcademicYearId: sanitized.sourceAcademicYearId,
      targetAcademicYearId: sanitized.targetAcademicYearId,
      items: executionItems,
      auditLogId: audit.id,
    };
  });
}
