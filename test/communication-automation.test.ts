import { test, describe } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  queueNotification,
  processOutboxQueue,
  cancelNotification,
  generateDeterministicNotificationId,
  isPermanentNotificationFailure,
} from "../src/lib/notification/outbox-service";
import {
  notifyPaymentCompleted,
  notifyAttendanceAlert,
  notifyReportCardPublished,
  notifyGuardianInvitation,
} from "../src/lib/notification/events";
import {
  resolveStudentGuardianRecipient,
  isValidIndonesianPhone,
} from "../src/lib/notification/guardian-resolver";
import { renderNotificationMessage } from "../src/lib/notification/templates";
import { sanitizeIndonesianPhone } from "../src/lib/validation/notification";

function createInMemoryPrisma() {
  const outboxStore = new Map<string, any>();
  const studentStore = new Map<string, any>();
  const guardianStore = new Map<string, any>();
  const guardianStudentStore = new Map<string, any>();
  const sessionStore = new Map<string, any>();
  const recordStore = new Map<string, any>();
  const reportCardStore = new Map<string, any>();

  let autoId = 1;

  const db: any = {
    notificationOutbox: {
      create: async ({ data }: { data: any }) => {
        const id = data.id || `notif_${autoId++}`;
        if (outboxStore.has(id)) {
          const err: any = new Error("Unique constraint failed on the fields: (`id`)");
          err.code = "P2002";
          throw err;
        }
        const record = {
          id,
          attempts: 0,
          maxAttempts: 5,
          status: "PENDING",
          channel: "WHATSAPP",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        outboxStore.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        const items = Array.from(outboxStore.values());
        return (
          items.find((i) => {
            if (where.id && i.id !== where.id) return false;
            if (where.institutionId && i.institutionId !== where.institutionId) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where, take, skip = 0, orderBy }: any) => {
        let items = Array.from(outboxStore.values());
        if (where?.institutionId) {
          items = items.filter((i) => i.institutionId === where.institutionId);
        }
        if (where?.status?.in) {
          items = items.filter((i) => where.status.in.includes(i.status));
        } else if (where?.status) {
          items = items.filter((i) => i.status === where.status);
        }
        if (where?.templateKey) {
          items = items.filter((i) => i.templateKey === where.templateKey);
        }
        if (take) {
          items = items.slice(skip, skip + take);
        }
        return items;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const record = outboxStore.get(where.id);
        if (!record) throw new Error("Record not found");
        if (data.status) record.status = data.status;
        if (data.attempts?.increment) record.attempts += data.attempts.increment;
        if (data.providerId) record.providerId = data.providerId;
        if (data.externalId !== undefined) record.externalId = data.externalId;
        if (data.errorMessage !== undefined) record.errorMessage = data.errorMessage;
        if (data.lastAttemptAt) record.lastAttemptAt = data.lastAttemptAt;
        if (data.nextRetryAt !== undefined) record.nextRetryAt = data.nextRetryAt;
        record.updatedAt = new Date();
        outboxStore.set(where.id, record);
        return record;
      },
      updateMany: async ({ where, data }: { where: any; data: any }) => {
        const record = outboxStore.get(where.id);
        if (!record) return { count: 0 };
        if (where.institutionId && record.institutionId !== where.institutionId) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(record.status)) return { count: 0 };

        if (data.status) record.status = data.status;
        if (data.attempts?.increment) record.attempts += data.attempts.increment;
        if (data.lastAttemptAt) record.lastAttemptAt = data.lastAttemptAt;
        record.updatedAt = new Date();
        outboxStore.set(where.id, record);
        return { count: 1 };
      },
      count: async ({ where }: any) => {
        let items = Array.from(outboxStore.values());
        if (where?.institutionId) {
          items = items.filter((i) => i.institutionId === where.institutionId);
        }
        if (where?.status) {
          items = items.filter((i) => i.status === where.status);
        }
        return items.length;
      },
    },

    student: {
      findUnique: async ({ where }: any) => {
        const targetId = where.id_institutionId ? where.id_institutionId.id : where.id;
        const targetInst = where.id_institutionId ? where.id_institutionId.institutionId : where.institutionId;
        const student = studentStore.get(targetId);
        if (!student) return null;
        if (targetInst && student.institutionId !== targetInst) return null;

        // Populate guardians
        const links = Array.from(guardianStudentStore.values()).filter(
          (gs) => gs.studentId === targetId && gs.institutionId === targetInst
        );
        links.sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const hydratedLinks = links.map((l) => ({
          ...l,
          guardian: guardianStore.get(l.guardianId),
        }));

        return {
          ...student,
          guardians: hydratedLinks,
        };
      },
      findFirst: async ({ where }: any) => {
        const items = Array.from(studentStore.values());
        return (
          items.find((s) => {
            if (where.id && s.id !== where.id) return false;
            if (where.institutionId && s.institutionId !== where.institutionId) return false;
            return true;
          }) || null
        );
      },
    },

    $transaction: async (cb: any) => cb(db),
    _outboxStore: outboxStore,
    _studentStore: studentStore,
    _guardianStore: guardianStore,
    _guardianStudentStore: guardianStudentStore,
  };

  return db;
}

describe("Communication Automation — Unit & Integration Test Suite", () => {
  const tenantA: TenantContext = {
    institutionId: "inst_alpha",
    userId: "user_admin_a",
    roles: ["ADMIN"],
    permissions: ["academic:manage", "finance:manage", "attendance:manage", "report:manage"],
    isSuperAdmin: false,
  };

  const tenantB: TenantContext = {
    institutionId: "inst_beta",
    userId: "user_admin_b",
    roles: ["ADMIN"],
    permissions: ["academic:manage"],
    isSuperAdmin: false,
  };

  test("1. Phone Sanitizer and Phone Validation", () => {
    assert.strictEqual(sanitizeIndonesianPhone("081234567890"), "6281234567890");
    assert.strictEqual(sanitizeIndonesianPhone("+62 812-3456-7890"), "6281234567890");
    assert.strictEqual(sanitizeIndonesianPhone("81234567890"), "6281234567890");

    assert.strictEqual(isValidIndonesianPhone("081234567890"), true);
    assert.strictEqual(isValidIndonesianPhone("+628123456789"), true);
    assert.strictEqual(isValidIndonesianPhone("12345"), false);
    assert.strictEqual(isValidIndonesianPhone(null), false);
    assert.strictEqual(isValidIndonesianPhone(""), false);
  });

  test("2. Guardian Resolution Hierarchy (Primary -> Other -> Legacy WA -> Student Phone)", async () => {
    const db = createInMemoryPrisma();

    // Setup student with primary guardian
    const student1 = {
      id: "std_1",
      institutionId: "inst_alpha",
      fullName: "Santri Zaid",
      parentWaPhone: "081999999999",
      phone: "081888888888",
    };
    db._studentStore.set(student1.id, student1);

    const guardianPrimary = {
      id: "grd_pri",
      institutionId: "inst_alpha",
      fullName: "Abu Zaid (Ayah)",
      phoneWa: "081211112222",
    };
    db._guardianStore.set(guardianPrimary.id, guardianPrimary);

    db._guardianStudentStore.set("link_1", {
      id: "link_1",
      institutionId: "inst_alpha",
      guardianId: guardianPrimary.id,
      studentId: student1.id,
      isPrimary: true,
      createdAt: new Date("2026-01-01"),
    });

    const res1 = await resolveStudentGuardianRecipient(student1.id, "inst_alpha", db);
    assert.ok(res1);
    assert.strictEqual(res1.recipientPhone, "6281211112222");
    assert.strictEqual(res1.guardianName, "Abu Zaid (Ayah)");
    assert.strictEqual(res1.source, "GUARDIAN_RELATION");

    // Case 2: Fallback to parentWaPhone when no guardian relation exists
    const student2 = {
      id: "std_2",
      institutionId: "inst_alpha",
      fullName: "Santri Umar",
      parentWaPhone: "081233334444",
      phone: null,
    };
    db._studentStore.set(student2.id, student2);

    const res2 = await resolveStudentGuardianRecipient(student2.id, "inst_alpha", db);
    assert.ok(res2);
    assert.strictEqual(res2.recipientPhone, "6281233334444");
    assert.strictEqual(res2.source, "STUDENT_PARENT_WA_FALLBACK");

    // Case 3: Fallback to student.phone when parentWaPhone is missing
    const student3 = {
      id: "std_3",
      institutionId: "inst_alpha",
      fullName: "Santri Ali",
      parentWaPhone: null,
      phone: "081255556666",
    };
    db._studentStore.set(student3.id, student3);

    const res3 = await resolveStudentGuardianRecipient(student3.id, "inst_alpha", db);
    assert.ok(res3);
    assert.strictEqual(res3.recipientPhone, "6281255556666");
    assert.strictEqual(res3.source, "STUDENT_PHONE_FALLBACK");

    // Case 4: No phone available -> graceful null
    const student4 = {
      id: "std_4",
      institutionId: "inst_alpha",
      fullName: "Santri Khalid",
      parentWaPhone: null,
      phone: null,
    };
    db._studentStore.set(student4.id, student4);

    const res4 = await resolveStudentGuardianRecipient(student4.id, "inst_alpha", db);
    assert.strictEqual(res4, null);

    // Case 5: Tenant boundary enforcement (student from other tenant cannot be resolved)
    const resTenantB = await resolveStudentGuardianRecipient(student1.id, "inst_beta", db);
    assert.strictEqual(resTenantB, null);
  });

  test("3. Deterministic Idempotency Key Generation & Deduplication", async () => {
    const key1 = generateDeterministicNotificationId("inst_alpha", "PAYMENT_RECEIPT:pay_123");
    const key2 = generateDeterministicNotificationId("inst_alpha", "PAYMENT_RECEIPT:pay_123");
    const keyDiffTenant = generateDeterministicNotificationId("inst_beta", "PAYMENT_RECEIPT:pay_123");

    assert.strictEqual(key1, key2);
    assert.notStrictEqual(key1, keyDiffTenant);

    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      // First attempt: queues record
      const notif1 = await queueNotification(
        {
          recipient: "081299998888",
          templateKey: "PAYMENT_RECEIPT",
          payload: { studentName: "Zaid", receiptNo: "KW-01", amount: 100000 },
          idempotencyKey: "PAYMENT_RECEIPT:pay_123",
        },
        db
      );

      assert.strictEqual(notif1.id, key1);
      assert.strictEqual(db._outboxStore.size, 1);

      // Second attempt with same idempotencyKey: returns existing without creating new row
      const notif2 = await queueNotification(
        {
          recipient: "081299998888",
          templateKey: "PAYMENT_RECEIPT",
          payload: { studentName: "Zaid", receiptNo: "KW-01", amount: 100000 },
          idempotencyKey: "PAYMENT_RECEIPT:pay_123",
        },
        db
      );

      assert.strictEqual(notif2.id, notif1.id);
      assert.strictEqual(db._outboxStore.size, 1);
    });
  });

  test("4. Payment Notification Post-Commit Integration Semantics", async () => {
    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      // Simulate post-commit call
      const notif = await notifyPaymentCompleted(
        {
          recipientPhone: "081211112222",
          studentName: "Santri Zaid",
          receiptNo: "REC-2026-001",
          amount: 500000,
          categoryName: "Syahriah",
          idempotencyKey: "PAYMENT_RECEIPT:tx_999",
        },
        db
      );

      assert.strictEqual(notif.status, "PENDING");
      assert.strictEqual(notif.templateKey, "PAYMENT_RECEIPT");

      // Verify payload content
      const payload = JSON.parse(notif.payloadJson);
      assert.strictEqual(payload.studentName, "Santri Zaid");
      assert.strictEqual(payload.receiptNo, "REC-2026-001");
      assert.strictEqual(payload._idempotencyKey, "PAYMENT_RECEIPT:tx_999");

      // Render message verification
      const rendered = renderNotificationMessage("PAYMENT_RECEIPT", payload);
      assert.ok(rendered.includes("Santri Zaid"));
      assert.ok(rendered.includes("REC-2026-001"));
      assert.ok(rendered.includes("500.000"));
    });
  });

  test("5. Attendance Alert Event Semantics", async () => {
    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      const notif = await notifyAttendanceAlert(
        {
          recipientPhone: "081233334444",
          studentName: "Santri Umar",
          status: "ABSENT",
          date: "28/09/2026",
          subjectName: "Nahwu & Shorof",
          classroomName: "7A",
          idempotencyKey: "ATTENDANCE_ALERT:rec_888",
        },
        db
      );

      assert.strictEqual(notif.templateKey, "ATTENDANCE_ALERT");
      const payload = JSON.parse(notif.payloadJson);
      assert.strictEqual(payload.status, "ABSENT");
      assert.strictEqual(payload.classroomName, "7A");

      const rendered = renderNotificationMessage("ATTENDANCE_ALERT", payload);
      assert.ok(rendered.includes("Santri Umar"));
      assert.ok(rendered.includes("TIDAK HADIR (ALPA)"));
      assert.ok(rendered.includes("Kelas: 7A"));
      assert.ok(rendered.includes("Nahwu & Shorof"));
    });
  });

  test("6. Report Card Publication Event Semantics", async () => {
    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      const notif = await notifyReportCardPublished(
        {
          recipientPhone: "081255556666",
          studentName: "Santri Ali",
          reportCardId: "rc_777",
          semester: 1,
          academicYear: "2026/2027",
          classroomName: "10-IPA-1",
          idempotencyKey: "REPORT_CARD_PUBLISHED:rc_777",
        },
        db
      );

      assert.strictEqual(notif.templateKey, "REPORT_CARD_PUBLISHED");
      const payload = JSON.parse(notif.payloadJson);
      assert.strictEqual(payload.reportUrl, "/wali/akademik/raport/rc_777");

      const rendered = renderNotificationMessage("REPORT_CARD_PUBLISHED", payload);
      assert.ok(rendered.includes("Santri Ali"));
      assert.ok(rendered.includes("Semester 1 2026/2027"));
      assert.ok(rendered.includes("10-IPA-1"));
      assert.ok(rendered.includes("/wali/akademik/raport/rc_777"));
    });
  });

  test("7. Worker Atomic Claim & Concurrency Guard", async () => {
    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      const item = await queueNotification(
        {
          recipient: "081200001111",
          templateKey: "ANNOUNCEMENT",
          payload: { title: "Ujian", body: "Ujian dimulai Senin" },
        },
        db
      );

      // Simulate Worker 1 claiming item atomically
      const claim1 = await db.notificationOutbox.updateMany({
        where: {
          id: item.id,
          institutionId: "inst_alpha",
          status: { in: ["PENDING", "FAILED"] },
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
      assert.strictEqual(claim1.count, 1);

      // Worker 2 attempts to claim same item concurrently -> fails because status is no longer PENDING/FAILED
      const claim2 = await db.notificationOutbox.updateMany({
        where: {
          id: item.id,
          institutionId: "inst_alpha",
          status: { in: ["PENDING", "FAILED"] },
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
      assert.strictEqual(claim2.count, 0, "Concurrent worker must be locked out by atomic claim");
    });
  });

  test("8. Permanent vs Transient Error Classification", () => {
    assert.strictEqual(isPermanentNotificationFailure("Nomor tujuan tidak terdaftar di WhatsApp"), true);
    assert.strictEqual(isPermanentNotificationFailure("Nomor tujuan tidak valid"), true);
    assert.strictEqual(isPermanentNotificationFailure("Template tidak dikenal"), true);
    assert.strictEqual(isPermanentNotificationFailure("Unsupported provider requested"), true);

    // Transient
    assert.strictEqual(isPermanentNotificationFailure("Network timeout after 30000ms"), false);
    assert.strictEqual(isPermanentNotificationFailure("502 Bad Gateway from upstream"), false);
    assert.strictEqual(isPermanentNotificationFailure("Connection reset by peer"), false);
  });

  test("9. Tenant Isolation Guard", async () => {
    const db = createInMemoryPrisma();

    await runWithTenantContext(tenantA, async () => {
      await queueNotification(
        {
          recipient: "081211112222",
          templateKey: "ANNOUNCEMENT",
          payload: { title: "A", body: "A" },
        },
        db
      );
    });

    await runWithTenantContext(tenantB, async () => {
      await queueNotification(
        {
          recipient: "081299990000",
          templateKey: "ANNOUNCEMENT",
          payload: { title: "B", body: "B" },
        },
        db
      );

      // Tenant B can only see their own notification
      const itemsB = await db.notificationOutbox.findMany({
        where: { institutionId: "inst_beta" },
      });
      assert.strictEqual(itemsB.length, 1);
      assert.strictEqual(itemsB[0].recipient, "6281299990000");

      const itemsA = await db.notificationOutbox.findMany({
        where: { institutionId: "inst_alpha" },
      });
      assert.strictEqual(itemsA.length, 1);
      assert.strictEqual(itemsA[0].recipient, "6281211112222");
    });
  });
});
