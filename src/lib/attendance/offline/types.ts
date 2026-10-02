import { AttendanceStatus } from "../types";

export type OfflineSyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface OfflineAttendanceMutation {
  clientMutationId: string; // Deterministic ID: attendance:{sessionId}:{studentId}:{uuid/hash}
  institutionId: string;
  userId: string;
  sessionId: string;
  studentId: string;
  attendanceRecordId?: string | null;
  attendanceStatus: AttendanceStatus;
  note?: string | null;
  baseUpdatedAt?: string | null; // Timestamp of record on client before offline edit
  clientTimestamp: string;
  syncStatus: OfflineSyncStatus;
  attempts: number;
  lastAttemptAt?: string | null;
  errorMessage?: string | null;
  conflictData?: {
    serverStatus: AttendanceStatus;
    serverUpdatedAt: string;
    reason: string;
  } | null;
}

export interface CachedAttendanceRoster {
  sessionId: string;
  institutionId: string;
  cachedAt: string;
  rosterData: any; // Full AttendanceRosterResult
}

export interface BatchSyncItemInput {
  clientMutationId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
  baseUpdatedAt?: string | null;
  clientTimestamp?: string | null;
  forceOverwrite?: boolean; // For explicit user conflict resolution
}

export interface BatchSyncInput {
  sessionId: string;
  mutations: BatchSyncItemInput[];
}

export interface BatchSyncItemResult {
  clientMutationId: string;
  studentId: string;
  status: "SYNCED" | "CONFLICT" | "REJECTED" | "RETRYABLE";
  recordId?: string;
  serverStatus?: AttendanceStatus;
  serverUpdatedAt?: string;
  message?: string;
}

export interface BatchSyncResult {
  sessionId: string;
  processedCount: number;
  syncedCount: number;
  conflictCount: number;
  rejectedCount: number;
  results: BatchSyncItemResult[];
}
