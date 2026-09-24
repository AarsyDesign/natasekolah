import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import { AuthorizationError } from "../src/lib/auth/permissions";
import {
  cleanText,
  cleanIdentityNumber,
  cleanIndonesianPhone,
  cleanGender,
  cleanDate,
  cleanRelationship,
  parseSpreadsheetBuffer,
  generateStudentImportTemplateBuffer,
  validateAndPreviewImportRows,
  generateStudentImportPreview,
  executeStudentImport,
} from "../src/lib/importer";

describe("Phase 1 — Master Data Importer & Auto-Sanitizer Tests", () => {
  const instAId = "inst_importer_test_a";
  const instBId = "inst_importer_test_b";

  const adminA: TenantContext = {
    userId: "usr_admin_importer_a",
    institutionId: instAId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
    ],
    isSuperAdmin: false,
  };

  const teacherWithoutCreate: TenantContext = {
    userId: "usr_teacher_readonly",
    institutionId: instAId,
    roles: ["TEACHER"],
    permissions: ["student:view"],
    isSuperAdmin: false,
  };

  const adminB: TenantContext = {
    userId: "usr_admin_importer_b",
    institutionId: instBId,
    roles: ["ADMIN"],
    permissions: [
      "student:view",
      "student:create",
      "student:edit",
      "student:archive",
      "academic:view",
      "academic:manage",
    ],
    isSuperAdmin: false,
  };

  // Helper untuk membuat buffer XLSX dari data baris
  function createXlsxBuffer(
    headers: string[],
    rows: (string | number | null | undefined)[][]
  ): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return Buffer.isBuffer(out) ? out : Buffer.from(out);
  }

  beforeEach(async () => {
    // Bersihkan data tes secara terisolasi
    await prisma.auditLog.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.enrollment.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.guardianStudent.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.guardian.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.student.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.classroom.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.academicYear.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.user.deleteMany({
      where: { institutionId: { in: [instAId, instBId] } },
    });
    await prisma.institution.deleteMany({
      where: { id: { in: [instAId, instBId] } },
    });

    // Buat institusi dasar
    await prisma.institution.createMany({
      data: [
        {
          id: instAId,
          name: "Pesantren Digital Darul Ulum",
          slug: "darul-ulum-importer",
          type: "PESANTREN",
        },
        {
          id: instBId,
          name: "SMP IT Al-Falah",
          slug: "al-falah-importer",
          type: "FORMAL_SCHOOL",
        },
      ],
    });

    // Buat user admin
    await prisma.user.createMany({
      data: [
        {
          id: adminA.userId,
          institutionId: instAId,
          email: "admin_a@test.com",
          name: "Admin A",
          passwordHash: "dummy",
          roles: JSON.stringify(["ADMIN"]),
        },
        {
          id: adminB.userId,
          institutionId: instBId,
          email: "admin_b@test.com",
          name: "Admin B",
          passwordHash: "dummy",
          roles: JSON.stringify(["ADMIN"]),
        },
        {
          id: teacherWithoutCreate.userId,
          institutionId: instAId,
          email: "teacher_ro@test.com",
          name: "Teacher Read Only",
          passwordHash: "dummy",
          roles: JSON.stringify(["TEACHER"]),
        },
      ],
    });
  });

  // =========================================================================
  // 1. AUTO-SANITIZER UNIT TESTS
  // =========================================================================
  describe("1. Auto-Sanitizer Functions", () => {
    it("cleanText: membersihkan spasi berlebih, placeholder null, dan formula injection", () => {
      assert.equal(cleanText("  Ahmad   Fauzan  "), "Ahmad Fauzan");
      assert.equal(cleanText(""), null);
      assert.equal(cleanText("   "), null);
      assert.equal(cleanText("-"), null);
      assert.equal(cleanText("N/A"), null);
      assert.equal(cleanText("null"), null);
      assert.equal(cleanText(null), null);
      assert.equal(cleanText(undefined), null);

      // Formula injection defense: awalan =, +, -, @
      assert.equal(cleanText("=1+1"), "'=1+1");
      assert.equal(cleanText("@SUM(A1:A10)"), "'@SUM(A1:A10)");
      assert.equal(cleanText("+cmd"), "'+cmd");
    });

    it("cleanIdentityNumber: menangani angka float dari Excel dan tanda hubung", () => {
      assert.equal(cleanIdentityNumber("1001.0"), "1001");
      assert.equal(cleanIdentityNumber("2026001.00"), "2026001");
      assert.equal(cleanIdentityNumber("3201-1234-5678-0001"), "3201123456780001");
      assert.equal(cleanIdentityNumber(" 0012345678 "), "0012345678");
      assert.equal(cleanIdentityNumber(null), null);
    });

    it("cleanIndonesianPhone: normalisasi format 08..., 8..., dan +628... ke kanonikal 628...", () => {
      const res1 = cleanIndonesianPhone("081234567890");
      assert.equal(res1.phone, "6281234567890");
      assert.ok(res1.warning);

      const res2 = cleanIndonesianPhone("+6281298765432");
      assert.equal(res2.phone, "6281298765432");

      const res3 = cleanIndonesianPhone("813-1122-3344");
      assert.equal(res3.phone, "6281311223344");

      // Tolak nomor yang bukan nomor seluler Indonesia yang valid
      const resBad = cleanIndonesianPhone("021123456");
      assert.equal(resBad.phone, null);
      assert.ok(resBad.error);
    });

    it("cleanGender: normalisasi variasi jenis kelamin bahasa Indonesia", () => {
      assert.equal(cleanGender("L").gender, "L");
      assert.equal(cleanGender("laki-laki").gender, "L");
      assert.equal(cleanGender("Pria").gender, "L");
      assert.equal(cleanGender("MALE").gender, "L");

      assert.equal(cleanGender("P").gender, "P");
      assert.equal(cleanGender("perempuan").gender, "P");
      assert.equal(cleanGender("Wanita").gender, "P");
      assert.equal(cleanGender("female").gender, "P");

      const resBad = cleanGender("Alien");
      assert.equal(resBad.gender, null);
      assert.ok(resBad.error);
    });

    it("cleanDate: menangani format DD/MM/YYYY, YYYY-MM-DD, dan Excel serial date", () => {
      // Format Indonesia DD/MM/YYYY
      const d1 = cleanDate("15/08/2012");
      assert.ok(d1.date);
      assert.equal(d1.dateString, "2012-08-15");

      // Format ISO YYYY-MM-DD
      const d2 = cleanDate("2012-08-15");
      assert.ok(d2.date);
      assert.equal(d2.dateString, "2012-08-15");

      // Excel serial date (e.g. 41500 = approx Aug 14, 2013)
      const d3 = cleanDate(41500);
      assert.ok(d3.date);
      assert.ok(d3.dateString);

      // Tolak tanggal tidak valid (31 Februari)
      const dBad = cleanDate("31/02/2020");
      assert.equal(dBad.date, null);
      assert.ok(dBad.error);
    });

    it("cleanRelationship: normalisasi relasi wali murid", () => {
      assert.equal(cleanRelationship("Bapak Kandung"), "AYAH");
      assert.equal(cleanRelationship("Ayah"), "AYAH");
      assert.equal(cleanRelationship("Ibu"), "IBU");
      assert.equal(cleanRelationship("Mama"), "IBU");
      assert.equal(cleanRelationship("Paman (Wali)"), "WALI");
      assert.equal(cleanRelationship(null), "WALI");
    });
  });

  // =========================================================================
  // 2. PARSER & COLUMN MAPPING TESTS
  // =========================================================================
  describe("2. Parser & Column Mapping", () => {
    it("harus mengenali variasi alias kolom bahasa Indonesia ke canonical key", () => {
      const headers = [
        "No Induk",
        "Nama Lengkap",
        "JK",
        "Tanggal Lahir",
        "No HP Wali",
        "Nama Kelas",
      ];
      const data = [
        ["2026001", "Muhammad Rizky", "L", "10/05/2012", "081234567890", "Kelas 7A"],
      ];

      const buffer = createXlsxBuffer(headers, data);
      const { rawRows, recognizedCanonicalFields } = parseSpreadsheetBuffer(
        buffer,
        "santri.xlsx"
      );

      assert.equal(rawRows.length, 1);
      assert.equal(rawRows[0].nis, "2026001");
      assert.equal(rawRows[0].fullName, "Muhammad Rizky");
      assert.equal(rawRows[0].gender, "L");
      assert.equal(rawRows[0].classroomName, "Kelas 7A");
      assert.ok(recognizedCanonicalFields.includes("nis"));
      assert.ok(recognizedCanonicalFields.includes("fullName"));
    });

    it("harus menolak file dengan ekstensi selain .xlsx, .xls, .csv", () => {
      assert.throws(
        () => {
          parseSpreadsheetBuffer(Buffer.from("dummy"), "document.pdf");
        },
        (err: unknown) => {
          assert(err instanceof Error);
          assert.match(err.message, /tidak didukung/i);
          return true;
        }
      );
    });

    it("harus dapat menghasilkan template Excel resmi", () => {
      const templateBuffer = generateStudentImportTemplateBuffer();
      assert.ok(Buffer.isBuffer(templateBuffer));
      assert.ok(templateBuffer.length > 500);

      // Verifikasi template dapat dibaca kembali
      const { rawRows } = parseSpreadsheetBuffer(
        templateBuffer,
        "Template_Siswa.xlsx"
      );
      assert.ok(rawRows.length >= 2);
    });
  });

  // =========================================================================
  // 3. VALIDATOR & DUPLICATE DETECTION TESTS
  // =========================================================================
  describe("3. Validator & Duplicate Detection", () => {
    it("harus mendeteksi duplikasi internal di dalam file yang sama", async () => {
      const rawRows = [
        { nis: "2026001", fullName: "Fatih", gender: "L" },
        { nis: "2026001", fullName: "Fatih Kembar", gender: "L" }, // NIS sama
      ];

      const { rows, summary } = await validateAndPreviewImportRows(adminA, rawRows);

      assert.equal(rows.length, 2);
      assert.equal(rows[0].status, "VALID");
      assert.equal(rows[1].status, "ERROR");
      assert.match(rows[1].errors[0].message, /duplikasi internal/i);
      assert.equal(summary.errorRows, 1);
    });

    it("harus mendeteksi Exact Duplicate jika NIS sudah terdaftar di database", async () => {
      // Seed 1 siswa di database institusi A
      await prisma.student.create({
        data: {
          institutionId: instAId,
          nis: "2026099",
          fullName: "Siswa Existing",
          gender: "L",
        },
      });

      const rawRows = [
        { nis: "2026099", fullName: "Siswa Existing Impor", gender: "L" }, // Duplikat NIS
        { nis: "2026100", fullName: "Siswa Baru", gender: "L" },
      ];

      const { rows, summary } = await validateAndPreviewImportRows(adminA, rawRows);

      assert.equal(rows[0].action, "SKIP_DUPLICATE");
      assert.equal(rows[0].duplicateType, "EXACT");
      assert.equal(rows[1].action, "CREATE");
      assert.equal(summary.exactDuplicates, 1);
      assert.equal(summary.newRecords, 1);
    });

    it("harus mendeteksi Potential Duplicate jika NISN sama atau Nama + Tanggal Lahir sama dengan NIS berbeda", async () => {
      const birthDate = new Date("2012-07-20T00:00:00.000Z");
      await prisma.student.create({
        data: {
          institutionId: instAId,
          nis: "EXISTING_01",
          nisn: "0012345678",
          fullName: "Bilal Al-Habasyi",
          birthDate,
          gender: "L",
        },
      });

      const rawRows = [
        // Kasus 1: NIS berbeda tetapi NISN sama persis
        {
          nis: "NEW_02",
          nisn: "0012345678",
          fullName: "Bilal Lain",
          gender: "L",
        },
        // Kasus 2: NIS berbeda tetapi Nama dan Tanggal Lahir sama persis
        {
          nis: "NEW_03",
          fullName: "Bilal Al-Habasyi",
          birthDate: "20/07/2012",
          gender: "L",
        },
      ];

      const { rows, summary } = await validateAndPreviewImportRows(adminA, rawRows);

      assert.equal(rows[0].duplicateType, "POTENTIAL");
      assert.equal(rows[0].action, "CREATE");
      assert.ok(rows[0].warnings.length > 0);

      assert.equal(rows[1].duplicateType, "POTENTIAL");
      assert.equal(rows[1].action, "CREATE");
      assert.equal(summary.potentialDuplicates, 2);
    });

    it("harus menolak baris dengan data wajib kosong", async () => {
      const rawRows = [
        { nis: "", fullName: "Tanpa NIS", gender: "L" },
        { nis: "2026002", fullName: "", gender: "L" },
        { nis: "2026003", fullName: "Tanpa JK", gender: "" },
      ];

      const { rows, summary } = await validateAndPreviewImportRows(adminA, rawRows);

      assert.equal(rows[0].status, "ERROR");
      assert.equal(rows[1].status, "ERROR");
      assert.equal(rows[2].status, "ERROR");
      assert.equal(summary.errorRows, 3);
    });
  });

  // =========================================================================
  // 4. INTEGRATION & IMPORT EXECUTION TESTS
  // =========================================================================
  describe("4. Integration & Execution Service", () => {
    it("harus berhasil mengimpor siswa, membuat wali, dan menempatkan ke rombel aktif", async () => {
      // Buat Tahun Ajaran Aktif dan Rombel di Institusi A
      const academicYear = await prisma.academicYear.create({
        data: {
          institutionId: instAId,
          name: "2026/2027",
          startDate: new Date("2026-07-01"),
          endDate: new Date("2027-06-30"),
          isActive: true,
        },
      });

      const classroom = await prisma.classroom.create({
        data: {
          institutionId: instAId,
          academicYearId: academicYear.id,
          name: "Kelas 7A",
        },
      });

      const headers = [
        "NIS",
        "Nama Lengkap",
        "Jenis Kelamin",
        "NISN",
        "Nama Wali",
        "No WA Wali",
        "Nama Kelas",
      ];
      const data = [
        [
          "2026001",
          "Zaid bin Haritsah",
          "L",
          "0098765432",
          "Abu Zaid",
          "081298765432",
          "Kelas 7A",
        ],
        [
          "2026002",
          "Fatimah Azzahra",
          "P",
          "0098765433",
          "Sayyidah Khadijah",
          "081298765433",
          "Kelas 7A",
        ],
      ];

      const buffer = createXlsxBuffer(headers, data);

      // 1. Prapinjau
      const preview = await generateStudentImportPreview(
        adminA,
        buffer,
        "import_santri.xlsx"
      );
      assert.equal(preview.summary.totalRows, 2);
      assert.equal(preview.summary.warningRows, 2); // Nomor 08 dinormalisasi ke 628 memicu warning yang aman
      assert.equal(preview.summary.newRecords, 2);
      assert.equal(preview.canProceed, true);

      // 2. Eksekusi Impor
      const itemsToImport = preview.rows.map((r) => r.sanitized);
      const execResult = await executeStudentImport(adminA, itemsToImport);

      assert.equal(execResult.createdStudents, 2);
      assert.equal(execResult.createdGuardians, 2);
      assert.equal(execResult.linkedEnrollments, 2);
      assert.equal(execResult.skippedDuplicates, 0);

      // Verifikasi di database
      const studentsInDb = await prisma.student.findMany({
        where: { institutionId: instAId },
        include: {
          guardians: { include: { guardian: true } },
          enrollments: { include: { classroom: true } },
        },
      });

      assert.equal(studentsInDb.length, 2);
      const zaid = studentsInDb.find((s) => s.nis === "2026001")!;
      assert.equal(zaid.fullName, "Zaid bin Haritsah");
      assert.equal(zaid.guardians[0].guardian.fullName, "Abu Zaid");
      assert.equal(zaid.guardians[0].guardian.phoneWa, "6281298765432");
      assert.equal(zaid.enrollments[0].classroom.name, "Kelas 7A");

      // Verifikasi AuditLog dicatat
      const audit = await prisma.auditLog.findFirst({
        where: {
          institutionId: instAId,
          action: "IMPORT",
          entityType: "Student",
        },
      });
      assert.ok(audit);
      assert.equal(audit.userId, adminA.userId);
    });

    it("harus melewati baris yang sudah ada jika dieksekusi ulang (Idempotency / Skip Duplicate)", async () => {
      const items = [
        {
          nis: "IDEMP_01",
          fullName: "Siswa Sekali",
          gender: "L" as const,
        },
      ];

      // Eksekusi pertama
      const res1 = await executeStudentImport(adminA, items);
      assert.equal(res1.createdStudents, 1);

      // Eksekusi kedua dengan data yang sama
      const res2 = await executeStudentImport(adminA, items);
      assert.equal(res2.createdStudents, 0);
      assert.equal(res2.skippedDuplicates, 1);
    });
  });

  // =========================================================================
  // 5. SECURITY & TENANT ISOLATION TESTS
  // =========================================================================
  describe("5. Security & Tenant Isolation", () => {
    it("harus menolak pengguna tanpa izin student:create", async () => {
      const buffer = createXlsxBuffer(["NIS", "Nama Lengkap", "JK"], [["1", "A", "L"]]);

      await assert.rejects(
        async () => {
          await generateStudentImportPreview(teacherWithoutCreate, buffer, "test.xlsx");
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await executeStudentImport(teacherWithoutCreate, [
            { nis: "1", fullName: "A", gender: "L" },
          ]);
        },
        (err: unknown) => {
          assert(err instanceof AuthorizationError);
          return true;
        }
      );
    });

    it("harus menjaga isolasi tenant: data Institusi B tidak memicu duplikasi atau bocor ke Institusi A", async () => {
      // Institusi B memiliki siswa dengan NIS 'SHARED_NIS_100'
      await prisma.student.create({
        data: {
          institutionId: instBId,
          nis: "SHARED_NIS_100",
          fullName: "Siswa Milik Institusi B",
          gender: "L",
        },
      });

      // Institusi A mengimpor siswa dengan NIS 'SHARED_NIS_100' yang sama
      const rawRows = [
        {
          nis: "SHARED_NIS_100",
          fullName: "Siswa Milik Institusi A",
          gender: "L",
        },
      ];

      const previewA = await validateAndPreviewImportRows(adminA, rawRows);

      // Karena berada di tenant berbeda, Institusi A TIDAK mendeteksi duplikat
      assert.equal(previewA.summary.exactDuplicates, 0);
      assert.equal(previewA.summary.newRecords, 1);
      assert.equal(previewA.rows[0].action, "CREATE");

      // Eksekusi di Institusi A harus sukses tanpa mengganggu Institusi B
      const execA = await executeStudentImport(adminA, [previewA.rows[0].sanitized]);
      assert.equal(execA.createdStudents, 1);

      // Pastikan kedua record ada di database dengan institutionId masing-masing
      const studentA = await prisma.student.findUnique({
        where: {
          institutionId_nis: {
            institutionId: instAId,
            nis: "SHARED_NIS_100",
          },
        },
      });
      const studentB = await prisma.student.findUnique({
        where: {
          institutionId_nis: {
            institutionId: instBId,
            nis: "SHARED_NIS_100",
          },
        },
      });

      assert.ok(studentA);
      assert.ok(studentB);
      assert.equal(studentA.fullName, "Siswa Milik Institusi A");
      assert.equal(studentB.fullName, "Siswa Milik Institusi B");
    });
  });
});
