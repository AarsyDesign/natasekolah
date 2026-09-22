import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma";
import type { Session, User, Guardian, Institution } from "@prisma/client";
import {
  SessionSubjectType,
  isValidSessionSubjectType,
} from "./domain";

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 Hari
const TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // Update lastUsedAt tiap 24 jam

export class SessionInvariantError extends Error {
  readonly code = "INVALID_SESSION_INVARIANT";
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "SessionInvariantError";
  }
}

export type ValidatedSessionPayload =
  | {
      subjectType: "INTERNAL_USER";
      session: Session;
      user: User;
      guardian?: never;
      institution: Institution;
    }
  | {
      subjectType: "GUARDIAN";
      session: Session;
      guardian: Guardian;
      user?: never;
      institution: Institution;
    };

/**
 * Menghasilkan token acak 256-bit (32 byte) kriptografis aman.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Melakukan hashing SHA-256 pada token mentah sebelum disimpan atau dicari di basis data.
 * Memastikan basis data tidak pernah menyimpan token mentah.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface CreateSessionParams {
  subjectType?: SessionSubjectType;
  userId?: string | null;
  guardianId?: string | null;
  institutionId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Membuat sesi baru di database dan mengembalikan token mentah untuk browser.
 * Menegakkan invariant tegas:
 * - INTERNAL_USER: userId != null dan guardianId == null
 * - GUARDIAN: guardianId != null dan userId == null
 * - Session.institutionId wajib cocok dengan subject's institutionId
 */
export async function createSession(
  params: CreateSessionParams
): Promise<{ session: Session; rawToken: string }> {
  const subjectType: SessionSubjectType = params.subjectType || "INTERNAL_USER";

  if (!isValidSessionSubjectType(subjectType)) {
    throw new SessionInvariantError(`Tipe subjek sesi tidak valid: ${params.subjectType}`);
  }

  // Enforce Invariants
  const hasUser = Boolean(params.userId);
  const hasGuardian = Boolean(params.guardianId);

  if (hasUser && hasGuardian) {
    throw new SessionInvariantError(
      "Invariant violation: Sesi tidak boleh memiliki userId dan guardianId sekaligus."
    );
  }

  if (!hasUser && !hasGuardian) {
    throw new SessionInvariantError(
      "Invariant violation: Sesi wajib memiliki salah satu dari userId atau guardianId."
    );
  }

  if (subjectType === "INTERNAL_USER") {
    if (!hasUser || hasGuardian) {
      throw new SessionInvariantError(
        "Invariant violation: Sesi INTERNAL_USER wajib memiliki userId dan tanpa guardianId."
      );
    }

    // Tenant Integrity Check
    const user = await prisma.user.findUnique({
      where: { id: params.userId! },
      select: { institutionId: true },
    });
    if (!user) {
      throw new SessionInvariantError("Pengguna tidak ditemukan untuk pembuatan sesi.");
    }
    if (user.institutionId !== params.institutionId) {
      throw new SessionInvariantError(
        `Tenant mismatch: Pengguna terdaftar di institusi [${user.institutionId}], tidak cocok dengan sesi [${params.institutionId}].`
      );
    }
  } else if (subjectType === "GUARDIAN") {
    if (!hasGuardian || hasUser) {
      throw new SessionInvariantError(
        "Invariant violation: Sesi GUARDIAN wajib memiliki guardianId dan tanpa userId."
      );
    }

    // Tenant Integrity Check
    const guardian = await prisma.guardian.findUnique({
      where: { id: params.guardianId! },
      select: { institutionId: true },
    });
    if (!guardian) {
      throw new SessionInvariantError("Wali tidak ditemukan untuk pembuatan sesi.");
    }
    if (guardian.institutionId !== params.institutionId) {
      throw new SessionInvariantError(
        `Tenant mismatch: Wali terdaftar di institusi [${guardian.institutionId}], tidak cocok dengan sesi [${params.institutionId}].`
      );
    }
  }

  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  const session = await prisma.session.create({
    data: {
      tokenHash,
      subjectType,
      userId: params.userId || null,
      guardianId: params.guardianId || null,
      institutionId: params.institutionId,
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  return { session, rawToken };
}

/**
 * Memvalidasi token mentah sesi:
 * 1. Token di-hash via SHA-256 untuk mencari baris Session.
 * 2. Memastikan belum expired dan belum revoked.
 * 3. Memvalidasi subjectType dan invariant.
 * 4. Memastikan integritas tenant (Session.institutionId == Subject.institutionId).
 * 5. Memastikan akun masih aktif.
 * 6. Memperbarui lastUsedAt jika diperlukan.
 */
export async function validateSessionToken(
  rawToken: string
): Promise<ValidatedSessionPayload | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: true,
      guardian: true,
      institution: true,
    },
  });

  if (!session) {
    return null;
  }

  // Cek apakah sesi telah dicabut
  if (session.revokedAt !== null) {
    return null;
  }

  // Cek kedaluwarsa
  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // Cek validitas tipe subjek
  if (!isValidSessionSubjectType(session.subjectType)) {
    return null;
  }

  // Validasi berdasarkan subjectType
  if (session.subjectType === "INTERNAL_USER") {
    // Invariant check
    if (!session.userId || session.guardianId !== null || !session.user) {
      return null;
    }

    // Tenant Integrity Check: Session institutionId harus sama dengan User institutionId
    if (session.institutionId !== session.user.institutionId) {
      return null;
    }

    // Cek keaktifan akun pengguna
    if (!session.user.isActive) {
      return null;
    }

    touchSessionIfNeeded(session.id, session.lastUsedAt);

    return {
      subjectType: "INTERNAL_USER",
      session,
      user: session.user,
      institution: session.institution,
    };
  }

  if (session.subjectType === "GUARDIAN") {
    // Invariant check
    if (!session.guardianId || session.userId !== null || !session.guardian) {
      return null;
    }

    // Tenant Integrity Check: Session institutionId harus sama dengan Guardian institutionId
    if (session.institutionId !== session.guardian.institutionId) {
      return null;
    }

    // Cek keaktifan akun wali
    if (session.guardian.status !== "ACTIVE") {
      return null;
    }

    touchSessionIfNeeded(session.id, session.lastUsedAt);

    return {
      subjectType: "GUARDIAN",
      session,
      guardian: session.guardian,
      institution: session.institution,
    };
  }

  return null;
}

/**
 * Rolling update lastUsedAt jika sudah lebih dari 24 jam.
 */
function touchSessionIfNeeded(sessionId: string, lastUsedAt: Date): void {
  if (Date.now() - lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    prisma.session
      .update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Abaikan kegagalan update minor
      });
  }
}

/**
 * Mencabut (revoke) satu sesi tertentu (misal saat logout).
 */
export async function revokeSession(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = hashSessionToken(rawToken);

  try {
    await prisma.session.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Mencabut seluruh sesi milik pengguna internal.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return result.count;
}

/**
 * Mencabut seluruh sesi milik wali.
 */
export async function revokeAllGuardianSessions(guardianId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      guardianId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  return result.count;
}
