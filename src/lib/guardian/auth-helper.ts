import { getSessionCookie } from "../auth/server-cookie";
import { validateSessionToken } from "../auth/session";
import type { Guardian, Institution, Session } from "@prisma/client";

export class GuardianAuthError extends Error {
  readonly code: "UNAUTHENTICATED" | "NOT_A_GUARDIAN" | "INACTIVE_GUARDIAN";
  readonly status: number;

  constructor(
    code: "UNAUTHENTICATED" | "NOT_A_GUARDIAN" | "INACTIVE_GUARDIAN",
    message: string,
    status = 401
  ) {
    super(message);
    this.name = "GuardianAuthError";
    this.code = code;
    this.status = status;
  }
}

export interface AuthenticatedGuardianSession {
  guardian: Guardian;
  institution: Institution;
  session: Session;
}

/**
 * Mengambil dan memvalidasi sesi wali murid dari HTTP-only cookie.
 * Mengembalikan objek Guardian, Institution, dan Session terotentikasi.
 * Melempar GuardianAuthError jika sesi tidak ada, kedaluwarsa, atau bukan sesi GUARDIAN.
 */
export async function getAuthenticatedGuardianSession(
  rawToken?: string
): Promise<AuthenticatedGuardianSession> {
  const token = rawToken || (await getSessionCookie());
  if (!token) {
    throw new GuardianAuthError(
      "UNAUTHENTICATED",
      "Sesi portal wali murid tidak ditemukan. Silakan masuk atau aktivasi akun Anda.",
      401
    );
  }

  const payload = await validateSessionToken(token);
  if (!payload) {
    throw new GuardianAuthError(
      "UNAUTHENTICATED",
      "Sesi Anda telah kedaluwarsa atau tidak valid. Silakan akses kembali melalui tautan undangan atau masuk ulang.",
      401
    );
  }

  if (payload.subjectType !== "GUARDIAN" || !payload.guardian) {
    throw new GuardianAuthError(
      "NOT_A_GUARDIAN",
      "Akses ditolak: Sesi aktif Anda bukan sesi portal wali murid.",
      403
    );
  }

  if (payload.guardian.status !== "ACTIVE") {
    throw new GuardianAuthError(
      "INACTIVE_GUARDIAN",
      "Akun wali murid Anda belum aktif atau telah dinonaktifkan.",
      403
    );
  }

  return {
    guardian: payload.guardian,
    institution: payload.institution,
    session: payload.session,
  };
}
