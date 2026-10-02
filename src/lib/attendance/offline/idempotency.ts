import { AttendanceStatus } from "../types";

export interface RecordedMutationDetails {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
  recordId?: string;
  clientMutationId: string;
  clientTimestamp?: string | null;
}

/**
 * Fast, isomorphic, collision-resistant string hasher that runs in both browser and Node.js.
 */
export function fastHashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}

/**
 * Generate a deterministic primary key for AuditLog entry tracking an offline attendance mutation.
 * This guarantees database-level uniqueness per tenant and mutation ID.
 */
export function generateDeterministicMutationLogId(
  institutionId: string,
  clientMutationId: string
): string {
  const hash = fastHashString(`${institutionId}:${clientMutationId}`);
  return `audit_mut_${hash}`;
}

/**
 * Generates a deterministic clientMutationId representing a specific local mutation.
 * If a custom suffix/nonce is provided, it formats: attendance:{sessionId}:{studentId}:{suffix}.
 * If a payload object is provided, it produces a deterministic hash from status, note, and baseUpdatedAt.
 */
export function generateClientMutationId(
  sessionId: string,
  studentId: string,
  payloadOrSuffix:
    | {
        status: string;
        note?: string | null;
        baseUpdatedAt?: string | null;
      }
    | string
): string {
  if (typeof payloadOrSuffix === "string") {
    return `attendance:${sessionId}:${studentId}:${payloadOrSuffix}`;
  }

  const rawSignature = `${payloadOrSuffix.status}:${payloadOrSuffix.note ?? ""}:${payloadOrSuffix.baseUpdatedAt ?? "initial"}`;
  const hash = fastHashString(rawSignature).substring(0, 12);

  return `attendance:${sessionId}:${studentId}:${hash}`;
}
