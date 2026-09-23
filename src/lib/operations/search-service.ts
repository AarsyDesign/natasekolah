import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { hasPermission } from "../auth/permissions";
import type { GlobalSearchResultItem } from "./types";

/**
 * Layanan pencarian global (Global Search / Quick Navigation) terisolasi tenant.
 * Mencari secara paralel pada entitas utama (Siswa, Rombel, Guru, Wali)
 * dengan batasan RBAC ketat dan filter tenant mandatori.
 */
export async function searchGlobalEntities(
  ctx: TenantContext,
  rawQuery: string
): Promise<GlobalSearchResultItem[]> {
  const query = (rawQuery || "").trim();

  // Batas minimal pencarian 2 karakter untuk efisiensi
  if (query.length < 2) {
    return [];
  }

  const results: GlobalSearchResultItem[] = [];
  const limitPerCategory = 5;

  // 1. PENCARIAN SISWA (Memerlukan izin student:view)
  const canSearchStudents = hasPermission(ctx, "student:view");
  const studentPromise = canSearchStudents
    ? prisma.student.findMany({
        where: {
          institutionId: ctx.institutionId,
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { nis: { contains: query, mode: "insensitive" } },
            { nisn: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          nis: true,
          nisn: true,
          status: true,
        },
        take: limitPerCategory,
      })
    : Promise.resolve([]);

  // 2. PENCARIAN ROMBEL / KELAS (Memerlukan izin classroom:view atau academic:view)
  const canSearchClassrooms =
    hasPermission(ctx, "classroom:view") || hasPermission(ctx, "academic:view");
  const classroomPromise = canSearchClassrooms
    ? prisma.classroom.findMany({
        where: {
          institutionId: ctx.institutionId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { gradeLevel: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          academicYear: {
            select: { name: true },
          },
        },
        take: limitPerCategory,
      })
    : Promise.resolve([]);

  // 3. PENCARIAN GURU / STAF (Memerlukan izin staff:view)
  const canSearchStaff = hasPermission(ctx, "staff:view");
  const staffPromise = canSearchStaff
    ? prisma.user.findMany({
        where: {
          institutionId: ctx.institutionId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
        },
        take: limitPerCategory,
      })
    : Promise.resolve([]);

  // 4. PENCARIAN WALI MURID (Memerlukan izin guardian:view atau student:view)
  const canSearchGuardians =
    hasPermission(ctx, "guardian:view") || hasPermission(ctx, "student:view");
  const guardianPromise = canSearchGuardians
    ? prisma.guardian.findMany({
        where: {
          institutionId: ctx.institutionId,
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { phoneWa: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          phoneWa: true,
          status: true,
        },
        take: limitPerCategory,
      })
    : Promise.resolve([]);

  const [students, classrooms, staffList, guardians] = await Promise.all([
    studentPromise,
    classroomPromise,
    staffPromise,
    guardianPromise,
  ]);

  // Format hasil Siswa
  for (const s of students) {
    results.push({
      id: s.id,
      type: "STUDENT",
      title: s.fullName,
      subtitle: `NIS: ${s.nis}${s.nisn ? ` • NISN: ${s.nisn}` : ""}`,
      href: `/students?search=${encodeURIComponent(s.nis)}`,
      badge: s.status,
    });
  }

  // Format hasil Rombel
  for (const c of classrooms) {
    results.push({
      id: c.id,
      type: "CLASSROOM",
      title: c.name,
      subtitle: `Tingkat ${c.gradeLevel || "-"} • TA ${c.academicYear?.name || "-"}`,
      href: `/classrooms`,
      badge: c.gradeLevel || "Rombel",
    });
  }

  // Format hasil Guru/Staf
  for (const u of staffList) {
    results.push({
      id: u.id,
      type: "TEACHER",
      title: u.name,
      subtitle: u.email,
      href: `/teachers`,
      badge: "Guru/Staf",
    });
  }

  // Format hasil Wali
  for (const g of guardians) {
    results.push({
      id: g.id,
      type: "GUARDIAN",
      title: g.fullName,
      subtitle: `WA: ${g.phoneWa}`,
      href: `/students`,
      badge: g.status,
    });
  }

  return results;
}
