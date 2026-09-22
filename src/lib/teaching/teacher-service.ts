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

  // 2. Query seluruh pengguna aktif dalam institusi
  const users = await prisma.user.findMany({
    where: {
      institutionId: ctx.institutionId,
      isActive: true,
    },
    include: {
      _count: {
        select: { teacherAssignments: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // 3. Filter pengguna yang memiliki peran TEACHER
  const teachers: SafeTeacher[] = [];
  for (const user of users) {
    let roles: string[] = [];
    try {
      roles = JSON.parse(user.roles || "[]");
    } catch {
      roles = [];
    }

    if (roles.includes("TEACHER")) {
      teachers.push({
        id: user.id,
        institutionId: user.institutionId,
        name: user.name,
        email: user.email,
        phoneWa: user.phoneWa,
        roles,
        isActive: user.isActive,
        assignmentCount: user._count.teacherAssignments,
      });
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
