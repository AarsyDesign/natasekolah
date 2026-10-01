import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission } from "../auth/permissions";
import { ResourceNotFoundError, InvalidTeacherRoleError } from "./types";

export interface SafeTeacher {
  id: string;
  institutionId: string;
  name: string;
  email: string;
  phoneWa: string | null;
  roles: string[];
  isActive: boolean;
  assignmentCount?: number;
}

/**
 * Layanan Domain Guru (Teacher) NataSekolah.
 * Guru adalah identitas internal lembaga (model User dengan peran TEACHER),
 * bukan entitas otentikasi terpisah.
 */

export async function listTeachers(
  ctx: TenantContext
): Promise<SafeTeacher[]> {
  // 1. RBAC Guard: academic:view atau staff:view
  requirePermission(ctx, "academic:view");

  // 2. Query pengguna dengan peran TEACHER — filter di JS karena roles JSON
  // Optimasi: hanya include _count untuk teacherAssignments setelah filter
  const users = await prisma.user.findMany({
    where: {
      institutionId: ctx.institutionId,
      isActive: true,
    },
    select: {
      id: true,
      institutionId: true,
      name: true,
      email: true,
      phoneWa: true,
      roles: true,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // 3. Filter pengguna yang memiliki peran TEACHER
  const teacherIds = [];
  const teachers: SafeTeacher[] = [];
  for (const user of users) {
    let roles: string[] = [];
    try {
      roles = JSON.parse(user.roles || "[]");
    } catch {
      roles = [];
    }

    if (roles.includes("TEACHER")) {
      teacherIds.push(user.id);
      teachers.push({
        id: user.id,
        institutionId: user.institutionId,
        name: user.name,
        email: user.email,
        phoneWa: user.phoneWa,
        roles,
        isActive: user.isActive,
        assignmentCount: 0, // placeholder, diisi batch di bawah
      });
    }
  }

  // 4. Batch fetch assignment counts HANYA untuk teacher (bukan semua user)
  if (teacherIds.length > 0) {
    const counts = await prisma.teacherAssignment.groupBy({
      by: ["teacherId"],
      where: {
        teacherId: { in: teacherIds },
      },
      _count: {
        teacherId: true,
      },
    });

    const countMap = new Map(counts.map(c => [c.teacherId, c._count.teacherId]));
    for (const t of teachers) {
      t.assignmentCount = countMap.get(t.id) ?? 0;
    }
  }

  return teachers;
}

export async function getTeacher(
  ctx: TenantContext,
  teacherId: string
) {
  requirePermission(ctx, "academic:view");

  const user = await prisma.user.findUnique({
    where: {
      id_institutionId: {
        id: teacherId,
        institutionId: ctx.institutionId,
      },
    },
    include: {
      teacherAssignments: {
        include: {
          subject: true,
          classroom: true,
          academicYear: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    throw new ResourceNotFoundError("Guru", teacherId);
  }

  let roles: string[] = [];
  try {
    roles = JSON.parse(user.roles || "[]");
  } catch {
    roles = [];
  }

  if (!roles.includes("TEACHER")) {
    throw new InvalidTeacherRoleError(teacherId);
  }

  const { passwordHash: _hash, ...safeUser } = user;
  return {
    ...safeUser,
    roles,
  };
}
