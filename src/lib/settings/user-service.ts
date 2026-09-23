import { prisma } from "../prisma";
import type { TenantContext } from "../tenant/context";
import { requirePermission, Role, ROLES } from "../auth/permissions";
import { validate } from "../validation/common";
import { updateUserRolesSchema, toggleUserActiveSchema } from "./validation";
import { revokeAllUserSessions } from "../auth/service";
import type { ManagedUser } from "./types";

/**
 * Mengambil daftar staf/pengguna internal lembaga.
 * Memerlukan izin staff:view.
 */
export async function listManagedUsers(ctx: TenantContext): Promise<ManagedUser[]> {
  requirePermission(ctx, "staff:view");

  const users = await prisma.user.findMany({
    where: { institutionId: ctx.institutionId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phoneWa: true,
      roles: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return users.map((u) => {
    let parsedRoles: Role[] = [];
    try {
      const arr = JSON.parse(u.roles || "[]");
      parsedRoles = Array.isArray(arr)
        ? (arr.filter((r) => ROLES.includes(r as Role)) as Role[])
        : [];
    } catch {
      parsedRoles = [];
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phoneWa: u.phoneWa,
      roles: parsedRoles,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  });
}

/**
 * Memperbarui peran (roles) pengguna internal lembaga.
 * Memerlukan izin staff:manage.
 */
export async function updateUserRoles(
  ctx: TenantContext,
  targetUserId: string,
  rawInput: unknown
): Promise<ManagedUser> {
  requirePermission(ctx, "staff:manage");

  const validated = validate(updateUserRolesSchema, rawInput);

  // Verifikasi target user ada di dalam tenant yang sama
  const targetUser = await prisma.user.findUnique({
    where: {
      id_institutionId: {
        id: targetUserId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan dalam lembaga ini.");
  }

  // Pencegahan eskalasi hak istimewa (Privilege Escalation)
  if (validated.roles.includes("SUPER_ADMIN") && !ctx.isSuperAdmin) {
    throw new Error("Hanya Super Admin yang berhak memberikan peran SUPER_ADMIN.");
  }

  // Jika memodifikasi akun sendiri, pastikan tidak mencabut seluruh peran administratif
  if (targetUserId === ctx.userId) {
    const hasAdminOrStaff = validated.roles.some((r) =>
      ["SUPER_ADMIN", "FOUNDATION_HEAD", "ADMIN", "PRINCIPAL"].includes(r)
    );
    if (!hasAdminOrStaff && ctx.roles.some((r) => ["SUPER_ADMIN", "FOUNDATION_HEAD", "ADMIN"].includes(r))) {
      throw new Error("Anda tidak dapat mencabut hak akses administratif dari akun Anda sendiri.");
    }
  }

  const updated = await prisma.user.update({
    where: {
      id_institutionId: {
        id: targetUserId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      roles: JSON.stringify(validated.roles),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneWa: true,
      roles: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phoneWa: updated.phoneWa,
    roles: validated.roles as Role[],
    isActive: updated.isActive,
    lastLoginAt: updated.lastLoginAt,
    createdAt: updated.createdAt,
  };
}

/**
 * Mengaktifkan atau menonaktifkan akun staf internal.
 * Memerlukan izin staff:manage.
 */
export async function toggleUserActiveStatus(
  ctx: TenantContext,
  targetUserId: string,
  rawInput: unknown
): Promise<ManagedUser> {
  requirePermission(ctx, "staff:manage");

  const validated = validate(toggleUserActiveSchema, rawInput);

  // Invarian: Pengguna dilarang keras menonaktifkan akunnya sendiri
  if (targetUserId === ctx.userId) {
    throw new Error("Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }

  // Verifikasi target user ada di dalam tenant yang sama
  const targetUser = await prisma.user.findUnique({
    where: {
      id_institutionId: {
        id: targetUserId,
        institutionId: ctx.institutionId,
      },
    },
  });

  if (!targetUser) {
    throw new Error("Pengguna tidak ditemukan dalam lembaga ini.");
  }

  const updated = await prisma.user.update({
    where: {
      id_institutionId: {
        id: targetUserId,
        institutionId: ctx.institutionId,
      },
    },
    data: {
      isActive: validated.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneWa: true,
      roles: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // Jika dinonaktifkan, cabut seluruh sesi aktifnya secara instan
  if (!validated.isActive) {
    await revokeAllUserSessions(targetUserId);
  }

  let parsedRoles: Role[] = [];
  try {
    const arr = JSON.parse(updated.roles || "[]");
    parsedRoles = Array.isArray(arr)
      ? (arr.filter((r) => ROLES.includes(r as Role)) as Role[])
      : [];
  } catch {
    parsedRoles = [];
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phoneWa: updated.phoneWa,
    roles: parsedRoles,
    isActive: updated.isActive,
    lastLoginAt: updated.lastLoginAt,
    createdAt: updated.createdAt,
  };
}
