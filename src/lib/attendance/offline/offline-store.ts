import {
  OfflineAttendanceMutation,
  CachedAttendanceRoster,
  OfflineSyncStatus,
} from "./types";

const DB_NAME = "natasekolah_offline_v1";
const DB_VERSION = 1;
const STORE_MUTATIONS = "attendance_mutations";
const STORE_ROSTERS = "roster_cache";

class MemoryStorageFallback {
  private mutations = new Map<string, OfflineAttendanceMutation>();
  private rosters = new Map<string, CachedAttendanceRoster>();

  async saveRoster(sessionId: string, institutionId: string, rosterData: any) {
    this.rosters.set(sessionId, {
      sessionId,
      institutionId,
      cachedAt: new Date().toISOString(),
      rosterData,
    });
  }

  async getRoster(sessionId: string) {
    const item = this.rosters.get(sessionId);
    return item ? item.rosterData : null;
  }

  async cacheRoster(roster: CachedAttendanceRoster) {
    this.rosters.set(roster.sessionId, roster);
  }

  async getCachedRoster(sessionId: string) {
    return this.rosters.get(sessionId) || null;
  }

  async saveMutation(mutation: OfflineAttendanceMutation) {
    this.mutations.set(mutation.clientMutationId, mutation);
    return mutation;
  }

  async getMutation(clientMutationId: string) {
    return this.mutations.get(clientMutationId) || null;
  }

  async getAllMutations(sessionId?: string) {
    const list = Array.from(this.mutations.values());
    if (sessionId) {
      return list.filter((m) => m.sessionId === sessionId);
    }
    return list;
  }

  async updateMutation(clientMutationId: string, update: Partial<OfflineAttendanceMutation>) {
    const existing = this.mutations.get(clientMutationId);
    if (existing) {
      const updated = { ...existing, ...update };
      this.mutations.set(clientMutationId, updated);
    }
  }

  async removeMutation(clientMutationId: string) {
    this.mutations.delete(clientMutationId);
  }

  async clearSynced(sessionId?: string) {
    let count = 0;
    for (const [id, m] of this.mutations.entries()) {
      if (m.syncStatus === "SYNCED" && (!sessionId || m.sessionId === sessionId)) {
        this.mutations.delete(id);
        count++;
      }
    }
    return count;
  }

  clearAll() {
    this.mutations.clear();
    this.rosters.clear();
  }
}

export class AttendanceOfflineStore {
  private static instance: AttendanceOfflineStore | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = new MemoryStorageFallback();
  private isBrowserIndexedDBSupported: boolean;

  constructor() {
    this.isBrowserIndexedDBSupported =
      typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  }

