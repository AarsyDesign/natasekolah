import { TenantContext, TenantAccessDeniedError, requireTenantContext } from "./context";

/**
 * Memastikan bahwa konteks pengguna memiliki hak akses terhadap institutionId target.
 * Melempar TenantAccessDeniedError jika akses tidak sah.
 */
export function assertTenantAccess(targetInstitutionId: string, context?: TenantContext): void {
  const currentContext = context || requireTenantContext();

  if (currentContext.institutionId !== targetInstitutionId) {
    throw new TenantAccessDeniedError(targetInstitutionId, currentContext.institutionId);
  }
}

/**
 * Menyuntikkan atau memvalidasi klausa filter database agar selalu terikat pada institutionId sesi.
 * Mencegah developer lupa menambahkan filter `institutionId` dan mendeteksi upaya spoofing.
 */
export function enforceTenantFilter<T extends Record<string, unknown>>(
  whereClause: T,
  context?: TenantContext
): T & { institutionId: string } {
  const currentContext = context || requireTenantContext();

  // Jika input dari luar mencoba menyisipkan institutionId yang berbeda, tolak keras!
  if (whereClause.institutionId && typeof whereClause.institutionId === "string") {
    if (whereClause.institutionId !== currentContext.institutionId) {
      throw new TenantAccessDeniedError(whereClause.institutionId, currentContext.institutionId);
    }
  }

  return {
    ...whereClause,
    institutionId: currentContext.institutionId,
  };
}

/**
 * Membersihkan data input dari klien. Menghapus institutionId, userId,
 * guardianId, role, roles, permissions, dan isSuperAdmin yang dikirim klien
 * dan menggantinya secara mutlak dengan konteks sesi server terotentikasi.
 */
export function sanitizeClientInput<T extends Record<string, unknown>>(
  clientInput: T,
  context?: TenantContext
): Omit<
  T,
  | "institutionId"
  | "userId"
  | "guardianId"
  | "role"
  | "roles"
  | "permissions"
  | "isSuperAdmin"
> & { institutionId: string } {
  const currentContext = context || requireTenantContext();
  
  // Salin tanpa properti sensitif kiriman klien
  const {
    institutionId: _untrustedInstitutionId,
    userId: _untrustedUserId,
    guardianId: _untrustedGuardianId,
    role: _untrustedRole,
    roles: _untrustedRoles,
    permissions: _untrustedPermissions,
    isSuperAdmin: _untrustedIsSuperAdmin,
    ...cleanData
  } = clientInput;

  return {
    ...cleanData,
    institutionId: currentContext.institutionId,
  } as Omit<
    T,
    | "institutionId"
    | "userId"
    | "guardianId"
    | "role"
    | "roles"
    | "permissions"
    | "isSuperAdmin"
  > & { institutionId: string };
}
