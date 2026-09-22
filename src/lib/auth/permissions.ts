import { TenantContext, requireTenantContext } from "../tenant/context";

/**
 * Kesalahan otorisasi (403 Forbidden) saat pengguna terotentikasi tidak memiliki
 * izin atau peran yang diperlukan.
 */
export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN_INSUFFICIENT_PERMISSION";
  readonly status = 403;
  readonly requiredPermission: string;
  readonly requiredRole?: string;

  constructor(requiredPermissionOrRole: string, message?: string) {
    super(
      message ||
        `Akses ditolak: Anda tidak memiliki izin [${requiredPermissionOrRole}] untuk menjalankan operasi ini.`
    );
    this.name = "AuthorizationError";
    this.requiredPermission = requiredPermissionOrRole;
    this.requiredRole = requiredPermissionOrRole;
  }
}

/**
 * Kesalahan autentikasi (401 Unauthorized) saat sesi tidak valid atau belum terotentikasi.
 */
export class AuthenticationError extends Error {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;

  constructor(message = "Autentikasi diperlukan untuk mengakses resource ini.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * 6 Peran Resmi Internal Lembaga NataSekolah (Phase 0.2).
 * Catatan: Wali (Guardian) BUKAN peran staf RBAC, melainkan entitas ReBAC independen.
 */
export const ROLES = [
  "SUPER_ADMIN",
  "FOUNDATION_HEAD",
  "PRINCIPAL",
  "ADMIN",
  "TEACHER",
  "FINANCE_STAFF",
] as const;

export type Role = (typeof ROLES)[number];

export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

/**
 * Daftar Izin Granular Resmi per Domain NataSekolah.
 */
export const PERMISSIONS = [
  // Student Domain
  "student:view",
  "student:create",
  "student:edit",
  "student:archive",

  // Academic Domain
  "academic:view",
  "academic:manage",

  // Attendance Domain
  "attendance:view",
  "attendance:manage",

  // Finance Domain
  "finance:view",
  "finance:manage",

  // Staff Domain
  "staff:view",
  "staff:manage",

  // Classroom Domain
  "classroom:view",
  "classroom:manage",

  // Report Domain
  "report:view",
  "report:manage",

  // Guardian Management Domain (Operasi staf mengelola/mengundang wali)
  "guardian:view",
  "guardian:manage",

  // Institution Domain
  "institution:view",
  "institution:manage",

  // Settings Domain
  "settings:view",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isValidPermission(permission: string): permission is Permission {
  return (PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Pemetaan Sinonim Izin Lama (Phase 0.1) ke Izin Granular Resmi (Phase 0.2).
 * Memastikan backward compatibility 100% tanpa merusak test suite yang sudah berjalan.
 */
const LEGACY_PERMISSION_MAP: Record<string, Permission[]> = {
  "student:read": ["student:view"],
  "student:write": ["student:create", "student:edit"],
  "academic:read": ["academic:view"],
  "academic:write": ["academic:manage"],
  "attendance:read": ["attendance:view"],
  "attendance:write": ["attendance:manage"],
  "finance:read": ["finance:view"],
  "finance:write": ["finance:manage"],
  "user:read": ["staff:view"],
  "user:write": ["staff:manage"],
  "audit:read": ["institution:view"],
  "receipt:issue": ["finance:manage"],
  "institution:delete": ["institution:manage"],
};

/**
 * Pemetaan Balik Izin Granular Resmi ke Sinonim Lama untuk kompatibilitas resolver.
 */
const MODERN_TO_LEGACY_MAP: Record<string, string[]> = {
  "student:view": ["student:read"],
  "student:create": ["student:write"],
  "student:edit": ["student:write"],
  "academic:view": ["academic:read"],
  "academic:manage": ["academic:write"],
  "attendance:view": ["attendance:read"],
  "attendance:manage": ["attendance:write"],
  "finance:view": ["finance:read"],
  "finance:manage": ["finance:write", "receipt:issue"],
  "staff:view": ["user:read"],
  "staff:manage": ["user:write"],
  "institution:view": ["audit:read"],
  "institution:manage": ["institution:delete"],
};

/**
 * Pemetaan peran legacy ke peran resmi.
 */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  INSTITUTION_ADMIN: "ADMIN",
  TREASURER: "FINANCE_STAFF",
  STAFF: "ADMIN",
};

/**
 * Matriks Tunggal Sumber Kebenaran (Single Source of Truth) Role -> Permissions.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [
    "student:view",
    "student:create",
    "student:edit",
    "student:archive",
    "academic:view",
    "academic:manage",
    "attendance:view",
    "attendance:manage",
    "finance:view",
    "finance:manage",
    "staff:view",
    "staff:manage",
    "classroom:view",
    "classroom:manage",
    "report:view",
    "report:manage",
    "guardian:view",
    "guardian:manage",
    "institution:view",
    "institution:manage",
    "settings:view",
    "settings:manage",
  ],
  FOUNDATION_HEAD: [
    "student:view",
    "academic:view",
    "attendance:view",
    "finance:view",
    "finance:manage",
    "staff:view",
    "staff:manage",
    "classroom:view",
    "report:view",
    "report:manage",
    "guardian:view",
    "institution:view",
    "institution:manage",
    "settings:view",
    "settings:manage",
  ],
  PRINCIPAL: [
    "student:view",
    "student:create",
    "student:edit",
    "academic:view",
    "academic:manage",
    "attendance:view",
    "attendance:manage",
    "finance:view", // View only, no finance:manage
    "staff:view",
    "classroom:view",
    "classroom:manage",
    "report:view",
    "report:manage",
    "guardian:view",
    "institution:view",
    "settings:view",
  ],
  ADMIN: [
    "student:view",
    "student:create",
    "student:edit",
    "student:archive",
    "academic:view",
    "academic:manage",
    "attendance:view",
    "attendance:manage",
    "staff:view",
    "classroom:view",
    "classroom:manage",
    "report:view",
    "guardian:view",
    "guardian:manage",
    "institution:view",
    "settings:view",
  ],
  TEACHER: [
    "student:view",
    "academic:view",
    "attendance:view",
    "attendance:manage",
    "classroom:view",
    "report:view",
  ],
  FINANCE_STAFF: [
    "student:view",
    "finance:view",
    "finance:manage",
    "report:view",
  ],
} as const;

/**
 * Matriks kompatibilitas peran lama untuk test legacy Phase 0.1.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*", ...ROLE_PERMISSIONS.SUPER_ADMIN],
  FOUNDATION_HEAD: [...ROLE_PERMISSIONS.FOUNDATION_HEAD],
  PRINCIPAL: [...ROLE_PERMISSIONS.PRINCIPAL],
  ADMIN: [...ROLE_PERMISSIONS.ADMIN],
  TEACHER: [...ROLE_PERMISSIONS.TEACHER],
  FINANCE_STAFF: [...ROLE_PERMISSIONS.FINANCE_STAFF],
  INSTITUTION_ADMIN: [
    "institution:manage",
    "user:read",
    "user:write",
    "academic:read",
    "academic:write",
    "student:read",
    "student:write",
    "finance:read",
    "finance:write",
    "attendance:read",
    "attendance:write",
    "audit:read",
    ...ROLE_PERMISSIONS.ADMIN,
  ],
  TREASURER: [
    "student:read",
    "finance:read",
    "finance:write",
    "receipt:issue",
    ...ROLE_PERMISSIONS.FINANCE_STAFF,
  ],
  STAFF: [
    "student:read",
    "attendance:read",
    "student:view",
    "attendance:view",
  ],
};

/**
 * Mengubah daftar peran (array of role names) menjadi daftar izin unik (flat permissions).
 */
export function resolvePermissionsFromRoles(roles: string[]): string[] {
  const permissionsSet = new Set<string>();

  for (const rawRole of roles) {
    if (isValidRole(rawRole)) {
      const perms = ROLE_PERMISSIONS[rawRole];
      for (const perm of perms) {
        permissionsSet.add(perm);
        const legacyEquivs = MODERN_TO_LEGACY_MAP[perm];
        if (legacyEquivs) {
          for (const leg of legacyEquivs) permissionsSet.add(leg);
        }
      }
      if (rawRole === "SUPER_ADMIN") {
        permissionsSet.add("*");
      }
    } else if (LEGACY_ROLE_MAP[rawRole]) {
      const mappedRole = LEGACY_ROLE_MAP[rawRole];
      const perms = ROLE_PERMISSIONS[mappedRole];
      for (const perm of perms) {
        permissionsSet.add(perm);
        const legacyEquivs = MODERN_TO_LEGACY_MAP[perm];
        if (legacyEquivs) {
          for (const leg of legacyEquivs) permissionsSet.add(leg);
        }
      }
    }

    const legacyPerms = DEFAULT_ROLE_PERMISSIONS[rawRole];
    if (legacyPerms) {
      for (const lp of legacyPerms) {
        permissionsSet.add(lp);
        const modernEquivs = LEGACY_PERMISSION_MAP[lp];
        if (modernEquivs) {
          for (const mq of modernEquivs) permissionsSet.add(mq);
        }
      }
    }
  }

  return Array.from(permissionsSet);
}

/**
 * Tipe input sesi otentikasi yang didukung authorization guard.
 */
export type AuthSubject =
  | TenantContext
  | {
      subjectType?: string;
      userId?: string | null;
      guardianId?: string | null;
      user?: {
        id?: string;
        roles?: string | string[];
        isActive?: boolean;
      } | null;
      guardian?: unknown;
      roles?: string[];
      permissions?: string[];
      isSuperAdmin?: boolean;
    };

/**
 * Mendeteksi apakah subjek sesi adalah sesi wali (GUARDIAN).
 */
export function isGuardianSubject(subject: unknown): boolean {
  if (!subject || typeof subject !== "object") return false;
  const s = subject as Record<string, unknown>;
  if (s.subjectType === "GUARDIAN") return true;
  if (s.guardianId && !s.userId) return true;
  if (s.guardian && !s.user) return true;
  return false;
}

/**
 * Mengekstrak peran pengguna internal dari sesi atau context tervalidasi di server.
 * Menolak sesi wali dan sesi tak terotentikasi.
 */
export function extractUserRoles(subject: unknown): string[] | null {
  if (!subject || typeof subject !== "object") return null;
  if (isGuardianSubject(subject)) return null;

  const s = subject as Record<string, unknown>;

  // Jika berupa TenantContext
  if (Array.isArray(s.roles)) {
    return s.roles as string[];
  }

  // Jika berupa ValidatedSessionPayload atau objek Session dengan User
  if (s.user && typeof s.user === "object") {
    const user = s.user as Record<string, unknown>;
    if (Array.isArray(user.roles)) {
      return user.roles as string[];
    }
    if (typeof user.roles === "string") {
      try {
        const parsed = JSON.parse(user.roles);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        return ["ADMIN"];
      }
    }
  }

  return null;
}

/**
 * Helper internal untuk memeriksa kecocokan izin dalam daftar izin pengguna.
 */
function checkPermissionMatch(userPermissions: string[], requiredPermission: string): boolean {
  if (userPermissions.includes("*")) {
    return true;
  }
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  // Cek sinonim legacy
  const legacyMapped = LEGACY_PERMISSION_MAP[requiredPermission];
  if (legacyMapped) {
    for (const m of legacyMapped) {
      if (userPermissions.includes(m)) return true;
    }
  }
  // Cek sinonim modern
  const modernMapped = MODERN_TO_LEGACY_MAP[requiredPermission];
  if (modernMapped) {
    for (const l of modernMapped) {
      if (userPermissions.includes(l)) return true;
    }
  }
  return false;
}

/**
 * Memeriksa apakah subjek sesi memiliki izin yang disyaratkan.
 *
 * Mendukung signature:
 * - hasPermission(session, permission) [Phase 0.2 Modern]
 * - hasPermission(permissionsArray, permission) [Phase 0.1 Legacy]
 */
export function hasPermission(
  subjectOrPermissions: AuthSubject | string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (!subjectOrPermissions) return false;

  // Signature Legacy: array of string permissions
  if (Array.isArray(subjectOrPermissions)) {
    return checkPermissionMatch(subjectOrPermissions as string[], requiredPermission);
  }

  // Sesi wali ditolak total dari RBAC internal
  if (isGuardianSubject(subjectOrPermissions)) {
    return false;
  }

  const s = subjectOrPermissions as Record<string, unknown>;

  // Jika TenantContext sudah memiliki permissions terhitung
  if (Array.isArray(s.permissions)) {
    return checkPermissionMatch(s.permissions as string[], requiredPermission);
  }

  // Ekstrak peran dan selesaikan izin
  const roles = extractUserRoles(subjectOrPermissions);
  if (!roles || roles.length === 0) {
    return false;
  }

  const permissions = resolvePermissionsFromRoles(roles);
  return checkPermissionMatch(permissions, requiredPermission);
}

/**
 * Penjaga otorisasi (Guard): Memastikan subjek sesi memiliki izin yang disyaratkan.
 *
 * Mendukung signature:
 * - requirePermission(session, permission) [Phase 0.2 Modern]
 * - requirePermission(permission, context?) [Phase 0.1 Legacy]
 *
 * Melempar:
 * - AuthenticationError (401) jika sesi tidak ada / unauthenticated.
 * - AuthorizationError (403) jika sesi adalah GUARDIAN atau izin tidak mencukupi.
 */
export function requirePermission(
  firstArg: AuthSubject | string | null | undefined,
  secondArg?: string | TenantContext
): void {
  let subject: unknown;
  let requiredPermission: string;

  if (typeof firstArg === "string") {
    // Signature Legacy: requirePermission(permission, context?)
    requiredPermission = firstArg;
    subject = secondArg ?? (requireTenantContext() as unknown);
  } else {
    // Signature Modern: requirePermission(session, permission)
    subject = firstArg;
    if (typeof secondArg !== "string") {
      throw new Error("Parameter permission harus berupa string.");
    }
    requiredPermission = secondArg;
  }

  if (!subject) {
    throw new AuthenticationError("Autentikasi diperlukan untuk mengakses resource ini.");
  }

  if (isGuardianSubject(subject)) {
    throw new AuthorizationError(
      requiredPermission,
      `Akses ditolak: Sesi wali (GUARDIAN) tidak memiliki izin internal [${requiredPermission}]. Akses wali hanya diatur melalui ReBAC.`
    );
  }

  if (!hasPermission(subject as AuthSubject, requiredPermission)) {
    throw new AuthorizationError(requiredPermission);
  }
}

/**
 * Memeriksa apakah subjek sesi memiliki setidaknya satu peran yang disyaratkan.
 */
export function hasRole(
  subject: AuthSubject | null | undefined,
  requiredRole: Role | Role[] | string | string[]
): boolean {
  if (!subject) return false;
  if (isGuardianSubject(subject)) return false;

  const roles = extractUserRoles(subject);
  if (!roles || roles.length === 0) return false;

  const targetRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  return targetRoles.some((target) => {
    if (roles.includes(target)) return true;
    const mapped = LEGACY_ROLE_MAP[target];
    if (mapped && roles.includes(mapped)) return true;
    return false;
  });
}

/**
 * Penjaga peran (Guard): Memastikan subjek sesi memiliki peran yang disyaratkan.
 *
 * Melempar:
 * - AuthenticationError (401) jika sesi tidak ada / unauthenticated.
 * - AuthorizationError (403) jika sesi adalah GUARDIAN atau tidak memiliki peran yang sesuai.
 */
export function requireRole(
  subject: AuthSubject | null | undefined,
  requiredRole: Role | Role[] | string | string[]
): void {
  if (!subject) {
    throw new AuthenticationError("Autentikasi diperlukan untuk mengakses resource ini.");
  }

  const roleLabel = Array.isArray(requiredRole) ? requiredRole.join(" | ") : requiredRole;

  if (isGuardianSubject(subject)) {
    throw new AuthorizationError(
      roleLabel,
      `Akses ditolak: Sesi wali (GUARDIAN) tidak memiliki peran staf internal [${roleLabel}].`
    );
  }

  if (!hasRole(subject, requiredRole)) {
    throw new AuthorizationError(
      roleLabel,
      `Akses ditolak: Operasi ini membutuhkan peran [${roleLabel}].`
    );
  }
}
