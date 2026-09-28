import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  syncAttendanceBatch,
  AttendanceOfflineStore,
  type OfflineAttendanceMutation,
  type CachedAttendanceRoster,
  type BatchSyncInput,
} from "../src/lib/attendance";
import { AttendanceAccessDeniedError, ResourceNotFoundError } from "../src/lib/attendance/types";
import { ValidationError } from "../src/lib/validation";

describe("Offline Attendance & Sync Engine Tests", () => {
  const instAId = "inst_pesantren_al_hikmah";
  const instBId = "inst_smpit_nurul_iman";

  // Contexts
  const teacherA1: TenantContext = {
    userId: "usr_teacher_a1",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "academic:view"],
    isSuperAdmin: false,
  };

  const teacherA2: TenantContext = {
    userId: "usr_teacher_a2",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "academic:view"],
    isSuperAdmin: false,
  };

  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: ["academic:view", "academic:manage", "attendance:view", "attendance:manage"],
    isSuperAdmin: false,
  };

  const unauthorizedTeacher: TenantContext = {
    userId: "usr_unauthorized",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view"], // Missing attendance:manage
    isSuperAdmin: false,
  };

  const teacherB: TenantContext = {
    userId: "usr_teacher_b",
    institutionId: instBId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage", "academic:view"],
    isSuperAdmin: false,
  };

  // In-Memory Data Store
  let inMemoryUsers: any[] = [];
  let inMemoryAcademicYears: any[] = [];
  let inMemoryClassrooms: any[] = [];
  let inMemorySubjects: any[] = [];
  let inMemoryAssignments: any[] = [];
  let inMemoryStudents: any[] = [];
  let inMemoryEnrollments: any[] = [];
  let inMemorySessions: any[] = [];
  let inMemoryRecords: any[] = [];

  beforeEach(() => {
    inMemoryUsers = [
      {
        id: "usr_teacher_a1",
        institutionId: instAId,
        name: "Ust. Ahmad Fauzi",
        email: "ahmad.fauzi@alhikmah.sch.id",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
      },
      {
        id: "usr_teacher_a2",
        institutionId: instAId,
        name: "Ustzh. Siti Aminah",
        email: "siti.aminah@alhikmah.sch.id",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
      },
      {
        id: "usr_admin_a",
        institutionId: instAId,
        name: "Admin Al-Hikmah",
        email: "admin@alhikmah.sch.id",
        roles: JSON.stringify(["ADMIN"]),
        isActive: true,
      },
      {
        id: "usr_teacher_b",
        institutionId: instBId,
        name: "Ust. Bachtiar",
        email: "bachtiar@nuruliman.sch.id",
        roles: JSON.stringify(["TEACHER"]),
        isActive: true,
      },
    ];

    inMemoryAcademicYears = [
      {
        id: "ay_2025_a",
        institutionId: instAId,
        name: "2025/2026 Ganjil",
        isActive: true,
      },
      {
        id: "ay_2025_b",
        institutionId: instBId,
        name: "2025/2026 Ganjil B",
        isActive: true,
      },
    ];

    inMemoryClassrooms = [
      {
        id: "cls_7a",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII A",
      },
      {
        id: "cls_7b",
        institutionId: instAId,
        academicYearId: "ay_2025_a",
        name: "VII B",
      },
      {
        id: "cls_7a_b",
        institutionId: instBId,
        academicYearId: "ay_2025_b",
        name: "VII A (Inst B)",
      },
    ];

    inMemorySubjects = [
      {
        id: "sub_mtk_a",
        institutionId: instAId,
        name: "Matematika",
        code: "MAT",
      },
    ];

    inMemoryAssignments = [
      {
        id: "asg_mtk_7a",
        institutionId: instAId,
        teacherId: "usr_teacher_a1",
        subjectId: "sub_mtk_a",
        classroomId: "cls_7a",
        academicYearId: "ay_2025_a",
      },
      {
        id: "asg_mtk_7b",
        institutionId: instAId,
        teacherId: "usr_teacher_a2",
        subjectId: "sub_mtk_a",
        classroomId: "cls_7b",
        academicYearId: "ay_2025_a",
      },
      {
        id: "asg_b",
        institutionId: instBId,
        teacherId: "usr_teacher_b",
        subjectId: "sub_b",
        classroomId: "cls_7a_b",
        academicYearId: "ay_2025_b",
      },
    ];

    inMemoryStudents = [
      {
        id: "std_1",
        institutionId: instAId,
        nis: "1001",
        nisn: "0010010001",
        fullName: "Ahmad Dahlan",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_2",
        institutionId: instAId,
        nis: "1002",
        nisn: "0010010002",
        fullName: "Budi Santoso",
        gender: "L",
        status: "ACTIVE",
      },
      {
        id: "std_3_cls7b",
        institutionId: instAId,
        nis: "1003",
        nisn: "0010010003",
        fullName: "Citra Dewi",
        gender: "P",
        status: "ACTIVE",
      },
      {
        id: "std_inst_b",
        institutionId: instBId,
        nis: "9001",
        nisn: "0090010001",
        fullName: "Fajar Pratama (Tenant B)",
        gender: "L",
        status: "ACTIVE",
      },
    ];

    inMemoryEnrollments = [
      {
        id: "enr_1",
        institutionId: instAId,
        studentId: "std_1",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7a",
        status: "ENROLLED",
      },
      {
        id: "enr_2",
        institutionId: instAId,
        studentId: "std_2",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7a",
        status: "ENROLLED",
      },
      {
        id: "enr_3_cls7b",
        institutionId: instAId,
        studentId: "std_3_cls7b",
        academicYearId: "ay_2025_a",
        classroomId: "cls_7b",
        status: "ENROLLED",
      },
      {
        id: "enr_inst_b",
        institutionId: instBId,
        studentId: "std_inst_b",
        academicYearId: "ay_2025_b",
        classroomId: "cls_7a_b",
        status: "ENROLLED",
      },
    ];

    inMemorySessions = [
      {
        id: "ses_open_1",
        institutionId: instAId,
        context: "CLASSROOM",
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: new Date("2026-09-28"),
        status: "OPEN",
        openedAt: new Date("2026-09-28T07:00:00Z"),
        closedAt: null,
        createdAt: new Date("2026-09-28T07:00:00Z"),
        updatedAt: new Date("2026-09-28T07:00:00Z"),
      },
      {
        id: "ses_closed_1",
        institutionId: instAId,
        context: "CLASSROOM",
        teacherAssignmentId: "asg_mtk_7a",
        attendanceDate: new Date("2026-09-27"),
        status: "CLOSED",
        openedAt: new Date("2026-09-27T07:00:00Z"),
        closedAt: new Date("2026-09-27T08:00:00Z"),
        createdAt: new Date("2026-09-27T07:00:00Z"),
        updatedAt: new Date("2026-09-27T08:00:00Z"),
      },
      {
        id: "ses_b_1",
        institutionId: instBId,
        context: "CLASSROOM",
        teacherAssignmentId: "asg_b",
        attendanceDate: new Date("2026-09-28"),
        status: "OPEN",
        openedAt: new Date("2026-09-28T07:00:00Z"),
        closedAt: null,
        createdAt: new Date("2026-09-28T07:00:00Z"),
        updatedAt: new Date("2026-09-28T07:00:00Z"),
      },
    ];

    inMemoryRecords = [];

    // PRISMA MOCKS
    (prisma.attendanceSession as any).findUnique = async ({ where }: any) => {
      const id = where?.id_institutionId?.id || where?.id;
      const instId = where?.id_institutionId?.institutionId;
      const s = inMemorySessions.find((item) => item.id === id && (!instId || item.institutionId === instId));
      if (!s) return null;

      const assignment = inMemoryAssignments.find((a) => a.id === s.teacherAssignmentId);
      return {
        ...s,
        teacherAssignment: assignment || null,
        dormitoryRoom: null,
      };
    };

    (prisma.enrollment as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemoryEnrollments];
      if (where?.institutionId) filtered = filtered.filter((e) => e.institutionId === where.institutionId);
      if (where?.academicYearId) filtered = filtered.filter((e) => e.academicYearId === where.academicYearId);
      if (where?.classroomId) filtered = filtered.filter((e) => e.classroomId === where.classroomId);
      if (where?.status) filtered = filtered.filter((e) => e.status === where.status);
      return filtered.map((e) => ({
        id: e.id,
        studentId: e.studentId,
      }));
    };

    (prisma.attendanceRecord as any).findMany = async ({ where }: any) => {
      let filtered = [...inMemoryRecords];
      if (where?.institutionId) filtered = filtered.filter((r) => r.institutionId === where.institutionId);
      if (where?.attendanceSessionId) filtered = filtered.filter((r) => r.attendanceSessionId === where.attendanceSessionId);
      return filtered;
    };

    (prisma.attendanceRecord as any).create = async ({ data }: any) => {
      const created = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      inMemoryRecords.push(created);
      return created;
    };

    (prisma.attendanceRecord as any).update = async ({ where, data }: any) => {
      const idx = inMemoryRecords.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error("Record not found");
      inMemoryRecords[idx] = {
        ...inMemoryRecords[idx],
        ...data,
        updatedAt: new Date(),
      };
      return inMemoryRecords[idx];
    };
  });

  // -------------------------------------------------------------
  // 1. OFFLINE STORAGE ABSTRACTION (AttendanceOfflineStore)
  // -------------------------------------------------------------
  describe("1. AttendanceOfflineStore Abstraction", () => {
    it("should queue mutations, retrieve them in FIFO order, and track status transitions", async () => {
      const store = new AttendanceOfflineStore();

      const mutation1: OfflineAttendanceMutation = {
        clientMutationId: "attendance:ses_1:std_1:mut_1",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "std_1",
        attendanceStatus: "PRESENT",
        note: "Hadir tepat waktu",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "PENDING",
        attempts: 0,
      };

      const mutation2: OfflineAttendanceMutation = {
        clientMutationId: "attendance:ses_1:std_2:mut_2",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "std_2",
        attendanceStatus: "SICK",
        note: "Demam",
        clientTimestamp: new Date(Date.now() + 100).toISOString(),
        syncStatus: "PENDING",
        attempts: 0,
      };

      await store.saveMutation(mutation1);
      await store.saveMutation(mutation2);

      let pending = await store.getPendingMutations();
      assert.equal(pending.length, 2);
      assert.equal(pending[0].clientMutationId, mutation1.clientMutationId);
      assert.equal(pending[1].clientMutationId, mutation2.clientMutationId);

      // Status transition: PENDING -> SYNCING
      await store.updateMutationStatus(mutation1.clientMutationId, "SYNCING");
      let m1 = await store.getMutation(mutation1.clientMutationId);
      assert.equal(m1?.syncStatus, "SYNCING");

      // Status transition: SYNCING -> SYNCED
      await store.updateMutationStatus(mutation1.clientMutationId, "SYNCED", {
        attendanceRecordId: "rec_server_123",
      });
      m1 = await store.getMutation(mutation1.clientMutationId);
      assert.equal(m1?.syncStatus, "SYNCED");
      assert.equal(m1?.attendanceRecordId, "rec_server_123");

      // Clear synced mutations
      const clearedCount = await store.clearSyncedMutations();
      assert.equal(clearedCount, 1);

      pending = await store.getPendingMutations();
      assert.equal(pending.length, 1);
      assert.equal(pending[0].clientMutationId, mutation2.clientMutationId);
    });

    it("should cache and retrieve offline roster correctly", async () => {
      const store = new AttendanceOfflineStore();

      const roster: CachedAttendanceRoster = {
        sessionId: "ses_open_1",
        institutionId: instAId,
        cachedAt: new Date().toISOString(),
        rosterData: {
          sessionId: "ses_open_1",
          sessionTitle: "VII A - Matematika",
          attendanceDate: "2026-09-28",
          context: "CLASSROOM",
          status: "OPEN",
          students: [
            { studentId: "std_1", nis: "1001", fullName: "Ahmad Dahlan", gender: "L", currentStatus: null },
            { studentId: "std_2", nis: "1002", fullName: "Budi Santoso", gender: "L", currentStatus: "PRESENT" },
          ],
        },
      };

      await store.cacheRoster(roster);
      const retrieved = await store.getCachedRoster("ses_open_1");

      assert.ok(retrieved);
      assert.equal(retrieved.sessionId, "ses_open_1");
      assert.equal(retrieved.rosterData.students.length, 2);
      assert.equal(retrieved.rosterData.students[0].fullName, "Ahmad Dahlan");
    });
  });

  // -------------------------------------------------------------
  // 2. SERVER-SIDE BATCH SYNC & IDEMPOTENCY
  // -------------------------------------------------------------
  describe("2. Server-Side Batch Sync Engine & Idempotency", () => {
    it("should successfully process a batch of offline mutations", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:1",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
            note: "Hadir tepat waktu",
            clientTimestamp: new Date().toISOString(),
          },
          {
            clientMutationId: "attendance:ses_open_1:std_2:2",
            sessionId: "ses_open_1",
            studentId: "std_2",
            status: "SICK",
            note: "Surat dokter terlampir",
            clientTimestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await syncAttendanceBatch(teacherA1, input);

      assert.equal(result.sessionId, "ses_open_1");
      assert.equal(result.processedCount, 2);
      assert.equal(result.syncedCount, 2);
      assert.equal(result.conflictCount, 0);
      assert.equal(result.rejectedCount, 0);

      assert.equal(result.results[0].status, "SYNCED");
      assert.equal(result.results[1].status, "SYNCED");
      assert.equal(inMemoryRecords.length, 2);
    });

    it("should be strictly IDEMPOTENT: repeated sync of identical data does not create duplicates or fail", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:1",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
            note: "Hadir",
            clientTimestamp: new Date().toISOString(),
          },
        ],
      };

      // First sync
      const firstResult = await syncAttendanceBatch(teacherA1, input);
      assert.equal(firstResult.syncedCount, 1);
      assert.equal(inMemoryRecords.length, 1);
      const originalRecordId = inMemoryRecords[0].id;

      // Duplicate sync (e.g. client retried due to connection drop during response receipt)
      const secondResult = await syncAttendanceBatch(teacherA1, input);
      assert.equal(secondResult.syncedCount, 1);
      assert.equal(secondResult.results[0].status, "SYNCED");
      assert.equal(secondResult.results[0].recordId, originalRecordId);
      assert.match(secondResult.results[0].message || "", /idempotent/i);

      // Verify no duplicate records created in database
      assert.equal(inMemoryRecords.length, 1);
    });
  });

  // -------------------------------------------------------------
  // 3. CONFLICT HANDLING
  // -------------------------------------------------------------
  describe("3. Conflict Detection & Resolution Policy", () => {
    it("should detect CONFLICT when server data is modified after client base snapshot (no silent overwrite)", async () => {
      // Step 1: Server initial record marked by another teacher / admin
      const initialServerTime = new Date("2026-09-28T07:15:00Z");
      inMemoryRecords.push({
        id: "rec_std1_server",
        institutionId: instAId,
        attendanceSessionId: "ses_open_1",
        studentId: "std_1",
        enrollmentId: "enr_1",
        status: "EXCUSED", // Server has EXCUSED
        note: "Izin dinas",
        markedAt: initialServerTime,
        createdAt: initialServerTime,
        updatedAt: initialServerTime,
      });

      // Step 2: Offline client tries to mark PRESENT with an older snapshot base time
      const olderBaseTime = new Date("2026-09-28T07:00:00Z").toISOString();
      const conflictInput: BatchSyncInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:offline_mark",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
            baseUpdatedAt: olderBaseTime, // Client had older version
            forceOverwrite: false,
          },
        ],
      };

      const result = await syncAttendanceBatch(teacherA1, conflictInput);

      assert.equal(result.conflictCount, 1);
      assert.equal(result.syncedCount, 0);
      assert.equal(result.results[0].status, "CONFLICT");
      assert.equal(result.results[0].serverStatus, "EXCUSED");
      assert.ok(result.results[0].message?.includes("Konflik"));

      // Verify server record was NOT silently overwritten
      assert.equal(inMemoryRecords[0].status, "EXCUSED");
    });

    it("should allow teacher to force overwrite conflict when explicitly chosen", async () => {
      // Server record
      const serverTime = new Date("2026-09-28T07:20:00Z");
      inMemoryRecords.push({
        id: "rec_std1_server",
        institutionId: instAId,
        attendanceSessionId: "ses_open_1",
        studentId: "std_1",
        enrollmentId: "enr_1",
        status: "EXCUSED",
        note: null,
        markedAt: serverTime,
        createdAt: serverTime,
        updatedAt: serverTime,
      });

      // Teacher chooses "Timpa ke Server" (forceOverwrite: true)
      const overwriteInput: BatchSyncInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:force_mark",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
            baseUpdatedAt: new Date("2026-09-28T07:00:00Z").toISOString(),
            forceOverwrite: true,
          },
        ],
      };

      const result = await syncAttendanceBatch(teacherA1, overwriteInput);

      assert.equal(result.conflictCount, 0);
      assert.equal(result.syncedCount, 1);
      assert.equal(result.results[0].status, "SYNCED");
      assert.equal(inMemoryRecords[0].status, "PRESENT");
    });

    it("should mark CONFLICT if attendance session was already CLOSED on server", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_closed_1", // Session is already CLOSED
        mutations: [
          {
            clientMutationId: "attendance:ses_closed_1:std_1:1",
            sessionId: "ses_closed_1",
            studentId: "std_1",
            status: "PRESENT",
          },
        ],
      };

      const result = await syncAttendanceBatch(teacherA1, input);

      assert.equal(result.conflictCount, 1);
      assert.equal(result.syncedCount, 0);
      assert.equal(result.results[0].status, "CONFLICT");
      assert.match(result.results[0].message || "", /CLOSED/i);
    });
  });

  // -------------------------------------------------------------
  // 4. SECURITY, RBAC & TENANT ISOLATION
  // -------------------------------------------------------------
  describe("4. Security, RBAC & Tenant Boundary Enforcement", () => {
    it("should reject sync if user lacks attendance:manage permission", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:1",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
          },
        ],
      };

      await assert.rejects(
        () => syncAttendanceBatch(unauthorizedTeacher, input),
        /Akses ditolak|tidak memiliki izin/i
      );
    });

    it("should reject teacher attempting to sync another teacher's attendance session", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_open_1", // Belongs to teacherA1
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_1:1",
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "PRESENT",
          },
        ],
      };

      // teacherA2 attempts to sync teacherA1's session
      await assert.rejects(
        () => syncAttendanceBatch(teacherA2, input),
        AttendanceAccessDeniedError
      );
    });

    it("should strictly reject cross-tenant sync attempt", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_b_1", // Belongs to Tenant B
        mutations: [
          {
            clientMutationId: "attendance:ses_b_1:std_inst_b:1",
            sessionId: "ses_b_1",
            studentId: "std_inst_b",
            status: "PRESENT",
          },
        ],
      };

      // Teacher from Tenant A attempts to sync Tenant B's session
      await assert.rejects(
        () => syncAttendanceBatch(teacherA1, input),
        ResourceNotFoundError
      );
    });

    it("should reject mutations for students NOT enrolled in the session's classroom", async () => {
      const input: BatchSyncInput = {
        sessionId: "ses_open_1", // VII A session
        mutations: [
          {
            clientMutationId: "attendance:ses_open_1:std_3_cls7b:1",
            sessionId: "ses_open_1",
            studentId: "std_3_cls7b", // Enrolled in VII B, not VII A
            status: "PRESENT",
          },
        ],
      };

      const result = await syncAttendanceBatch(teacherA1, input);

      assert.equal(result.rejectedCount, 1);
      assert.equal(result.syncedCount, 0);
      assert.equal(result.results[0].status, "REJECTED");
      assert.match(result.results[0].message || "", /bukan anggota terdaftar/i);
    });

    it("should validate mutation input schema with Zod", async () => {
      const invalidInput = {
        sessionId: "ses_open_1",
        mutations: [
          {
            clientMutationId: "", // Empty clientMutationId
            sessionId: "ses_open_1",
            studentId: "std_1",
            status: "INVALID_STATUS",
          },
        ],
      };

      await assert.rejects(
        () => syncAttendanceBatch(teacherA1, invalidInput),
        (err: any) => err.name === "ZodError"
      );
    });
  });

  // -------------------------------------------------------------
  // 5. CLIENT SYNC WORKER & QUEUE STATS
  // -------------------------------------------------------------
  describe("5. Client Sync Worker & Queue Stats", () => {
    it("should accurately compute queue stats across all mutation states", async () => {
      const store = new AttendanceOfflineStore();
      store._resetMemoryStore();

      await store.saveMutation({
        clientMutationId: "m1",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "s1",
        attendanceStatus: "PRESENT",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "PENDING",
        attempts: 0,
      });

      await store.saveMutation({
        clientMutationId: "m2",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "s2",
        attendanceStatus: "SICK",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "SYNCING",
        attempts: 1,
      });

      await store.saveMutation({
        clientMutationId: "m3",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "s3",
        attendanceStatus: "EXCUSED",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "SYNCED",
        attempts: 1,
      });

      await store.saveMutation({
        clientMutationId: "m4",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "s4",
        attendanceStatus: "ABSENT",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "FAILED",
        attempts: 2,
      });

      await store.saveMutation({
        clientMutationId: "m5",
        institutionId: instAId,
        userId: "usr_teacher_a1",
        sessionId: "ses_1",
        studentId: "s5",
        attendanceStatus: "PRESENT",
        clientTimestamp: new Date().toISOString(),
        syncStatus: "CONFLICT",
        attempts: 1,
      });

      const stats = await store.getQueueStats("ses_1");
      assert.equal(stats.total, 5);
      assert.equal(stats.pending, 1);
      assert.equal(stats.syncing, 1);
      assert.equal(stats.synced, 1);
      assert.equal(stats.failed, 1);
      assert.equal(stats.conflict, 1);
    });
  });
});

