import { prisma } from "../prisma";
import { verifyPassword } from "./password";
import {
  createSession,
  validateSessionToken,
  revokeSession,
  revokeAllUserSessions,
  ValidatedSessionPayload,
} from "./session";
import { getSessionCookie, clearSessionCookie, setSessionCookie } from "./cookie";
import { TenantContext, TenantContextMissingError } from "../tenant/context";
import { resolvePermissionsFromRoles } from "./permissions";
import type { User, Institution } from "@prisma/client";

/**
 * Galat otentikasi generik.
 * Mencegah account enumeration / username harvesting dengan menyamakan seluruh pesan kegagalan.
 */
export class AuthenticationError extends Error {
  readonly code = "INVALID_CREDENTIALS";
  readonly status = 401;

  constructor(message = "Identitas lembaga, email, atau kata sandi tidak valid.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type SafeUser = Omit<User, "passwordHash">;

/**
 * Membersihkan field sensitif (passwordHash) sebelum dikembalikan ke luar.
 */
export function sanitizeUser(user: User): SafeUser {
  const { passwordHash: _hash, ...safe } = user;
  return safe;
}

/**
 * Memverifikasi kredensial pengguna terhadap institusi target.
 * Mencegah kebocoran informasi apakah email ada atau password salah.
 */
export async function authenticateCredentials(params: {
  institutionSlug: string;
  email: string;
  plainPassword: string;
}): Promise<{ user: User; institution: Institution }> {
  const { institutionSlug, email, plainPassword } = params;

  if (!institutionSlug || !email || !plainPassword) {
    throw new AuthenticationError();
  }

  const normalizedSlug = institutionSlug.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Resolve institution via slug (trusted identifier)
  const institution = await prisma.institution.findUnique({
    where: { slug: normalizedSlug },
  });

  if (!institution) {
    throw new AuthenticationError();
  }

  // 2. Resolve user by (institutionId, email) compound key
  const user = await prisma.user.findUnique({
    where: {
      institutionId_email: {
        institutionId: institution.id,
        email: normalizedEmail,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new AuthenticationError();
  }

  // 3. Verifikasi kata sandi via bcrypt
  const isMatch = await verifyPassword(plainPassword, user.passwordHash);
  if (!isMatch) {
    throw new AuthenticationError();
  }

  // 4. Catat waktu login terakhir (non-blocking)
  prisma.user
    .update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
    .catch(() => {
      // Abaikan kegagalan update minor
    });

  return { user, institution };
}

/**
 * Alur login server-side lengkap:
 * Autentikasi kredensial -> Terbitkan Session di DB -> Kembalikan rawToken untuk browser.
 */
export async function loginUser(params: {
  institutionSlug: string;
  email: string;
  plainPassword: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: SafeUser; institution: Institution; rawToken: string }> {
  const { user, institution } = await authenticateCredentials(params);

  // Buat sesi terenkripsi (hash disimpan di DB, rawToken dikirimkan ke cookie)
  const { rawToken } = await createSession({
    subjectType: "INTERNAL_USER",
    userId: user.id,
    institutionId: institution.id,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return {
    user: sanitizeUser(user),
    institution,
    rawToken,
  };
}

/**
 * Alur logout: Mencabut token di DB dan menghapus cookie klien.
 */
export async function logoutUser(rawToken?: string): Promise<boolean> {
  const tokenToRevoke = rawToken || (await getSessionCookie());
  if (!tokenToRevoke) {
    return false;
  }

  const success = await revokeSession(tokenToRevoke);
  return success;
}

/**
 * Memvalidasi sesi dan mengembalikan User serta Institution terkait.
 */
export async function getAuthenticatedUser(
  rawToken: string
): Promise<{ user: SafeUser; institution: Institution } | null> {
  const payload = await validateSessionToken(rawToken);
  if (!payload || payload.subjectType !== "INTERNAL_USER" || !payload.user) return null;

  return {
    user: sanitizeUser(payload.user),
    institution: payload.institution,
  };
}

/**
 * Membangun TenantContext resmi dari entitas User dan Institution terotentikasi.
 * Menjamin 100% bahwa context berasal dari sesi server, bukan payload body klien.
 */
export function buildTenantContextFromUser(
  user: User,
  institution: Institution
): TenantContext {
  let roles: string[] = [];
  try {
    roles = JSON.parse(user.roles || "[]");
  } catch {
    roles = ["STAFF"];
  }

  const permissions = resolvePermissionsFromRoles(roles);
  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  return {
    userId: user.id,
    institutionId: institution.id,
    roles,
    permissions,
    isSuperAdmin,
  };
}

/**
 * Mengambil TenantContext dari sesi aktif.
 * Melempar TenantContextMissingError jika sesi tidak ada atau tidak valid.
 */
export async function getAuthenticatedTenantContext(
  rawToken?: string
): Promise<TenantContext> {
  const token = rawToken || (await getSessionCookie());
  if (!token) {
    throw new TenantContextMissingError(
      "Sesi otentikasi tidak ditemukan. Harap masuk terlebih dahulu.",
      "SESSION_MISSING"
    );
  }

  const payload: ValidatedSessionPayload | null = await validateSessionToken(token);
  if (!payload) {
    throw new TenantContextMissingError(
      "Sesi Anda tidak valid atau telah kedaluwarsa. Harap masuk kembali.",
      "SESSION_INVALID"
    );
  }

  if (payload.subjectType !== "INTERNAL_USER" || !payload.user) {
    throw new TenantContextMissingError(
      "Sesi ini bukan sesi pengguna internal lembaga.",
      "NOT_INTERNAL"
    );
  }

  return buildTenantContextFromUser(payload.user, payload.institution);
}

export { revokeSession, revokeAllUserSessions };