  public static getInstance(): AttendanceOfflineStore {
    if (!AttendanceOfflineStore.instance) {
      AttendanceOfflineStore.instance = new AttendanceOfflineStore();
    }
    return AttendanceOfflineStore.instance;
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isBrowserIndexedDBSupported) {
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event: any) => {
          const db = event.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
            const store = db.createObjectStore(STORE_MUTATIONS, {
              keyPath: "clientMutationId",
            });
            store.createIndex("sessionId", "sessionId", { unique: false });
            store.createIndex("syncStatus", "syncStatus", { unique: false });
            store.createIndex("sessionId_studentId", ["sessionId", "studentId"], {
              unique: false,
            });
          }
          if (!db.objectStoreNames.contains(STORE_ROSTERS)) {
            db.createObjectStore(STORE_ROSTERS, { keyPath: "sessionId" });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[OfflineStore] Failed to open IndexedDB, falling back to memory storage.");
          resolve(null as any);
        };
      });
    }

    return this.dbPromise;
  }

  /**
   * Caches active roster for offline viewing
   */
  async saveRosterCache(sessionId: string, institutionId: string, rosterData: any): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      await this.memoryFallback.saveRoster(sessionId, institutionId, rosterData);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROSTERS, "readwrite");
      const store = tx.objectStore(STORE_ROSTERS);
      const payload: CachedAttendanceRoster = {
        sessionId,
        institutionId,
        cachedAt: new Date().toISOString(),
        rosterData,
      };
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async cacheRoster(roster: CachedAttendanceRoster): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      await this.memoryFallback.cacheRoster(roster);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROSTERS, "readwrite");
      const store = tx.objectStore(STORE_ROSTERS);
      const req = store.put(roster);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedRoster(sessionId: string): Promise<CachedAttendanceRoster | null> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.getCachedRoster(sessionId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ROSTERS, "readonly");
      const store = tx.objectStore(STORE_ROSTERS);
      const req = store.get(sessionId);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Retrieves cached roster for a session
   */
  async getRosterCache(sessionId: string): Promise<any | null> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.getRoster(sessionId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ROSTERS, "readonly");
      const store = tx.objectStore(STORE_ROSTERS);
      const req = store.get(sessionId);
      req.onsuccess = () => {
        if (req.result && req.result.rosterData) {
          resolve(req.result.rosterData);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Direct save of mutation
   */
  async saveMutation(mutation: OfflineAttendanceMutation): Promise<OfflineAttendanceMutation> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.saveMutation(mutation);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.put(mutation);
      req.onsuccess = () => resolve(mutation);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Queues an attendance mutation into local offline storage
   */
  async queueMutation(
    mutationData: Omit<OfflineAttendanceMutation, "syncStatus" | "attempts">
  ): Promise<OfflineAttendanceMutation> {
    const mutation: OfflineAttendanceMutation = {
      ...mutationData,
      syncStatus: "PENDING",
      attempts: 0,
      clientTimestamp: mutationData.clientTimestamp || new Date().toISOString(),
    };

    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.saveMutation(mutation);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.put(mutation);
      req.onsuccess = () => resolve(mutation);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves mutations that are pending or need sync
   */
  async getPendingMutations(sessionId?: string): Promise<OfflineAttendanceMutation[]> {
    const all = await this.getAllMutations(sessionId);
    return all.filter((m) => m.syncStatus === "PENDING" || m.syncStatus === "FAILED");
  }

  /**
   * Retrieves all mutations optionally filtered by session
   */
  async getAllMutations(sessionId?: string): Promise<OfflineAttendanceMutation[]> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.getAllMutations(sessionId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_MUTATIONS, "readonly");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        let results = (req.result || []) as OfflineAttendanceMutation[];
        if (sessionId) {
          results = results.filter((m) => m.sessionId === sessionId);
        }
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Retrieves a single mutation by clientMutationId
   */
  async getMutation(clientMutationId: string): Promise<OfflineAttendanceMutation | null> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.getMutation(clientMutationId);
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_MUTATIONS, "readonly");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.get(clientMutationId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Updates mutation sync status and result
   */
  async updateMutationStatus(
    clientMutationId: string,
    statusOrUpdate: OfflineSyncStatus | Partial<OfflineAttendanceMutation>,
    extra?: Partial<OfflineAttendanceMutation>
  ): Promise<void> {
    const update: Partial<OfflineAttendanceMutation> =
      typeof statusOrUpdate === "string"
        ? { syncStatus: statusOrUpdate, ...extra }
        : statusOrUpdate;

    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.updateMutation(clientMutationId, update);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const getReq = store.get(clientMutationId);

      getReq.onsuccess = () => {
        if (!getReq.result) {
          resolve();
          return;
        }
        const updated = { ...getReq.result, ...update };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Removes a single mutation
   */
  async removeMutation(clientMutationId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.removeMutation(clientMutationId);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      const req = store.delete(clientMutationId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Cleans up successfully synced mutations
   */
  async clearSyncedMutations(sessionId?: string): Promise<number> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryFallback.clearSynced(sessionId);
    }

    const mutations = await this.getAllMutations(sessionId);
    const synced = mutations.filter((m) => m.syncStatus === "SYNCED");

    if (synced.length === 0) return 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTATIONS, "readwrite");
      const store = tx.objectStore(STORE_MUTATIONS);
      for (const item of synced) {
        store.delete(item.clientMutationId);
      }
      tx.oncomplete = () => resolve(synced.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Calculates mutation stats for UI indicators
   */
  async getQueueStats(sessionId?: string): Promise<{
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    conflict: number;
  }> {
    const mutations = await this.getAllMutations(sessionId);
    const stats = {
      total: mutations.length,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      conflict: 0,
    };

    for (const m of mutations) {
      if (m.syncStatus === "PENDING") stats.pending++;
      else if (m.syncStatus === "SYNCING") stats.syncing++;
      else if (m.syncStatus === "SYNCED") stats.synced++;
      else if (m.syncStatus === "FAILED") stats.failed++;
      else if (m.syncStatus === "CONFLICT") stats.conflict++;
    }

    return stats;
  }

  /**
   * Test helper to reset store
   */
  _resetMemoryStore() {
    this.memoryFallback.clearAll();
  }
}
