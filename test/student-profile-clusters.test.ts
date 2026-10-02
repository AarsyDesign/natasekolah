import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  getStudentProfileClusters,
  upsertStudentCluster,
} from "../src/lib/student/profile-service";
import {
  validateUpsertStudentClusterInput,
  PROFILE_CLUSTERS,
  BLOOD_TYPES,
} from "../src/lib/validation/student-profile";
import { ValidationError } from "../src/lib/validation/common";
import { ResourceNotFoundError } from "../src/lib/academic/types";
import { AuthorizationError } from "../src/lib/auth/permissions";

/**
 * Phase 9.3 — Student Full Profile (5 Kluster Dapodik/EMIS) Tests.
 *
 * Menggunakan fake `tx` in-memory (layanan menerima `tx` sebagai parameter)
 * sehingga pengujian tidak menyentuh DB maupun mock global.
 */
describe("Phase 9.3 — Student Full Profile (Kluster Dapodik/EMIS)", () => {
  const instAId = "inst_school_a";
  const instBId = "inst_school_b";

  const adminA: TenantContext = {
    userId: "usr_admin_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: ["student:view", "student:create", "student:edit", "student:archive"],
    isSuperAdmin: false,
  };

  const viewerA: TenantContext = {
    userId: "usr_viewer_a",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["student:view"],
    isSuperAdmin: false,
  };

  const teacherA: TenantContext = {
    userId: "usr_teacher_a",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["attendance:view", "attendance:manage"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: ["student:view", "student:edit"],
    isSuperAdmin: false,
  };

  const guardianCtx = {
    guardianId: "gdw_1",
    institutionId: instAId,
    roles: [],
    permissions: [],
    isSuperAdmin: false,
    subjectType: "GUARDIAN",
  } as unknown as TenantContext;

  const inMemoryStudents = [
    {
      id: "std_a1",
      institutionId: instAId,
      nis: "2001",
      nisn: "0099887766",
      fullName: "Fatimah Az-Zahra",
      status: "ACTIVE",
    },
    {
      id: "std_b1",
      institutionId: instBId,
      nis: "9001",
      nisn: null,
      fullName: "Santri B",
      status: "ACTIVE",
    },
  ];

  let rows: Record<string, any[]>;
  let auditLogs: any[];
  let tx: any;

  function makeDelegate(store: any[]) {
    return {
      findUnique: async ({ where }: any) => {
        const k = where?.studentId_institutionId;
        if (!k) return null;
        return (
          store.find(
            (r) => r.studentId === k.studentId && r.institutionId === k.institutionId
          ) ?? null
        );
      },
      create: async ({ data }: any) => {
        const row = {
          id: `row_${store.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const k = where?.studentId_institutionId;
        const row = store.find(
          (r) => r.studentId === k?.studentId && r.institutionId === k?.institutionId
        );
        if (!row) throw new Error("P2025: Record not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    };
  }

  beforeEach(() => {
    rows = {
      studentFamilyData: [],
      studentHealthData: [],
      studentRegistryData: [],
    };
    auditLogs = [];
    tx = {
      student: {
        findUnique: async ({ where }: any) => {
          const k = where?.id_institutionId;
          if (!k) return null;
          return (
            inMemoryStudents.find(
              (s) => s.id === k.id && s.institutionId === k.institutionId
            ) ?? null
          );
        },
      },
      studentFamilyData: makeDelegate(rows.studentFamilyData),
      studentHealthData: makeDelegate(rows.studentHealthData),
      studentRegistryData: makeDelegate(rows.studentRegistryData),
      auditLog: {
        create: async ({ data }: any) => {
          auditLogs.push(data);
          return data;
        },
      },
    };
  });

  // -------------------------------------------------------------------------
  // Zod Validation Boundary
  // -------------------------------------------------------------------------

  it("FAMILY: payload valid lolos dan string kosong dinormalkan null", () => {
    const out = validateUpsertStudentClusterInput({
      studentId: "std_a1",
      cluster: "FAMILY",
      data: { fatherName: "Budi Santoso", motherName: "", fatherNik: "3201234567890001" },
    });
    assert.equal(out.cluster, "FAMILY");
    const data: any = out.data;
    assert.equal(data.fatherName, "Budi Santoso");
    assert.equal(data.motherName, null);
    assert.equal(data.fatherNik, "3201234567890001");
  });

  it("FAMILY: payload kosong ditolak (minimal satu bidang)", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "FAMILY",
          data: {},
        }),
      ValidationError
    );
  });

  it("FAMILY: NIK non-digit ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "FAMILY",
          data: { fatherNik: "abc123" },
        }),
      ValidationError
    );
  });

  it("FAMILY: nomor telepon tidak valid ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "FAMILY",
          data: { emergencyContactPhone: "12345" },
        }),
      ValidationError
    );
  });

  it("HEALTH: payload valid lolos dengan coercion angka", () => {
    const out = validateUpsertStudentClusterInput({
      studentId: "std_a1",
      cluster: "HEALTH",
      data: { bloodType: "O", heightCm: 151, weightKg: 42, hasDisability: false },
    });
    assert.equal(out.cluster, "HEALTH");
    const data: any = out.data;
    assert.equal(data.bloodType, "O");
    assert.equal(data.heightCm, 151);
    assert.equal(data.hasDisability, false);
  });

  it("HEALTH: golongan darah di luar enum ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "HEALTH",
          data: { bloodType: "P" },
        }),
      ValidationError
    );
  });

  it("HEALTH: tinggi badan di luar rentang ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "HEALTH",
          data: { heightCm: 400 },
        }),
      ValidationError
    );
  });

  it("HEALTH: hasDisability=true tanpa jenis disabilitas ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "HEALTH",
          data: { hasDisability: true },
        }),
      ValidationError
    );
  });

  it("HEALTH: jenis disabilitas terisi saat status non-disabilitas ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "HEALTH",
          data: { hasDisability: false, disabilityType: "NETRA" },
        }),
      ValidationError
    );
  });

  it("HEALTH: jenis disabilitas valid saat status aktif lolos", () => {
    const out = validateUpsertStudentClusterInput({
      studentId: "std_a1",
      cluster: "HEALTH",
      data: { hasDisability: true, disabilityType: "RUNGU" },
    });
    assert.equal((out.data as any).disabilityType, "RUNGU");
  });

  it("REGISTRY: payload sebagian lolos dan kewarganegaraan default WNI", () => {
    const out = validateUpsertStudentClusterInput({
      studentId: "std_a1",
      cluster: "REGISTRY",
      data: { familyCardNo: "3201012345678901" },
    });
    assert.equal((out.data as any).nationality, "WNI");
    // bidang yang tidak dikirim tetap absen (undefined) — bukan null paksa
    assert.ok((out.data as any).bpjsNumber == null);
  });

  it("REGISTRY: payload kosong ditolak", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "REGISTRY",
          data: {},
        }),
      ValidationError
    );
  });

  it("cluster tak dikenal ditolak (discriminated union)", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "FINANCE",
          data: { fatherName: "X" },
        }),
      ValidationError
    );
  });

  it("field tak dikenal ditolak (skema strict)", () => {
    assert.throws(
      () =>
        validateUpsertStudentClusterInput({
          studentId: "std_a1",
          cluster: "FAMILY",
          data: { fatherName: "Budi", isAdmin: true },
        }),
      ValidationError
    );
  });

  it("konstanta kluster & golongan darah konsisten dengan kontrak Dapodik", () => {
    assert.deepEqual([...PROFILE_CLUSTERS], ["FAMILY", "HEALTH", "REGISTRY"]);
    assert.deepEqual([...BLOOD_TYPES], ["A", "B", "AB", "O"]);
  });

  // -------------------------------------------------------------------------
  // Domain Service — Read
  // -------------------------------------------------------------------------

  it("get: sesi tanpa student:view ditolak 403", async () => {
    await assert.rejects(
      runWithTenantContext(teacherA, () => getStudentProfileClusters(teacherA, "std_a1", tx)),
      AuthorizationError
    );
  });

  it("get: sesi wali (GUARDIAN) ditolak total dari RBAC internal", async () => {
    await assert.rejects(
      runWithTenantContext(guardianCtx, () =>
        getStudentProfileClusters(guardianCtx, "std_a1", tx)
      ),
      AuthorizationError
    );
  });

  it("get: siswa milik tenant lain -> ResourceNotFoundError", async () => {
    await assert.rejects(
      runWithTenantContext(adminA, () => getStudentProfileClusters(adminA, "std_b1", tx)),
      ResourceNotFoundError
    );
  });

  it("get: kluster belum diisi mengembalikan null + canEdit=false untuk viewer", async () => {
    const res = await runWithTenantContext(viewerA, () =>
      getStudentProfileClusters(viewerA, "std_a1", tx)
    );
    assert.equal(res.family, null);
    assert.equal(res.health, null);
    assert.equal(res.registry, null);
    assert.equal(res.canEdit, false);
    assert.equal(res.student.fullName, "Fatimah Az-Zahra");
  });

  it("get: admin membaca ketiga kluster + canEdit=true", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "Budi" } },
        tx
      )
    );
    const res = await runWithTenantContext(adminA, () =>
      getStudentProfileClusters(adminA, "std_a1", tx)
    );
    assert.equal((res.family as any).fatherName, "Budi");
    assert.equal(res.health, null);
    assert.equal(res.registry, null);
    assert.equal(res.canEdit, true);
  });

  // -------------------------------------------------------------------------
  // Domain Service — Write (Upsert)
  // -------------------------------------------------------------------------

  it("upsert: sesi hanya punya student:view ditolak 403", async () => {
    await assert.rejects(
      runWithTenantContext(viewerA, () =>
        upsertStudentCluster(
          viewerA,
          { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "Budi" } },
          tx
        )
      ),
      AuthorizationError
    );
    assert.equal(rows.studentFamilyData.length, 0);
  });

  it("upsert FAMILY: create baris pertama + AuditLog CREATE", async () => {
    const out = await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        {
          studentId: "std_a1",
          cluster: "FAMILY",
          data: {
            fatherName: "Budi Santoso",
            fatherNik: "3201234567890001",
            motherName: "Siti Aminah",
            emergencyContactName: "Paman",
            emergencyContactPhone: "081234567890",
          },
        },
        tx
      )
    );
    assert.equal(out.cluster, "FAMILY");
    assert.equal(rows.studentFamilyData.length, 1);
    assert.equal(rows.studentFamilyData[0].institutionId, instAId);
    assert.equal(rows.studentFamilyData[0].studentId, "std_a1");
    assert.equal(rows.studentFamilyData[0].emergencyContactPhone, "081234567890");
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, "CREATE");
    assert.equal(auditLogs[0].entityType, "StudentFamilyData");
    assert.equal(auditLogs[0].entityId, "std_a1");
  });

  it("upsert FAMILY: upsert kedua memperbarui baris yang sama (tidak dobel) + AuditLog UPDATE", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "Budi" } },
        tx
      )
    );
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "Budi S." } },
        tx
      )
    );
    assert.equal(rows.studentFamilyData.length, 1);
    assert.equal(rows.studentFamilyData[0].fatherName, "Budi S.");
    assert.deepEqual(
      auditLogs.map((a) => a.action),
      ["CREATE", "UPDATE"]
    );
  });

  it("upsert HEALTH: menyimpan status disabilitas + jenis & catatan", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        {
          studentId: "std_a1",
          cluster: "HEALTH",
          data: {
            bloodType: "A",
            heightCm: 145,
            weightKg: 38,
            hasDisability: true,
            disabilityType: "NETRA",
            disabilityNotes: "Low vision sejak lahir",
            allergies: "Kacang",
          },
        },
        tx
      )
    );
    const row = rows.studentHealthData[0];
    assert.equal(row.hasDisability, true);
    assert.equal(row.disabilityType, "NETRA");
    assert.equal(row.allergies, "Kacang");
    assert.equal(row.heightCm, 145);
    assert.equal(auditLogs[0].entityType, "StudentHealthData");
  });

  it("upsert REGISTRY: menyimpan berkas administratif + default kewarganegaraan", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        {
          studentId: "std_a1",
          cluster: "REGISTRY",
          data: {
            familyCardNo: "3201012345678901",
            bpjsNumber: "0001234567890",
            previousSchool: "SD IT Al-Falah",
          },
        },
        tx
      )
    );
    const row = rows.studentRegistryData[0];
    assert.equal(row.familyCardNo, "3201012345678901");
    assert.equal(row.nationality, "WNI");
    assert.equal(row.previousSchool, "SD IT Al-Falah");
    assert.equal(auditLogs[0].entityType, "StudentRegistryData");
  });

  it("upsert: siswa tenant lain ditolak dan tidak ada baris tersimpan", async () => {
    await assert.rejects(
      runWithTenantContext(adminA, () =>
        upsertStudentCluster(
          adminA,
          { studentId: "std_b1", cluster: "FAMILY", data: { fatherName: "X" } },
          tx
        )
      ),
      ResourceNotFoundError
    );
    assert.equal(rows.studentFamilyData.length, 0);
    assert.equal(auditLogs.length, 0);
  });

  it("upsert: payload Zod tidak valid ditolak ValidationError", async () => {
    await assert.rejects(
      runWithTenantContext(adminA, () =>
        upsertStudentCluster(
          adminA,
          { studentId: "std_a1", cluster: "REGISTRY", data: {} },
          tx
        )
      ),
      ValidationError
    );
    assert.equal(rows.studentRegistryData.length, 0);
  });

  it("upsert: ketiga kluster tersimpan terpisah untuk siswa yang sama", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "Budi" } },
        tx
      )
    );
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "HEALTH", data: { bloodType: "B" } },
        tx
      )
    );
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        { studentId: "std_a1", cluster: "REGISTRY", data: { sktmNumber: "123" } },
        tx
      )
    );
    assert.equal(rows.studentFamilyData.length, 1);
    assert.equal(rows.studentHealthData.length, 1);
    assert.equal(rows.studentRegistryData.length, 1);
    const res = await runWithTenantContext(adminA, () =>
      getStudentProfileClusters(adminA, "std_a1", tx)
    );
    assert.equal((res.family as any).fatherName, "Budi");
    assert.equal((res.health as any).bloodType, "B");
    assert.equal((res.registry as any).sktmNumber, "123");
  });

  it("upsert: audit trail tidak menyimpan nilai field pribadi (hanya daftar field)", async () => {
    await runWithTenantContext(adminA, () =>
      upsertStudentCluster(
        adminA,
        {
          studentId: "std_a1",
          cluster: "FAMILY",
          data: { fatherName: "Rahasia", fatherNik: "3201234567890009" },
        },
        tx
      )
    );
    const details = JSON.parse(auditLogs[0].detailsJson);
    assert.deepEqual(details.fields.sort(), ["fatherName", "fatherNik"]);
    assert.equal(auditLogs[0].detailsJson.includes("Rahasia"), false);
    assert.equal(auditLogs[0].detailsJson.includes("3201234567890009"), false);
  });

  it("upsert: sesi admin tenant B tidak bisa menulis kluster siswa tenant A", async () => {
    await assert.rejects(
      runWithTenantContext(adminB, () =>
        upsertStudentCluster(
          adminB,
          { studentId: "std_a1", cluster: "FAMILY", data: { fatherName: "X" } },
          tx
        )
      ),
      ResourceNotFoundError
    );
    assert.equal(rows.studentFamilyData.length, 0);
  });
});
