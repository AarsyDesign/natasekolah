/**
 * Domain types, constants, and validation guards for NataSekolah Identity & Access.
 */

export const SESSION_SUBJECT_TYPES = ["INTERNAL_USER", "GUARDIAN"] as const;
export type SessionSubjectType = typeof SESSION_SUBJECT_TYPES[number];

export const GUARDIAN_RELATIONSHIPS = [
  "AYAH",
  "IBU",
  "WALI",
  "LAINNYA",
] as const;
export type GuardianRelationship = typeof GUARDIAN_RELATIONSHIPS[number];

export const GUARDIAN_STATUSES = [
  "INVITED",
  "ACTIVE",
  "INACTIVE",
] as const;
export type GuardianStatus = typeof GUARDIAN_STATUSES[number];

export const INVITATION_STATUSES = [
  "PENDING",
  "REDEEMED",
  "EXPIRED",
  "REVOKED",
] as const;
export type InvitationStatus = typeof INVITATION_STATUSES[number];

/**
 * Validasi apakah string merupakan SessionSubjectType yang valid.
 */
export function isValidSessionSubjectType(val: unknown): val is SessionSubjectType {
  return typeof val === "string" && SESSION_SUBJECT_TYPES.includes(val as SessionSubjectType);
}

/**
 * Validasi apakah string merupakan GuardianRelationship yang valid.
 */
export function isValidGuardianRelationship(val: unknown): val is GuardianRelationship {
  return typeof val === "string" && GUARDIAN_RELATIONSHIPS.includes(val as GuardianRelationship);
}

/**
 * Validasi apakah string merupakan GuardianStatus yang valid.
 */
export function isValidGuardianStatus(val: unknown): val is GuardianStatus {
  return typeof val === "string" && GUARDIAN_STATUSES.includes(val as GuardianStatus);
}
