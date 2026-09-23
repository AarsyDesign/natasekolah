import { test, describe } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  queueNotification,
  processOutboxQueue,
  cancelNotification,
} from "../src/lib/notification/outbox-service";
import {
  notifyPaymentCompleted,
  notifyAttendanceAlert,
  notifyGuardianInvitation,
} from "../src/lib/notification/events";
import { sanitizeIndonesianPhone } from "../src/lib/validation/notification";
import { renderNotificationMessage } from "../src/lib/notification/templates";

function createMockPrisma() {
  const store: Map<string, any> = new Map();
  let autoId = 1;

  return {
    notificationOutbox: {
      create: async ({ data }: { data: any }) => {
        const id = `notif-${autoId++}`;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(id, record);
        return record;
      },
      findMany: async ({ where, take, skip = 0 }: any) => {
        let items = Array.from(store.values());

        if (where.institutionId) {
          items = items.filter((i) => i.institutionId === where.institutionId);
        }
        if (where.status && typeof where.status === "object" && where.status.in) {
          items = items.filter((i) => where.status.in.includes(i.status));
        } else if (where.status && typeof where.status === "string") {
          items = items.filter((i) => i.status === where.status);
        }
        if (where.attempts && typeof where.attempts === "object") {
          items = items.filter((i) => i.attempts < (i.maxAttempts || 5));
        }

        if (take) {
          items = items.slice(skip, skip + take);
        }
        return items;
      },
      findFirst: async ({ where }: any) => {
        const items = Array.from(store.values());
        return (
          items.find(
            (i) => i.id === where.id && i.institutionId === where.institutionId
          ) || null
        );
      },
      count: async ({ where }: any) => {
        let items = Array.from(store.values());
        if (where.institutionId) {
          items = items.filter((i) => i.institutionId === where.institutionId);
        }
        return items.length;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const record = store.get(where.id);
        if (!record) throw new Error("Record not found");

        if (data.attempts && data.attempts.increment) {
          record.attempts += data.attempts.increment;
        }
        if (data.status) record.status = data.status;
        if (data.providerId) record.providerId = data.providerId;
        if (data.externalId !== undefined) record.externalId = data.externalId;
        if (data.errorMessage !== undefined) record.errorMessage = data.errorMessage;
        if (data.lastAttemptAt) record.lastAttemptAt = data.lastAttemptAt;
        if (data.nextRetryAt !== undefined) record.nextRetryAt = data.nextRetryAt;
        record.updatedAt = new Date();

        store.set(where.id, record);
        return record;
      },
    },
    $store: store,
  };
}

describe("Phase 4 — Communication Engine & Notification Outbox Tests", () => {
  const mockTenantContext: TenantContext = {
    institutionId: "inst_demo_outbox",
    userId: "user_admin_outbox",
    roles: ["ADMIN"],
    permissions: ["academic:manage"],
    isSuperAdmin: false,
  };

  test("1. Indonesian Phone Number Sanitizer", () => {
    assert.strictEqual(sanitizeIndonesianPhone("08123456789"), "628123456789");
    assert.strictEqual(sanitizeIndonesianPhone("628123456789"), "628123456789");
    assert.strictEqual(sanitizeIndonesianPhone("+62 812-3456-789"), "628123456789");
  });

  test("2. Notification Templates Rendering", () => {
    const paymentMsg = renderNotificationMessage("PAYMENT_RECEIPT", {
      studentName: "Ahmad Santri",
      receiptNo: "KW-2026-001",
      amount: 500000,
      categoryName: "SPP Syahriah",
    });
    assert.ok(paymentMsg.includes("Ahmad Santri"));
    assert.ok(paymentMsg.includes("KW-2026-001"));
    assert.ok(paymentMsg.includes("500.000"));

    const attendanceMsg = renderNotificationMessage("ATTENDANCE_ALERT", {
      studentName: "Fatimah",
      status: "ABSENT",
      date: "2026-09-23",
      subjectName: "Fiqih",
    });
    assert.ok(attendanceMsg.includes("Fatimah"));
    assert.ok(attendanceMsg.includes("Fiqih"));
    assert.ok(attendanceMsg.includes("ALPA"));
  });

  test("3. Queueing Notification into Outbox", async () => {
    const mockPrisma = createMockPrisma();

    await runWithTenantContext(mockTenantContext, async () => {
      const notif = await queueNotification(
        {
          recipient: "081299998888",
          templateKey: "PAYMENT_RECEIPT",
          payload: { studentName: "Budi", receiptNo: "KW-001", amount: 100000 },
          channel: "WHATSAPP",
        },
        mockPrisma as any
      );

      assert.ok(notif.id);
      assert.strictEqual(notif.recipient, "6281299998888");
      assert.strictEqual(notif.status, "PENDING");
      assert.strictEqual(notif.institutionId, "inst_demo_outbox");
    });
  });

  test("4. Business Events Auto-Queueing (Payment, Attendance, Invitation)", async () => {
    const mockPrisma = createMockPrisma();

    await runWithTenantContext(mockTenantContext, async () => {
      const payNotif = await notifyPaymentCompleted(
        {
          recipientPhone: "081111111111",
          studentName: "Santri A",
          receiptNo: "KW-100",
          amount: 250000,
          categoryName: "Syahriah September",
        },
        mockPrisma as any
      );
      assert.strictEqual(payNotif.templateKey, "PAYMENT_RECEIPT");

      const attNotif = await notifyAttendanceAlert(
        {
          recipientPhone: "082222222222",
          studentName: "Santri B",
          status: "ABSENT",
        },
        mockPrisma as any
      );
      assert.strictEqual(attNotif.templateKey, "ATTENDANCE_ALERT");

      const invNotif = await notifyGuardianInvitation(
        {
          recipientPhone: "083333333333",
          guardianName: "Wali C",
          studentName: "Santri C",
          inviteUrl: "https://natasekolah.id/invite/123",
        },
        mockPrisma as any
      );
      assert.strictEqual(invNotif.templateKey, "GUARDIAN_INVITE");

      assert.strictEqual(mockPrisma.$store.size, 3);
    });
  });

  test("5. DeepLink WhatsApp Provider Outbox Execution", async () => {
    const mockPrisma = createMockPrisma();

    await runWithTenantContext(mockTenantContext, async () => {
      await queueNotification(
        {
          recipient: "081234567890",
          templateKey: "ANNOUNCEMENT",
          payload: { title: "Libur Maulid", body: "KBM diliburkan besok." },
          channel: "WHATSAPP",
        },
        mockPrisma as any
      );

      const { prisma } = await import("../src/lib/prisma");
      const originalFindMany = prisma.notificationOutbox.findMany;
      const originalUpdate = prisma.notificationOutbox.update;

      prisma.notificationOutbox.findMany = mockPrisma.notificationOutbox.findMany as any;
      prisma.notificationOutbox.update = mockPrisma.notificationOutbox.update as any;

      try {
        const processResult = await processOutboxQueue(10, "DEEPLINK");

        assert.strictEqual(processResult.processed, 1);
        assert.strictEqual(processResult.succeeded, 1);

        const item = mockPrisma.$store.get(processResult.results[0].id);
        assert.strictEqual(item.status, "DELIVERED");
        assert.strictEqual(item.providerId, "deeplink");
        assert.ok(item.externalId.includes("https://wa.me/6281234567890"));
      } finally {
        prisma.notificationOutbox.findMany = originalFindMany;
        prisma.notificationOutbox.update = originalUpdate;
      }
    });
  });
});
