import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { parseSpreadsheetBuffer } from "./parser";
import { validateAndPreviewImportRows } from "./validator";
import type {
  ImportPreviewResult,
  ImportExecutionResult,
  SanitizedStudentImportData,
} from "./types";

/**
 * Layanan Domain Master Data Importer NataSekolah.
 *
 * Menerapkan prinsip ketat:
 * 1. RBAC Guard (student:create)
 * 2. Tenant Isolation mutlak dari context terautentikasi (ctx.institutionId)
 * 3. Atomic / chunked database transaction
 * 4. Sacred History Enrollment terjaga
 * 5. Outbox & Audit Logging
 */

export async function generateStudentImportPreview(
  ctx: TenantContext,
  fileBuffer: Buffer | Uint8Array,
  fileName: string
): Promise<ImportPreviewResult> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:create");

  // 2. Parse file spreadsheet
  const { rawRows } = parseSpreadsheetBuffer(fileBuffer, fileName);

  if (rawRows.length === 0) {
    return {
      fileName,
      summary: {
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        errorRows: 0,
        newRecords: 0,
        exactDuplicates: 0,
        potentialDuplicates: 0,
      },
      rows: [],
      canProceed: false,
    };
  }

  // Batasi ukuran baris per import untuk proteksi resource (maks 1000 baris per batch)
  if (rawRows.length > 1000) {
    throw new Error(
      `File berisi ${rawRows.length} baris. Batas maksimum impor adalah 1.000 baris per file.`
    );
  }

  // 3. Sanitasi, Validasi Zod, dan Deteksi Duplikasi
  const { rows, summary, canProceed } = await validateAndPreviewImportRows(
    ctx,
    rawRows
  );

  return {
    fileName,
    summary,
    rows,
    canProceed,
  };
}

/**
 * Mengeksekusi impor data siswa yang telah disetujui (Confirmed) oleh pengguna.
 */
export async function executeStudentImport(
  ctx: TenantContext,
  itemsToImport: SanitizedStudentImportData[]
): Promise<ImportExecutionResult> {
  // 1. RBAC Guard
  requirePermission(ctx, "student:create");

  if (!itemsToImport || itemsToImport.length === 0) {
    return {
      totalProcessed: 0,
      createdStudents: 0,
      createdGuardians: 0,
      linkedEnrollments: 0,
      skippedDuplicates: 0,
      failedRows: 0,
      details: [],
    };
  }

  // 2. Ambil Tahun Ajaran Aktif untuk penempatan kelas otomatis (jika ada classroomName)
  const activeYear = await prisma.academicYear.findFirst({
    where: {
      institutionId: ctx.institutionId,
      isActive: true,
    },
  });

  // Ambil mapping nama kelas ke id kelas pada tahun ajaran aktif
  const classroomMap = new Map<string, string>();
  if (activeYear) {
    const classrooms = await prisma.classroom.findMany({
      where: {
        institutionId: ctx.institutionId,
        academicYearId: activeYear.id,
      },
      select: { id: true, name: true },
    });
    for (const c of classrooms) {
      classroomMap.set(c.name.trim().toLowerCase(), c.id);
    }
  }

  // 3. Eksekusi Impor dalam Prisma Transaction
  return await prisma.$transaction(async (tx) => {
    let createdStudents = 0;
    let createdGuardians = 0;
    let linkedEnrollments = 0;
    let skippedDuplicates = 0;
    let failedRows = 0;
    const details: ImportExecutionResult["details"] = [];

    for (let i = 0; i < itemsToImport.length; i++) {
      const item = itemsToImport[i];
      const rowNumber = i + 1;

      try {
        // Cek duplikasi NIS dalam tenant (Race-condition safety)
        const existingStudent = await tx.student.findUnique({
          where: {
            institutionId_nis: {
              institutionId: ctx.institutionId,
              nis: item.nis,
            },
          },
        });

        if (existingStudent) {
          skippedDuplicates++;
          details.push({
            rowNumber,
            studentNis: item.nis,
            studentName: item.fullName,
            status: "SKIPPED",
            message: `NIS '${item.nis}' sudah ada di database`,
          });
          continue;
        }

        // Buat record Student baru
        const student = await tx.student.create({
          data: {
            institutionId: ctx.institutionId,
            nis: item.nis,
            nisn: item.nisn || null,
            nik: item.nik || null,
            fullName: item.fullName,
            nickname: item.nickname || null,
            gender: item.gender || "L",
            birthPlace: item.birthPlace || null,
            birthDate: item.birthDate ? new Date(item.birthDate) : null,
            religion: item.religion || null,
            address: item.address || null,
            phone: item.phone || null,
            email: item.email || null,
            parentWaPhone: item.guardianPhoneWa || null,
            status: "ACTIVE",
          },
        });
        createdStudents++;

        // Relasi Wali Murid jika diisi
        if (item.guardianName && item.guardianPhoneWa) {
          // Cari apakah wali dengan nomor WA ini sudah ada di institusi
          let guardian = await tx.guardian.findFirst({
            where: {
              institutionId: ctx.institutionId,
              phoneWa: item.guardianPhoneWa,
            },
          });

          if (!guardian) {
            guardian = await tx.guardian.create({
              data: {
                institutionId: ctx.institutionId,
                fullName: item.guardianName,
                phoneWa: item.guardianPhoneWa,
                status: "INVITED",
              },
            });
            createdGuardians++;
          }

          // Hubungkan Wali ke Siswa (GuardianStudent)
          await tx.guardianStudent.create({
            data: {
              institutionId: ctx.institutionId,
              guardianId: guardian.id,
              studentId: student.id,
              relationship: item.guardianRelationship || "WALI",
              isPrimary: true,
            },
          });
        }

        // Penempatan Rombel (Enrollment Sacred History) jika diisi
        if (item.classroomName && activeYear) {
          const classroomId = classroomMap.get(
            item.classroomName.trim().toLowerCase()
          );

          if (classroomId) {
            await tx.enrollment.create({
              data: {
                institutionId: ctx.institutionId,
                studentId: student.id,
                academicYearId: activeYear.id,
                classroomId: classroomId,
                status: "ENROLLED",
                enrolledAt: new Date(),
              },
            });
            linkedEnrollments++;
          }
        }

        details.push({
          rowNumber,
          studentNis: item.nis,
          studentName: item.fullName,
          status: "CREATED",
        });
      } catch (err: unknown) {
        failedRows++;
        details.push({
          rowNumber,
          studentNis: item.nis,
          studentName: item.fullName,
          status: "FAILED",
          message: err instanceof Error ? err.message : "Gagal menyimpan",
        });
      }
    }

    // 4. Catat ke AuditLog
    let validUserId: string | null = null;
    if (ctx.userId) {
      const userExists = await tx.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true },
      });
      if (userExists) {
        validUserId = ctx.userId;
      }
    }

    await tx.auditLog.create({
      data: {
        institutionId: ctx.institutionId,
        userId: validUserId,
        action: "IMPORT",
        entityType: "Student",
        detailsJson: JSON.stringify({
          totalProcessed: itemsToImport.length,
          createdStudents,
          createdGuardians,
          linkedEnrollments,
          skippedDuplicates,
          failedRows,
        }),
      },
    });

    return {
      totalProcessed: itemsToImport.length,
      createdStudents,
      createdGuardians,
      linkedEnrollments,
      skippedDuplicates,
      failedRows,
      details,
    };
  });
}
