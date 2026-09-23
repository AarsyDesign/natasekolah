import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TenantContext } from "../src/lib/tenant/context";
import {
  createTahfidzRecord,
  getTahfidzRecordById,
  listTahfidzRecords,
  getTahfidzSummary,
  TahfidzRecordNotFoundError,
  InvalidAyahRangeError,
  InvalidSurahError,
  StudentEnrollmentMismatchError,
} from "../src/lib/tahfidz";
import { ResourceNotFoundError } from "../src/lib/academic";
import { AuthorizationError } from "../src/lib/auth/permissions";
import { ValidationError } from "../src/lib/validation";

function createMockPrismaTahfidz() {
  const studentsStore = new Map<string, any>();
  const enrollmentsStore = new Map<string, any>();
  const recordsStore = new Map<string, any>();
  let autoId = 1;

  // Pre-seed Students
  studentsStore.set("std_santri_1", {
    id: "std_santri_1",
    institutionId: "inst_pesantren_demo",
    fullName: "Muhammad Hafidz",
    nis: "1001",
    status: "ACTIVE",
  });

  studentsStore.set("std_santri_2", {
    id: "std_santri_2",
    institutionId: "inst_pesantren_demo",
    fullName: "Aisyah Humaira",
    nis: "1002",
    status: "ACTIVE",
  });

  studentsStore.set("std_tenant_b", {
    id: "std_tenant_b",
    institutionId: "inst_other_pesantren",
    fullName: "Santri Luar",
    nis: "9999",
    status: "ACTIVE",
  });

  // Pre-seed Enrollments
  enrollmentsStore.set("enr_2025_santri_1", {
    id: "enr_2025_santri_1",
    institutionId: "inst_pesantren_demo",
    studentId: "std_santri_1",
    academicYearId: "ay_2025",
    classroomId: "cls_7_tahfidz",
    status: "ENROLLED",
  });

  enrollmentsStore.set("enr_2026_santri_1", {
    id: "enr_2026_santri_1",
    institutionId: "inst_pesantren_demo",
    studentId: "std_santri_1",
    academicYearId: "ay_2026",
    classroomId: "cls_8_tahfidz",
    status: "ENROLLED",
  });

  enrollmentsStore.set("enr_2025_santri_2", {
    id: "enr_2025_santri_2",
    institutionId: "inst_pesantren_demo",
    studentId: "std_santri_2",
    academicYearId: "ay_2025",
    classroomId: "cls_7_tahfidz",
    status: "ENROLLED",
  });

  enrollmentsStore.set("enr_tenant_b", {
    id: "enr_tenant_b",
    institutionId: "inst_other_pesantren",
    studentId: "std_tenant_b",
    academicYearId: "ay_2025_b",
    classroomId: "cls_other",
    status: "ENROLLED",
  });

  return {
    student: {
      findUnique: async ({ where }: any) => {
        const id = where?.id_institutionId?.id || where?.id;
        const instId = where?.id_institutionId?.institutionId;
        const student = studentsStore.get(id);
        if (!student) return null;
        if (instId && student.institutionId !== instId) return null;
        return { ...student };
      },
    },
    enrollment: {
      findUnique: async ({ where }: any) => {
        const id = where?.id_institutionId?.id || where?.id;
        const instId = where?.id_institutionId?.institutionId;
        const enrollment = enrollmentsStore.get(id);
        if (!enrollment) return null;
        if (instId && enrollment.institutionId !== instId) return null;
        return { ...enrollment };
      },
    },
    tahfidzRecord: {
      create: async ({ data }: any) => {
        const id = `rec_${autoId++}`;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        recordsStore.set(id, record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        const id = where?.id_institutionId?.id || where?.id;
        const instId = where?.id_institutionId?.institutionId;
        const record = recordsStore.get(id);
        if (!record) return null;
        if (instId && record.institutionId !== instId) return null;
        return {
          ...record,
          student: studentsStore.get(record.studentId),
          enrollment: enrollmentsStore.get(record.enrollmentId),
          recorder: { id: record.recordedBy, name: "Ustadz Pembimbing", email: "ustadz@pesantren.id" },
        };
      },
      findMany: async ({ where, orderBy, take }: any) => {
        let results = Array.from(recordsStore.values()).filter((r) => {
          if (where?.institutionId && r.institutionId !== where.institutionId) return false;
          if (where?.studentId && r.studentId !== where.studentId) return false;
          if (where?.enrollmentId && r.enrollmentId !== where.enrollmentId) return false;
          if (where?.type && r.type !== where.type) return false;
          if (where?.quality && r.quality !== where.quality) return false;
          return true;
        });

        if (orderBy?.date === "desc") {
          results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        if (take) {
          results = results.slice(0, take);
        }

        return results.map((record) => ({
          ...record,
          student: studentsStore.get(record.studentId),
          enrollment: enrollmentsStore.get(record.enrollmentId),
          recorder: { id: record.recordedBy, name: "Ustadz Pembimbing", email: "ustadz@pesantren.id" },
        }));
      },
      count: async ({ where }: any) => {
        let results = Array.from(recordsStore.values()).filter((r) => {
          if (where?.institutionId && r.institutionId !== where.institutionId) return false;
          if (where?.studentId && r.studentId !== where.studentId) return false;
          if (where?.type && r.type !== where.type) return false;
          return true;
        });
        return results.length;
      },
    },
    _stores: {
      studentsStore,
      enrollmentsStore,
      recordsStore,
    },
  };
}

describe("Tahfidz Mutaba'ah Core Tests", () => {
  const teacherContext: TenantContext = {
    userId: "usr_ustadz_ahmad",
    institutionId: "inst_pesantren_demo",
    roles: ["TEACHER"],
    permissions: ["tahfidz:view", "tahfidz:manage"],
    isSuperAdmin: false,
  };

  const studentViewerContext: TenantContext = {
    userId: "usr_wali_santri",
    institutionId: "inst_pesantren_demo",
    roles: ["STUDENT"],
    permissions: ["tahfidz:view"],
    isSuperAdmin: false,
  };

  const tenantBContext: TenantContext = {
    userId: "usr_ustadz_b",
    institutionId: "inst_other_pesantren",
    roles: ["TEACHER"],
    permissions: ["tahfidz:view", "tahfidz:manage"],
    isSuperAdmin: false,
  };

  it("dapat membuat rekaman mutaba'ah tahfidz valid (SETORAN dan MURAJAAH)", async () => {
    const mockDb = createMockPrismaTahfidz();

    // 1. SETORAN Surah Al-Fatihah (1: 1-7)
    const setoran = await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2026-09-01"),
        surah: 1,
        startAyah: 1,
        endAyah: 7,
        type: "SETORAN",
        quality: "MUMTAZ",
        note: "Makhraj dan tajwid sangat fasih.",
      },
      mockDb
    );

    assert.equal(setoran.studentId, "std_santri_1");
    assert.equal(setoran.surah, 1);
    assert.equal(setoran.surahName, "Al-Fatihah");
    assert.equal(setoran.startAyah, 1);
    assert.equal(setoran.endAyah, 7);
    assert.equal(setoran.type, "SETORAN");
    assert.equal(setoran.quality, "MUMTAZ");
    assert.equal(setoran.recordedBy, "usr_ustadz_ahmad");

    // 2. MURAJAAH Surah Al-Baqarah (2: 1-20)
    const murajaah = await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2026-09-02"),
        surah: 2,
        startAyah: 1,
        endAyah: 20,
        type: "MURAJAAH",
        quality: "JAYYID",
        note: "Perlu penguatan waqaf pada ayat 15.",
      },
      mockDb
    );

    assert.equal(murajaah.type, "MURAJAAH");
    assert.equal(murajaah.quality, "JAYYID");
    assert.equal(murajaah.surahName, "Al-Baqarah");
  });

  it("menolak jika startAyah < 1 atau endAyah < startAyah", async () => {
    const mockDb = createMockPrismaTahfidz();

    // startAyah = 0
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_1",
            date: new Date(),
            surah: 1,
            startAyah: 0,
            endAyah: 5,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof ValidationError
    );

    // endAyah < startAyah (startAyah: 10, endAyah: 5)
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_1",
            date: new Date(),
            surah: 2,
            startAyah: 10,
            endAyah: 5,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof ValidationError || err instanceof InvalidAyahRangeError
    );
  });

  it("menolak nomor surah di luar 1..114 dan ayat melebihi total ayat surah", async () => {
    const mockDb = createMockPrismaTahfidz();

    // Surah 115 (tidak ada di Al-Qur'an)
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_1",
            date: new Date(),
            surah: 115,
            startAyah: 1,
            endAyah: 5,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof ValidationError || err instanceof InvalidSurahError
    );

    // Al-Fatihah hanya punya 7 ayat, coba setorkan ayat 8
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_1",
            date: new Date(),
            surah: 1,
            startAyah: 1,
            endAyah: 8,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof InvalidAyahRangeError
    );
  });

  it("menolak ketidaksesuaian santri dan enrollment (StudentEnrollmentMismatchError)", async () => {
    const mockDb = createMockPrismaTahfidz();

    // std_santri_1 menggunakan enrollment milik std_santri_2
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_2", // Milik Santri 2
            date: new Date(),
            surah: 112,
            startAyah: 1,
            endAyah: 4,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof StudentEnrollmentMismatchError
    );
  });

  it("menegakkan isolasi tenant: Tenant A tidak bisa mencatat/melihat santri Tenant B", async () => {
    const mockDb = createMockPrismaTahfidz();

    // Ustadz Tenant A mencoba mencatat santri Tenant B
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          teacherContext, // Tenant A
          {
            studentId: "std_tenant_b", // Santri Tenant B
            enrollmentId: "enr_tenant_b",
            date: new Date(),
            surah: 114,
            startAyah: 1,
            endAyah: 6,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof ResourceNotFoundError
    );

    // Ustadz Tenant B membuat record di Tenant B
    const recTenantB = await createTahfidzRecord(
      tenantBContext,
      {
        studentId: "std_tenant_b",
        enrollmentId: "enr_tenant_b",
        date: new Date(),
        surah: 114,
        startAyah: 1,
        endAyah: 6,
        type: "SETORAN",
        quality: "MUMTAZ",
      },
      mockDb
    );

    // Tenant A mencoba membaca record Tenant B via getTahfidzRecordById
    await assert.rejects(
      async () => {
        await getTahfidzRecordById(teacherContext, recTenantB.id, mockDb);
      },
      (err: any) => err instanceof TahfidzRecordNotFoundError
    );

    // Tenant A listTahfidzRecords tidak mengandung data Tenant B
    const listTenantA = await listTahfidzRecords(teacherContext, {}, mockDb);
    assert.ok(listTenantA.every((r) => r.institutionId === "inst_pesantren_demo"));
  });

  it("mencatat identitas perekam (recordedBy) secara mutlak dari sesi server, bukan dari client", async () => {
    const mockDb = createMockPrismaTahfidz();

    // Client mencoba menyelundupkan recordedBy palsu
    const record = await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date(),
        surah: 110,
        startAyah: 1,
        endAyah: 3,
        type: "SETORAN",
        quality: "MUMTAZ",
        recordedBy: "usr_hacker_fake", // Penyelundupan authority field
      } as any,
      mockDb
    );

    assert.equal(record.recordedBy, teacherContext.userId);
    assert.notEqual(record.recordedBy, "usr_hacker_fake");
  });

  it("menegakkan izin RBAC: pengguna tanpa tahfidz:manage ditolak", async () => {
    const mockDb = createMockPrismaTahfidz();

    // Wali santri hanya punya tahfidz:view
    await assert.rejects(
      async () => {
        await createTahfidzRecord(
          studentViewerContext,
          {
            studentId: "std_santri_1",
            enrollmentId: "enr_2025_santri_1",
            date: new Date(),
            surah: 108,
            startAyah: 1,
            endAyah: 3,
            type: "SETORAN",
            quality: "MUMTAZ",
          },
          mockDb
        );
      },
      (err: any) => err instanceof AuthorizationError
    );
  });

  it("mempertahankan integritas historis: record tetap menunjuk enrollment asli saat santri naik kelas", async () => {
    const mockDb = createMockPrismaTahfidz();

    // Tahun 2025: Santri setoran di Kelas 7 (enr_2025_santri_1)
    const recYear1 = await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2025-10-15"),
        surah: 78,
        startAyah: 1,
        endAyah: 40,
        type: "SETORAN",
        quality: "MUMTAZ",
      },
      mockDb
    );

    // Tahun 2026: Santri naik ke Kelas 8 (enr_2026_santri_1)
    const recYear2 = await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2026_santri_1",
        date: new Date("2026-08-20"),
        surah: 79,
        startAyah: 1,
        endAyah: 46,
        type: "SETORAN",
        quality: "MUMTAZ",
      },
      mockDb
    );

    // Verifikasi record tahun lalu tidak berubah enrollmentId-nya
    const fetchedYear1 = await getTahfidzRecordById(teacherContext, recYear1.id, mockDb);
    const fetchedYear2 = await getTahfidzRecordById(teacherContext, recYear2.id, mockDb);

    assert.equal(fetchedYear1.enrollmentId, "enr_2025_santri_1");
    assert.equal(fetchedYear2.enrollmentId, "enr_2026_santri_1");
  });

  it("menghitung kalkulasi ringkasan tahfidz santri (getTahfidzSummary)", async () => {
    const mockDb = createMockPrismaTahfidz();

    // 1. Setoran 1
    await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2026-09-01"),
        surah: 78,
        startAyah: 1,
        endAyah: 40,
        type: "SETORAN",
        quality: "MUMTAZ",
      },
      mockDb
    );

    // 2. Setoran 2 (Surah An-Nazi'at)
    await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2026-09-05"),
        surah: 79,
        startAyah: 1,
        endAyah: 46,
        type: "SETORAN",
        quality: "MUMTAZ",
      },
      mockDb
    );

    // 3. Muraja'ah
    await createTahfidzRecord(
      teacherContext,
      {
        studentId: "std_santri_1",
        enrollmentId: "enr_2025_santri_1",
        date: new Date("2026-09-03"),
        surah: 78,
        startAyah: 1,
        endAyah: 40,
        type: "MURAJAAH",
        quality: "JAYYID",
      },
      mockDb
    );

    const summary = await getTahfidzSummary(teacherContext, "std_santri_1", mockDb);

    assert.equal(summary.studentId, "std_santri_1");
    assert.equal(summary.studentName, "Muhammad Hafidz");
    assert.equal(summary.totalSetoran, 2);
    assert.equal(summary.totalMurajaah, 1);
    assert.equal(summary.lastSurahNumber, 79);
    assert.equal(summary.lastSurah, "An-Nazi'at");
    assert.equal(summary.lastAyah, 46);
    assert.ok(summary.latestRecord !== null);
  });
});
