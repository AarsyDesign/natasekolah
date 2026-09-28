import { prisma } from "../prisma";
import { sanitizeIndonesianPhone } from "../validation/notification";

export interface ResolvedGuardianRecipient {
  recipientPhone: string;
  guardianName: string;
  studentName: string;
  source: "GUARDIAN_RELATION" | "STUDENT_PARENT_WA_FALLBACK" | "STUDENT_PHONE_FALLBACK";
}

/**
 * Validates whether a phone number string satisfies valid Indonesian WhatsApp format (628xxx, 10-14 digits).
 */
export function isValidIndonesianPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== "string") return false;
  const sanitized = sanitizeIndonesianPhone(phone.trim());
  return /^628\d{8,12}$/.test(sanitized);
}

/**
 * Resolves the primary/active WhatsApp recipient phone for a student following tenant isolation.
 * Resolution precedence:
 * 1. Guardian via GuardianStudent (ordered by isPrimary DESC, createdAt ASC)
 * 2. Student legacy fallback parentWaPhone
 * 3. Student phone
 * 
 * Returns null gracefully if no valid destination is found.
 */
export async function resolveStudentGuardianRecipient(
  studentId: string,
  institutionId: string,
  txPrisma?: typeof prisma
): Promise<ResolvedGuardianRecipient | null> {
  const db = txPrisma || prisma;

  if (!db?.student) {
    return null;
  }

  // 1. Fetch student with guardians
  let student: any = null;
  try {
    if (typeof db.student.findUnique === "function") {
      student = await db.student.findUnique({
        where: {
          id_institutionId: {
            id: studentId,
            institutionId,
          },
        },
        include: {
          guardians: {
            where: {
              institutionId,
            },
            orderBy: [
              { isPrimary: "desc" },
              { createdAt: "asc" },
            ],
            include: {
              guardian: true,
            },
          },
        },
      });
    } else if (typeof db.student.findFirst === "function") {
      student = await db.student.findFirst({
        where: {
          id: studentId,
          institutionId,
        },
        include: {
          guardians: {
            where: {
              institutionId,
            },
            include: {
              guardian: true,
            },
          },
        },
      });
    }
  } catch {
    student = null;
  }

  if (!student) {
    return null;
  }

  // 2. Iterate linked guardians
  const guardianLinks = Array.isArray(student.guardians) ? student.guardians : [];
  for (const rel of guardianLinks) {
    const guardian = rel.guardian;
    if (guardian && isValidIndonesianPhone(guardian.phoneWa)) {
      return {
        recipientPhone: sanitizeIndonesianPhone(guardian.phoneWa),
        guardianName: guardian.fullName,
        studentName: student.fullName,
        source: "GUARDIAN_RELATION",
      };
    }
  }

  // 3. Fallback to student.parentWaPhone
  if (isValidIndonesianPhone(student.parentWaPhone)) {
    return {
      recipientPhone: sanitizeIndonesianPhone(student.parentWaPhone!),
      guardianName: "Wali Murid",
      studentName: student.fullName,
      source: "STUDENT_PARENT_WA_FALLBACK",
    };
  }

  // 4. Fallback to student.phone
  if (isValidIndonesianPhone(student.phone)) {
    return {
      recipientPhone: sanitizeIndonesianPhone(student.phone!),
      guardianName: "Wali Murid",
      studentName: student.fullName,
      source: "STUDENT_PHONE_FALLBACK",
    };
  }

  return null;
}
