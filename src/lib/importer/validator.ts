import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { createStudentInputSchema } from "../validation/student";
import {
  cleanText,
  cleanIdentityNumber,
  cleanIndonesianPhone,
  cleanGender,
  cleanDate,
  cleanRelationship,
} from "./sanitizer";
import type {
  RawImportRow,
  PreviewRow,
  SanitizedStudentImportData,
  ImportPreviewSummary,
  ImportRowIssue,
} from "./types";

/**
 * Memvalidasi dan mendeteksi duplikasi baris-baris data dari spreadsheet.
 * Mengisolasi query ke tenant aktif (ctx.institutionId).
 */
export async function validateAndPreviewImportRows(
  ctx: TenantContext,
  rawRows: RawImportRow[]
): Promise<{
  rows: PreviewRow[];
  summary: ImportPreviewSummary;
  canProceed: boolean;
}> {
  if (rawRows.length === 0) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        errorRows: 0,
        newRecords: 0,
        exactDuplicates: 0,
        potentialDuplicates: 0,
      },
      canProceed: false,
    };
  }

  // 1. Ambil data siswa yang sudah ada di institusi ini untuk deteksi duplikasi efisien (in-memory lookup per tenant)
  const existingStudents = await prisma.student.findMany({
    where: {
      institutionId: ctx.institutionId,
    },
    select: {
      id: true,
      nis: true,
      nisn: true,
      fullName: true,
      birthDate: true,
    },
  });

  // Map untuk lookup cepat
  const existingByNis = new Map<string, (typeof existingStudents)[0]>();
  const existingByNisn = new Map<string, (typeof existingStudents)[0]>();
  const existingByNameAndDob = new Map<string, (typeof existingStudents)[0]>();

  for (const s of existingStudents) {
    existingByNis.set(s.nis.trim().toLowerCase(), s);
    if (s.nisn) {
      existingByNisn.set(s.nisn.trim(), s);
    }
    if (s.fullName && s.birthDate) {
      const dobKey = s.birthDate.toISOString().slice(0, 10);
      const nameKey = `${s.fullName.trim().toLowerCase()}_${dobKey}`;
      existingByNameAndDob.set(nameKey, s);
    }
  }

  // Map untuk tracking duplikasi internal di dalam file yang diunggah
  const seenNis = new Set<string>();
  const seenNisn = new Set<string>();

  const previewRows: PreviewRow[] = [];

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let newCount = 0;
  let exactDupCount = 0;
  let potentialDupCount = 0;

  for (let index = 0; index < rawRows.length; index++) {
    const raw = rawRows[index];
    const rowNumber = index + 2; // Baris 1 adalah header di spreadsheet

    const errors: ImportRowIssue[] = [];
    const warnings: ImportRowIssue[] = [];

    // Konversi raw values ke Record<string, string> untuk preview
    const rawDisplay: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      rawDisplay[k] = v !== null && v !== undefined ? String(v) : "";
    }

    // --- TAHAP SANITASI ---
    const nisClean = cleanIdentityNumber(raw.nis);
    const nisnClean = cleanIdentityNumber(raw.nisn);
    const nikClean = cleanIdentityNumber(raw.nik);
    const fullNameClean = cleanText(raw.fullName);
    const nicknameClean = cleanText(raw.nickname);
    const genderResult = cleanGender(raw.gender);
    const birthPlaceClean = cleanText(raw.birthPlace);
    const birthDateResult = cleanDate(raw.birthDate);
    const religionClean = cleanText(raw.religion);
    const addressClean = cleanText(raw.address);
    const phoneResult = cleanIndonesianPhone(raw.phone);
    const emailClean = cleanText(raw.email);

    // Data Wali
    const guardianNameClean = cleanText(raw.guardianName);
    const guardianRelationshipClean = raw.guardianRelationship
      ? cleanRelationship(raw.guardianRelationship)
      : undefined;
    const guardianPhoneResult = cleanIndonesianPhone(raw.guardianPhoneWa);

    // Data Kelas
    const classroomNameClean = cleanText(raw.classroomName);

    // Kumpulkan error & warning dari sanitizer
    if (genderResult.error) {
      errors.push({ field: "gender", message: genderResult.error });
    }
    if (birthDateResult.error) {
      errors.push({ field: "birthDate", message: birthDateResult.error });
    }
    if (phoneResult.error) {
      errors.push({ field: "phone", message: phoneResult.error });
    }
    if (phoneResult.warning) {
      warnings.push({ field: "phone", message: phoneResult.warning });
    }
    if (guardianPhoneResult.error) {
      errors.push({ field: "guardianPhoneWa", message: guardianPhoneResult.error });
    }
    if (guardianPhoneResult.warning) {
      warnings.push({ field: "guardianPhoneWa", message: guardianPhoneResult.warning });
    }

    // Bangun payload data yang disanitasi
    const sanitizedData: SanitizedStudentImportData = {
      nis: nisClean || "",
      nisn: nisnClean,
      nik: nikClean,
      fullName: fullNameClean || "",
      nickname: nicknameClean,
      gender: genderResult.gender || "L",
      birthPlace: birthPlaceClean,
      birthDate: birthDateResult.date,
      birthDateString: birthDateResult.dateString,
      religion: religionClean,
      address: addressClean,
      phone: phoneResult.phone,
      email: emailClean,
      guardianName: guardianNameClean,
      guardianRelationship: guardianRelationshipClean,
      guardianPhoneWa: guardianPhoneResult.phone,
      classroomName: classroomNameClean,
    };

    // --- TAHAP VALIDASI ZOD ---
    const zodValidation = createStudentInputSchema.safeParse({
      fullName: sanitizedData.fullName,
      nis: sanitizedData.nis,
      nisn: sanitizedData.nisn || undefined,
      nik: sanitizedData.nik || undefined,
      nickname: sanitizedData.nickname || undefined,
      gender: sanitizedData.gender,
      birthPlace: sanitizedData.birthPlace || undefined,
      birthDate: sanitizedData.birthDate || undefined,
      religion: sanitizedData.religion || undefined,
      address: sanitizedData.address || undefined,
      phone: sanitizedData.phone || undefined,
      email: sanitizedData.email || undefined,
      status: "ACTIVE",
    });

    if (!zodValidation.success) {
      for (const issue of zodValidation.error.issues) {
        errors.push({
          field: String(issue.path[0] || ""),
          message: issue.message,
        });
      }
    }

    // --- TAHAP DETEKSI DUPLIKASI ---
    let duplicateType: "EXACT" | "POTENTIAL" | undefined = undefined;
    let matchedStudent: { id: string; nis: string; fullName: string } | undefined = undefined;

    const nisKey = sanitizedData.nis ? sanitizedData.nis.toLowerCase() : "";

    // 1. Cek duplikasi di internal file sendiri
    if (nisKey) {
      if (seenNis.has(nisKey)) {
        errors.push({
          field: "nis",
          message: `Duplikasi internal: NIS '${sanitizedData.nis}' muncul lebih dari satu kali di file import ini`,
        });
      } else {
        seenNis.add(nisKey);
      }
    }

    if (sanitizedData.nisn) {
      if (seenNisn.has(sanitizedData.nisn)) {
        warnings.push({
          field: "nisn",
          message: `NISN '${sanitizedData.nisn}' terdeteksi ganda di file ini`,
        });
      } else {
        seenNisn.add(sanitizedData.nisn);
      }
    }

    // 2. Cek Exact Duplicate di Database (berdasarkan NIS dalam institusi)
    if (nisKey && existingByNis.has(nisKey)) {
      const match = existingByNis.get(nisKey)!;
      duplicateType = "EXACT";
      matchedStudent = {
        id: match.id,
        nis: match.nis,
        fullName: match.fullName,
      };
      warnings.push({
        field: "nis",
        message: `Siswa dengan NIS '${match.nis}' (${match.fullName}) sudah terdaftar di sistem. Baris ini akan dilewati (SKIP).`,
      });
    }

    // 3. Cek Potential Duplicate di Database (NISN sama atau Nama + Tgl Lahir sama tetapi NIS beda)
    if (!duplicateType) {
      if (sanitizedData.nisn && existingByNisn.has(sanitizedData.nisn)) {
        const match = existingByNisn.get(sanitizedData.nisn)!;
        duplicateType = "POTENTIAL";
        matchedStudent = {
          id: match.id,
          nis: match.nis,
          fullName: match.fullName,
        };
        warnings.push({
          field: "nisn",
          message: `Potensi Duplikat: NISN '${sanitizedData.nisn}' sudah digunakan oleh siswa '${match.fullName}' (NIS: ${match.nis}).`,
        });
      } else if (sanitizedData.fullName && sanitizedData.birthDate) {
        const dobKey = sanitizedData.birthDate.toISOString().slice(0, 10);
        const nameDobKey = `${sanitizedData.fullName.trim().toLowerCase()}_${dobKey}`;
        if (existingByNameAndDob.has(nameDobKey)) {
          const match = existingByNameAndDob.get(nameDobKey)!;
          duplicateType = "POTENTIAL";
          matchedStudent = {
            id: match.id,
            nis: match.nis,
            fullName: match.fullName,
          };
          warnings.push({
            field: "fullName",
            message: `Potensi Duplikat: Siswa bernama '${match.fullName}' dengan tanggal lahir sama sudah terdaftar (NIS: ${match.nis}).`,
          });
        }
      }
    }

    // Tentukan Status dan Aksi Baris
    let status: PreviewRow["status"] = "VALID";
    let action: PreviewRow["action"] = "CREATE";

    if (errors.length > 0) {
      status = "ERROR";
      action = "REJECT";
      errorCount++;
    } else if (duplicateType === "EXACT") {
      status = "WARNING";
      action = "SKIP_DUPLICATE";
      warningCount++;
      exactDupCount++;
    } else if (warnings.length > 0) {
      status = "WARNING";
      action = "CREATE";
      warningCount++;
      if (duplicateType === "POTENTIAL") {
        potentialDupCount++;
      } else {
        newCount++;
      }
    } else {
      status = "VALID";
      action = "CREATE";
      validCount++;
      newCount++;
    }

    previewRows.push({
      rowNumber,
      status,
      action,
      raw: rawDisplay,
      sanitized: sanitizedData,
      errors,
      warnings,
      duplicateType,
      matchedExistingStudent: matchedStudent,
    });
  }

  const summary: ImportPreviewSummary = {
    totalRows: rawRows.length,
    validRows: validCount,
    warningRows: warningCount,
    errorRows: errorCount,
    newRecords: newCount,
    exactDuplicates: exactDupCount,
    potentialDuplicates: potentialDupCount,
  };

  // Import dapat dilanjutkan jika ada minimal 1 baris yang dapat diimpor (VALID atau WARNING dengan aksi CREATE)
  const canProceed = previewRows.some((r) => r.action === "CREATE");

  return {
    rows: previewRows,
    summary,
    canProceed,
  };
}
