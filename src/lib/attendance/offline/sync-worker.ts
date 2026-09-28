import { AttendanceOfflineStore } from "./offline-store";
import { syncAttendanceBatchAction } from "../../../actions/attendance";
import { BatchSyncItemInput, BatchSyncResult } from "./types";

export interface SyncProgressCallback {
  (status: "IDLE" | "SYNCING" | "SUCCESS" | "ERROR", message?: string): void;
}

export class AttendanceSyncWorker {
  private static instance: AttendanceSyncWorker | null = null;
  private store: AttendanceOfflineStore;
  private isSyncing = false;
  private listeners: Set<SyncProgressCallback> = new Set();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor() {
    this.store = AttendanceOfflineStore.getInstance();
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notifyListeners("IDLE", "Koneksi internet pulih. Memulai sinkronisasi...");
        this.syncAllSessions();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.notifyListeners("IDLE", "Koneksi terputus. Bekerja dalam mode offline.");
      });
    }
  }

  public static getInstance(): AttendanceSyncWorker {
    if (!AttendanceSyncWorker.instance) {
      AttendanceSyncWorker.instance = new AttendanceSyncWorker();
    }
    return AttendanceSyncWorker.instance;
  }

  public subscribe(cb: SyncProgressCallback) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(status: "IDLE" | "SYNCING" | "SUCCESS" | "ERROR", message?: string) {
    for (const listener of this.listeners) {
      try {
        listener(status, message);
      } catch (err) {
        console.error("[SyncWorker] Error in listener:", err);
      }
    }
  }

  public getOnlineStatus(): boolean {
    if (typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Syncs pending mutations for a specific session
   */
  async syncSession(sessionId: string): Promise<BatchSyncResult | null> {
    if (this.isSyncing) {
      return null;
    }

    const pending = await this.store.getPendingMutations(sessionId);
    if (pending.length === 0) {
      return null;
    }

    this.isSyncing = true;
    this.notifyListeners("SYNCING", `Menyinkronkan ${pending.length} perubahan...`);

    // Mark as SYNCING locally
    for (const item of pending) {
      await this.store.updateMutationStatus(item.clientMutationId, {
        syncStatus: "SYNCING",
        attempts: item.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
      });
    }

    const payload: BatchSyncItemInput[] = pending.map((m) => ({
      clientMutationId: m.clientMutationId,
      sessionId: m.sessionId,
      studentId: m.studentId,
      status: m.attendanceStatus,
      note: m.note,
      baseUpdatedAt: m.baseUpdatedAt,
      clientTimestamp: m.clientTimestamp,
      forceOverwrite: false,
    }));

    try {
      const res = await syncAttendanceBatchAction({
        sessionId,
        mutations: payload,
      });

      if (!res.success || !res.data) {
        const errorMsg = res.error || "Gagal menghubungi server untuk sinkronisasi.";
        for (const item of pending) {
          await this.store.updateMutationStatus(item.clientMutationId, {
            syncStatus: "FAILED",
            errorMessage: errorMsg,
          });
        }
        this.notifyListeners("ERROR", errorMsg);
        this.isSyncing = false;
        return null;
      }

      const syncResult = res.data as BatchSyncResult;

      // Update local status based on server response per item
      for (const itemResult of syncResult.results) {
        if (itemResult.status === "SYNCED") {
          await this.store.updateMutationStatus(itemResult.clientMutationId, {
            syncStatus: "SYNCED",
            attendanceRecordId: itemResult.recordId,
            errorMessage: null,
            conflictData: null,
          });
        } else if (itemResult.status === "CONFLICT") {
          await this.store.updateMutationStatus(itemResult.clientMutationId, {
            syncStatus: "CONFLICT",
            attendanceRecordId: itemResult.recordId,
            errorMessage: itemResult.message,
            conflictData: {
              serverStatus: itemResult.serverStatus || "PRESENT",
              serverUpdatedAt: itemResult.serverUpdatedAt || new Date().toISOString(),
              reason: itemResult.message || "Data di server telah diperbarui oleh pengguna lain.",
            },
          });
        } else if (itemResult.status === "REJECTED") {
          await this.store.updateMutationStatus(itemResult.clientMutationId, {
            syncStatus: "FAILED",
            errorMessage: itemResult.message || "Mutasi ditolak oleh server.",
          });
        }
      }

      const successSummary = `${syncResult.syncedCount} tersinkron, ${syncResult.conflictCount} konflik, ${syncResult.rejectedCount} ditolak.`;
      this.notifyListeners(syncResult.conflictCount > 0 ? "ERROR" : "SUCCESS", successSummary);
      this.isSyncing = false;
      return syncResult;
    } catch (networkError: unknown) {
      const msg = networkError instanceof Error ? networkError.message : "Jaringan tidak tersedia.";
      for (const item of pending) {
        await this.store.updateMutationStatus(item.clientMutationId, {
          syncStatus: "FAILED",
          errorMessage: msg,
        });
      }
      this.notifyListeners("ERROR", `Koneksi gagal: ${msg}`);
      this.isSyncing = false;
      return null;
    }
  }

  /**
   * Resolves a conflict: user decides to keep server data or force overwrite
   */
  async resolveConflict(
    clientMutationId: string,
    action: "KEEP_SERVER" | "FORCE_LOCAL"
  ): Promise<void> {
    const mutation = await this.store.getMutation(clientMutationId);
    if (!mutation) return;

    if (action === "KEEP_SERVER") {
      // Remove local mutation or accept server status
      await this.store.removeMutation(clientMutationId);
      this.notifyListeners("SUCCESS", "Pilihan server dipertahankan.");
    } else {
      // Force local: send with forceOverwrite = true
      this.notifyListeners("SYNCING", "Menimpa data server dengan pilihan lokal...");
      const res = await syncAttendanceBatchAction({
        sessionId: mutation.sessionId,
        mutations: [
          {
            clientMutationId: mutation.clientMutationId,
            sessionId: mutation.sessionId,
            studentId: mutation.studentId,
            status: mutation.attendanceStatus,
            note: mutation.note,
            baseUpdatedAt: null, // Reset base to bypass conflict
            clientTimestamp: new Date().toISOString(),
            forceOverwrite: true,
          },
        ],
      });

      if (res.success && res.data && res.data.syncedCount > 0) {
        await this.store.updateMutationStatus(clientMutationId, {
          syncStatus: "SYNCED",
          conflictData: null,
          errorMessage: null,
        });
        this.notifyListeners("SUCCESS", "Perubahan lokal berhasil dipaksakan ke server.");
      } else {
        const errorMsg = res.error || "Gagal memaksakan perubahan ke server.";
        this.notifyListeners("ERROR", errorMsg);
      }
    }
  }

  /**
   * Background scan for any pending sessions
   */
  async syncAllSessions(): Promise<void> {
    const pending = await this.store.getPendingMutations();
    if (pending.length === 0) return;

    const sessionIds = Array.from(new Set(pending.map((p) => p.sessionId)));
    for (const sid of sessionIds) {
      await this.syncSession(sid);
    }
  }
}
