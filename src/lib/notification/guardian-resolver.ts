import { prisma } from "../prisma";
import { sanitizeIndonesianPhone } from "../validation/notification";

/**
 * Normalisasi nomor WhatsApp Indonesia (+62 / 08 / 628).
 * Menghasilkan string berformat 628xxx atau null jika tidak valid.
 */
export function normalizePhone(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;
  const sanitized = sanitizeIndonesianPhone(trimmed);
  if (/^628\d{8,12}$/.test(sanitized)) {
    return sanitized;
  }
  return null;
}

/**
 * Resolves the primary or available WhatsApp phone number of a student's guardian.
 * Resolution hierarchy:
 * 1. Primary Guardian (isPrimary: true)
 * 2. Other registered guardians (ordered by createdAt asc)
 * 3. Fallback: Student.parentWaPhone
 *
 * Returns normalized phone string (e.g. "628123456789") or null if none valid.
 * Never throws an error (defensive design).
 */
export async function resolveGuardianPhone(
  institutionId: string,
  studentId: string,
  client?: typeof prisma
): Promise<string | null> {
  const db = client || prisma;

  try {
    // 1. Fetch GuardianStudent links ordered by isPrimary desc, createdAt asc
    const guardianLinks = await db.guardianStudent.findMany({
      where: {
        institutionId,
        studentId,
      },
      include: {
        guardian: {
          select: {
            phoneWa: true,
            status: true,
          },
        },
      },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc" },
      ],
    });

    for (const link of guardianLinks) {
      const phone = normalizePhone(link.guardian?.phoneWa);
      if (phone) {
        return phone;
      }
    }

    // 2. Fallback to student.parentWaPhone
    const student = await db.student.findFirst({
      where: {
        id: studentId,
        institutionId,
      },
      select: {
        parentWaPhone: true,
      },
    });

    if (student?.parentWaPhone) {
      const phone = normalizePhone(student.parentWaPhone);
      if (phone) {
        return phone;
      }
    }

    return null;
  } catch (err) {
    console.error("[resolveGuardianPhone] Error resolving phone:", err);
    return null;
  }
}
