import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  userId: string;
  institutionId: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  impersonatedByUserId?: string;
}

export class TenantAccessDeniedError extends Error {
  readonly code = "TENANT_ACCESS_DENIED";
  readonly status = 403;
  readonly attemptedTenantId: string;
  readonly userTenantId: string;

  constructor(attemptedTenantId: string, userTenantId: string, message?: string) {
    super(
      message ||
        `Akses lintas-lembaga ditolak: Anda terdaftar pada institusi [${userTenantId}], tidak diizinkan mengakses data institusi [${attemptedTenantId}].`
    );
    this.name = "TenantAccessDeniedError";
    this.attemptedTenantId = attemptedTenantId;
    this.userTenantId = userTenantId;
  }
}

/**
 * Alasan sebuah TenantContext tidak tersedia. Dipakai lapisan server action
 * untuk membedakan "sesi berakhir" (wajib diarahkan ke login) dari kasus lain
 * yang tetap harus ditampilkan sebagai kegagalan biasa.
 */
export type SessionFailureReason =
  | "SESSION_MISSING"
  | "SESSION_INVALID"
  | "NOT_INTERNAL"
  | "NO_CONTEXT";

export class TenantContextMissingError extends Error {
  readonly code = "TENANT_CONTEXT_MISSING";
  readonly status = 401;
  readonly reason: SessionFailureReason;

  constructor(
    message = "Konteks lembaga tidak ditemukan. Operasi ini memerlukan sesi terotentikasi.",
    reason: SessionFailureReason = "NO_CONTEXT"
  ) {
    super(message);
    this.name = "TenantContextMissingError";
    this.reason = reason;
  }
}

// Storage untuk isolasi konteks per call-stack asynchronous (zero-leak across concurrent requests)
const tenantAsyncStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Menjalankan fungsi di dalam cakupan TenantContext tertentu menggunakan AsyncLocalStorage.
 */
export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantAsyncStorage.run(context, fn);
}

/**
 * Mengambil TenantContext dari call stack saat ini (jika ada).
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantAsyncStorage.getStore();
}

/**
 * Mengambil TenantContext atau melempar TenantContextMissingError jika belum diset.
 */
export function requireTenantContext(): TenantContext {
  const context = tenantAsyncStorage.getStore();
  if (!context) {
    throw new TenantContextMissingError();
  }
  return context;
}
