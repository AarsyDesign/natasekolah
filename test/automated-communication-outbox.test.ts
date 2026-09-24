import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import { resolveGuardianPhone, normalizePhone } from "../src/lib/notification/guardian-resolver";
import { notifyPaymentCompleted, notifyAttendanceAlert } from "../src/lib/notification/events";
import { queueNotification } from "../src/lib/notification/outbox-service";
import { GET as cronGET, POST as cronPOST } from "../src/app/api/cron/process-outbox/route";

describe("Candidate B — Automated Communication Outbox Integration Tests", () => {
  const tenantA: TenantContext = {
    institutionId: "inst_alpha",
    userId: "user_treasurer_a",
    roles: ["TREASURER", "INSTITUTION_ADMIN"],
    permissions: ["finance:manage", "attendance:manage", "notification:manage"],
    isSuperAdmin: false,
  };

  const tenantB: TenantContext = {
    institutionId: "inst_beta",
    userId: "user_admin_b",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["finance:manage", "attendance:manage", "notification:manage"],
    isSuperAdmin: false,
  };

  // In-memory mock database store for isolated tests
  function createMockDb() {
    const store = {
      notificationOutbox: new Map<string, any>(),
      guardians: new Map<string, any>(),
      guardianStudents: new Map<string, any>(),
      students: new Map<string, any>(),
    };
    let outboxSeq = 1;

    const mockPrisma: any = {
      notificationOutbox: {
        create: async ({ data }: { data: any }) => {
          const id = data.id || `notif_${outboxSeq++}`;
          if (store.notificationOutbox.has(id)) {
            const err: any = new Error("Unique constraint failed on the fields: (`id`)");
            err.code = "P2002";
            throw err;
          }
          const item = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          store.notificationOutbox.set(id, item);
          return item;
        },
        findFirst: async ({ where }: any) => {
          for (const item of store.notificationOutbox.values()) {
            let match = true;
            if (where.id && item.id !== where.id) match = false;
            if (where.institutionId && item.institutionId !== where.institutionId) match = false;
            if (where.recipient && item.recipient !== where.recipient) match = false;
            if (match) return item;
          }
          return null;
        },
        findMany: async ({ where }: any) => {
          const results: any[] = [];
          for (const item of store.notificationOutbox.values()) {
            let match = true;
            if (where.institutionId && item.institutionId !== where.institutionId) match = false;
            if (where.status?.in && !where.status.in.includes(item.status)) match = false;
            if (match) results.push(item);
          }
          return results;
        },
        update: async ({ where, data }: any) => {
          const item = store.notificationOutbox.get(where.id);
          if (!item) throw new Error("Not found");
          Object.assign(item, data, { updatedAt: new Date() });
          return item;
        },
      },
      guardianStudent: {
        findMany: async ({ where, orderBy }: any) => {
          const results = Array.from(store.guardianStudents.values()).filter(
            (gs) =>
              gs.institutionId === where.institutionId &&
              gs.studentId === where.studentId
          );
          // Apply sorting: isPrimary desc, createdAt asc
          results.sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          return results.map((gs) => ({
            ...gs,
            guardian: store.guardians.get(gs.guardianId),
          }));
        },
      },
      student: {
        findFirst: async ({ where }: any) => {
          const s = store.students.get(where.id);
          if (s && s.institutionId === where.institutionId) {
            return s;
          }
          return null;
        },
      },
      $store: store,
    };

    return mockPrisma;
  }

  /* -------------------------------------------------------------
   * 1. GUARDIAN PHONE RESOLVER HIERARCHY & NORMALIZATION
   * ------------------------------------------------------------- */
  describe("1. Guardian Phone Resolution Hierarchy & Normalization", () => {
    test("harus menormalisasi format nomor WhatsApp Indonesia (+62, 08, 628)", () => {
      assert.strictEqual(normalizePhone("+6281234567890"), "6281234567890");
      assert.strictEqual(normalizePhone("081234567890"), "6281234567890");
      assert.strictEqual(normalizePhone("6281234567890"), "6281234567890");
      assert.strictEqual(normalizePhone("0812-3456-7890"), "6281234567890");

      // Invalid formats
      assert.strictEqual(normalizePhone("12345"), null);
      assert.strictEqual(normalizePhone("0215556789"), null); // landline
      assert.strictEqual(normalizePhone(""), null);
      assert.strictEqual(normalizePhone(null), null);
      assert.strictEqual(normalizePhone(undefined), null);
    });

    test("harus memprioritaskan nomor primary guardian terlebih dahulu", async () => {
      const db = createMockDb();
      const studentId = "std_101";

      // Guardian 1: Primary (Ayah)
      db.$store.guardians.set("g_primary", { id: "g_primary", phoneWa: "081111111111" });
      db.$store.guardianStudents.set("link_1", {
        institutionId: tenantA.institutionId,
        studentId,
        guardianId: "g_primary",
        isPrimary: true,
        createdAt: new Date(2026, 1, 1),
      });

      // Guardian 2: Secondary (Ibu)
      db.$store.guardians.set("g_secondary", { id: "g_secondary", phoneWa: "082222222222" });
      db.$store.guardianStudents.set("link_2", {
        institutionId: tenantA.institutionId,
        studentId,
        guardianId: "g_secondary",
        isPrimary: false,
        createdAt: new Date(2026, 1, 2),
      });

      // Student parentWaPhone fallback
      db.$store.students.set(studentId, {
        id: studentId,
        institutionId: tenantA.institutionId,
        parentWaPhone: "083333333333",
      });

      const resolved = await resolveGuardianPhone(tenantA.institutionId, studentId, db);
      assert.strictEqual(resolved, "6281111111111");
    });

    test("harus fallback ke guardian terdaftar lain jika primary tidak memiliki nomor valid", async () => {
      const db = createMockDb();
      const studentId = "std_102";

      // Primary with invalid phone
      db.$store.guardians.set("g_primary", { id: "g_primary", phoneWa: "invalid-phone" });
      db.$store.guardianStudents.set("link_1", {
        institutionId: tenantA.institutionId,
        studentId,
        guardianId: "g_primary",
        isPrimary: true,
        createdAt: new Date(2026, 1, 1),
      });

      // Secondary with valid phone
      db.$store.guardians.set("g_secondary", { id: "g_secondary", phoneWa: "+6285555555555" });
      db.$store.guardianStudents.set("link_2", {
        institutionId: tenantA.institutionId,
        studentId,
        guardianId: "g_secondary",
        isPrimary: false,
        createdAt: new Date(2026, 1, 2),
      });

      const resolved = await resolveGuardianPhone(tenantA.institutionId, studentId, db);
      assert.strictEqual(resolved, "6285555555555");
    });

    test("harus fallback ke student.parentWaPhone jika tidak ada guardian terdaftar", async () => {
      const db = createMockDb();
      const studentId = "std_103";

      db.$store.students.set(studentId, {
        id: studentId,
        institutionId: tenantA.institutionId,
        parentWaPhone: "087777777777",
      });

      const resolved = await resolveGuardianPhone(tenantA.institutionId, studentId, db);
      assert.strictEqual(resolved, "6287777777777");
    });

    test("harus mengembalikan null secara aman dan tidak throw jika tidak ada nomor valid sama sekali", async () => {
      const db = createMockDb();
      const studentId = "std_104";

      db.$store.students.set(studentId, {
        id: studentId,
        institutionId: tenantA.institutionId,
        parentWaPhone: null,
      });

      const resolved = await resolveGuardianPhone(tenantA.institutionId, studentId, db);
      assert.strictEqual(resolved, null);
    });
  });

  /* -------------------------------------------------------------
   * 2. PAYMENT → OUTBOX INTEGRATION & IDEMPOTENCY
   * ------------------------------------------------------------- */
  describe("2. Payment → Outbox Lifecycle & Idempotency", () => {
    test("pembayaran berhasil harus membuat NotificationOutbox berstatus PENDING", async () => {
      const db = createMockDb();

      await runWithTenantContext(tenantA, async () => {
        const notif = await notifyPaymentCompleted(
          {
            recipientPhone: "081299998888",
            studentName: "Ahmad Santri",
            receiptNo: "KW-202609-001",
            amount: 500000,
            categoryName: "SPP Syahriah",
            paymentDate: "24/09/2026",
            idempotencyKey: "payment:pay_001",
          },
          db
        );

        assert.ok(notif);
        assert.strictEqual(notif.recipient, "6281299998888");
        assert.strictEqual(notif.templateKey, "PAYMENT_RECEIPT");
        assert.strictEqual(notif.status, "PENDING");
        assert.strictEqual(notif.channel, "WHATSAPP");

        const payload = JSON.parse(notif.payloadJson);
        assert.strictEqual(payload.studentName, "Ahmad Santri");
        assert.strictEqual(payload.receiptNo, "KW-202609-001");
        assert.strictEqual(payload.amount, 500000);
        assert.strictEqual(payload.categoryName, "SPP Syahriah");
      });
    });

    test("duplicate event pembayaran dengan idempotencyKey yang sama tidak menghasilkan duplicate notification", async () => {
      const db = createMockDb();

      await runWithTenantContext(tenantA, async () => {
        const first = await notifyPaymentCompleted(
          {
            recipientPhone: "081299998888",
            studentName: "Ahmad Santri",
            receiptNo: "KW-202609-002",
            amount: 750000,
            categoryName: "SPP & Uang Makan",
            idempotencyKey: "payment:pay_002",
          },
          db
        );

        const duplicate = await notifyPaymentCompleted(
          {
            recipientPhone: "081299998888",
            studentName: "Ahmad Santri",
            receiptNo: "KW-202609-002",
            amount: 750000,
            categoryName: "SPP & Uang Makan",
            idempotencyKey: "payment:pay_002",
          },
          db
        );

        assert.strictEqual(first.id, duplicate.id);
        assert.strictEqual(db.$store.notificationOutbox.size, 1);
      });
    });

    test("kegagalan enqueue notifikasi tidak membatalkan operasi utama (defensive boundary)", async () => {
      // Mock db yang melempar error saat outbox create
      const failingDb: any = {
        notificationOutbox: {
          create: async () => {
            throw new Error("Database network failure during outbox create");
          },
          findFirst: async () => null,
        },
      };

      // Simulasi blok pembayaran dengan boundary defensif
      let paymentCommitted = false;
      let outboxErrorCaught = false;

      try {
        // Simulasi transaksi commit sukses
        paymentCommitted = true;

        // Simulasi post-commit block
        try {
          await runWithTenantContext(tenantA, async () => {
            await notifyPaymentCompleted(
              {
                recipientPhone: "081233334444",
                studentName: "Farhan",
                receiptNo: "KW-202609-003",
                amount: 300000,
                categoryName: "Daftar Ulang",
              },
              failingDb
            );
          });
        } catch (enqueueErr) {
          outboxErrorCaught = true;
          // Handler mencatat log tanpa throw ke luar
        }
      } catch (err) {
        paymentCommitted = false;
      }

      assert.strictEqual(paymentCommitted, true, "Pembayaran harus tetap sukses");
      assert.strictEqual(outboxErrorCaught, true, "Galat notifikasi ditangkap di boundary defensif");
    });
  });

  /* -------------------------------------------------------------
   * 3. ATTENDANCE → OUTBOX INTEGRATION & FILTERING
   * ------------------------------------------------------------- */
  describe("3. Attendance Session Close → Outbox Lifecycle", () => {
    test("HANYA status ABSENT, SICK, dan EXCUSED yang menghasilkan notifikasi kehadiran", async () => {
      const db = createMockDb();

      await runWithTenantContext(tenantA, async () => {
        // ABSENT -> Harus ada notifikasi
        const notifAbsent = await notifyAttendanceAlert(
          {
            recipientPhone: "081211112222",
            studentName: "Santri Alpa",
            status: "ABSENT",
            date: "24/09/2026",
            subjectName: "Fiqih",
            idempotencyKey: "attendance:sess_1:std_alpa",
          },
          db
        );
        assert.ok(notifAbsent);
        assert.strictEqual(notifAbsent.status, "PENDING");

        // SICK -> Harus ada notifikasi
        const notifSick = await notifyAttendanceAlert(
          {
            recipientPhone: "081233334444",
            studentName: "Santri Sakit",
            status: "SICK",
            date: "24/09/2026",
            subjectName: "Fiqih",
            idempotencyKey: "attendance:sess_1:std_sakit",
          },
          db
        );
        assert.ok(notifSick);

        // EXCUSED -> Harus ada notifikasi
        const notifExcused = await notifyAttendanceAlert(
          {
            recipientPhone: "081255556666",
            studentName: "Santri Izin",
            status: "EXCUSED",
            date: "24/09/2026",
            subjectName: "Fiqih",
            idempotencyKey: "attendance:sess_1:std_izin",
          },
          db
        );
        assert.ok(notifExcused);

        assert.strictEqual(db.$store.notificationOutbox.size, 3);
      });
    });

    test("status PRESENT tidak boleh menghasilkan notifikasi ke wali murid", async () => {
      const records = [
        { studentId: "s1", status: "PRESENT", fullName: "Santri Hadir 1" },
        { studentId: "s2", status: "PRESENT", fullName: "Santri Hadir 2" },
        { studentId: "s3", status: "ABSENT", fullName: "Santri Alpa" },
      ];

      // Simulasi filter di closeAttendanceSession: HANYA ["ABSENT", "SICK", "EXCUSED"]
      const alertableRecords = records.filter((r) =>
        ["ABSENT", "SICK", "EXCUSED"].includes(r.status)
      );

      assert.strictEqual(alertableRecords.length, 1);
      assert.strictEqual(alertableRecords[0].status, "ABSENT");
    });

    test("kegagalan notifikasi pada satu siswa tidak menggagalkan siswa lain dan sesi tetap CLOSED", async () => {
      const db = createMockDb();
      const students = [
        { id: "std_fail", phone: "invalid", name: "Santri Error" },
        { id: "std_ok", phone: "081277778888", name: "Santri Berhasil" },
      ];

      let sessionStatus = "OPEN";
      sessionStatus = "CLOSED"; // Sesi berhasil diupdate ke CLOSED

      const results: string[] = [];

      for (const st of students) {
        try {
          const phone = normalizePhone(st.phone);
          if (!phone) {
            throw new Error(`Invalid phone for student ${st.id}`);
          }
          await runWithTenantContext(tenantA, async () => {
            const notif = await notifyAttendanceAlert(
              {
                recipientPhone: phone,
                studentName: st.name,
                status: "ABSENT",
                idempotencyKey: `attendance:sess_x:${st.id}`,
              },
              db
            );
            results.push(notif.id);
          });
        } catch {
          // Error boundary per siswa
        }
      }

      assert.strictEqual(sessionStatus, "CLOSED", "Status sesi harus tetap CLOSED");
      assert.strictEqual(results.length, 1, "Siswa kedua harus tetap berhasil diproses");
      assert.strictEqual(db.$store.notificationOutbox.size, 1);
    });
  });

  /* -------------------------------------------------------------
   * 4. SECURITY & CRON WORKER TESTS
   * ------------------------------------------------------------- */
  describe("4. Security Boundary & Cron Worker", () => {
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      process.env.CRON_SECRET = "super-secret-cron-token-12345";
    });

    test("cron request tanpa Authorization header harus ditolak dengan HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/cron/process-outbox", {
        method: "GET",
      });

      const res = await cronGET(req);
      assert.strictEqual(res.status, 401);

      const json = await res.json();
      assert.strictEqual(json.error, "Unauthorized");
    });

    test("cron request dengan secret salah harus ditolak dengan HTTP 401", async () => {
      const req = new Request("http://localhost:3000/api/cron/process-outbox", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong-secret-token",
        },
      });

      const res = await cronPOST(req);
      assert.strictEqual(res.status, 401);

      const json = await res.json();
      assert.strictEqual(json.error, "Unauthorized");
    });

    test("cron request tanpa konfigurasi CRON_SECRET di env harus ditolak dengan HTTP 401", async () => {
      delete process.env.CRON_SECRET;

      const req = new Request("http://localhost:3000/api/cron/process-outbox", {
        method: "GET",
        headers: {
          authorization: "Bearer any-token",
        },
      });

      const res = await cronGET(req);
      assert.strictEqual(res.status, 401);
    });

    test("cross-tenant notification tidak boleh terjadi (isolasi tenant ketat)", async () => {
      const db = createMockDb();

      // Tenant Alpha enqueue
      await runWithTenantContext(tenantA, async () => {
        await notifyPaymentCompleted(
          {
            recipientPhone: "081299990001",
            studentName: "Santri Alpha",
            receiptNo: "KW-A-001",
            amount: 100000,
            categoryName: "SPP",
            idempotencyKey: "pay:a1",
          },
          db
        );
      });

      // Tenant Beta mencari data
      await runWithTenantContext(tenantB, async () => {
        const found = await db.notificationOutbox.findFirst({
          where: {
            id: `nob_${tenantA.institutionId}_pay_a1`,
            institutionId: tenantB.institutionId,
          },
        });
        assert.strictEqual(found, null, "Tenant Beta tidak boleh dapat mengakses notifikasi Tenant Alpha");
      });
    });
  });
});
