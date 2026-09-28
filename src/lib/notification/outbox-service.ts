import crypto from "node:crypto";
import { prisma } from "../prisma";
import { requireTenantContext } from "../tenant/context";
import {
  QueueNotificationInput,
  queueNotificationInputSchema,
  NotificationFilterInput,
  notificationFilterSchema,
  WhatsAppProviderType,
} from "../validation/notification";
import { renderNotificationMessage } from "./templates";
import { getWhatsAppProvider } from "./providers/provider-factory";

export class NotificationOutboxError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "NotificationOutboxError";
  }
}

/**
 * Generate a deterministic ID for a notification to enforce DB-level idempotency without schema migration.
 */
export function generateDeterministicNotificationId(institutionId: string, idempotencyKey: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${institutionId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 20);
  return `notif_${hash}`;
}

/**
 * Determines whether an error message indicates a permanent, un-retryable delivery failure.
 */
export function isPermanentNotificationFailure(errorMessage?: string | null): boolean {
  if (!errorMessage) return false;
  return /tidak terdaftar|invalid recipient|tidak valid|invalid phone|invalid number|unsupported provider|template tidak dikenal/i.test(
    errorMessage
  );
}

/**
 * Queue a new notification into the Outbox inside or outside an existing Prisma transaction.
 * Supports deterministic idempotency: if the same idempotencyKey is submitted again,
 * returns the existing notification without creating a duplicate.
 */
export async function queueNotification(
  input: QueueNotificationInput,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  const validated = queueNotificationInputSchema.parse(input);
  const client = txPrisma || prisma;

  let deterministicId: string | undefined = undefined;
  if (validated.idempotencyKey) {
    deterministicId = generateDeterministicNotificationId(context.institutionId, validated.idempotencyKey);

    // Check existing for deduplication
    const existing = await client.notificationOutbox.findFirst({
      where: {
        id: deterministicId,
        institutionId: context.institutionId,
      },
    });

    if (existing) {
      return existing;
    }
  }

  const payloadWithMeta = {
    ...validated.payload,
    ...(validated.idempotencyKey ? { _idempotencyKey: validated.idempotencyKey } : {}),
  };

  try {
    const notification = await client.notificationOutbox.create({
      data: {
        ...(deterministicId ? { id: deterministicId } : {}),
        institutionId: context.institutionId,
        recipient: validated.recipient,
        templateKey: validated.templateKey,
        payloadJson: JSON.stringify(payloadWithMeta),
        channel: validated.channel,
        status: "PENDING",
        attempts: 0,
        maxAttempts: validated.maxAttempts ?? 5,
        nextRetryAt: new Date(),
      },
    });

    return notification;
  } catch (err: unknown) {
    // If a concurrent race condition occurred with the same deterministicId, return existing record
    if (deterministicId) {
      const isUniqueViolation =
        (err as { code?: string })?.code === "P2002" ||
        String(err).includes("Unique constraint") ||
        String(err).includes("duplicate key");

      if (isUniqueViolation) {
        const existing = await client.notificationOutbox.findFirst({
          where: {
            id: deterministicId,
            institutionId: context.institutionId,
          },
        });
        if (existing) {
          return existing;
        }
      }
    }

    throw err;
  }
}

/**
 * Process pending/failed notifications in the Outbox with atomic claiming and exponential backoff.
 * Prevents race conditions across concurrent workers using atomic updates.
 */
export async function processOutboxQueue(
  batchSize = 10,
  providerType?: WhatsAppProviderType,
  targetInstitutionId?: string
) {
  const institutionId = targetInstitutionId || requireTenantContext().institutionId;
  const now = new Date();

  // Fetch pending or ready-to-retry notifications
  const items = await prisma.notificationOutbox.findMany({
    where: {
      institutionId,
      status: { in: ["PENDING", "FAILED"] },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const provider = getWhatsAppProvider(providerType);
  const results: Array<{ id: string; success: boolean; externalId?: string; error?: string }> = [];
  let succeededCount = 0;
  let failedCount = 0;

  for (const item of items) {
    // Check if max attempts already reached
    if (item.attempts >= item.maxAttempts) {
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          nextRetryAt: null,
          errorMessage: item.errorMessage || "Maksimal batas percobaan terlampaui",
        },
      });
      failedCount++;
      results.push({ id: item.id, success: false, error: "Maksimal batas percobaan terlampaui" });
      continue;
    }

    // Atomic claim: only one worker can transition from PENDING/FAILED to PROCESSING
    const claimResult = await prisma.notificationOutbox.updateMany({
      where: {
        id: item.id,
        institutionId,
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });

    if (claimResult.count === 0) {
      // Concurrently claimed by another worker; skip
      continue;
    }

    try {
      const payloadObj = JSON.parse(item.payloadJson || "{}");
      const messageBody = renderNotificationMessage(item.templateKey as any, payloadObj);

      const sendResult = await provider.sendMessage(item.recipient, messageBody);

      if (sendResult.success) {
        succeededCount++;
        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: "DELIVERED",
            providerId: provider.id,
            externalId: sendResult.deepLinkUrl || sendResult.externalId || null,
            errorMessage: null,
            nextRetryAt: null,
          },
        });
        results.push({ id: item.id, success: true, externalId: sendResult.externalId });
      } else {
        failedCount++;
        const nextAttempts = item.attempts + 1;
        const isPermanent = sendResult.isPermanentError || isPermanentNotificationFailure(sendResult.errorMessage);
        const isMaxReached = nextAttempts >= item.maxAttempts;

        let nextRetryAt: Date | null = null;
        let finalStatus: "PENDING" | "FAILED" = "PENDING";

        if (isPermanent || isMaxReached) {
          finalStatus = "FAILED";
          nextRetryAt = null;
        } else {
          // Exponential backoff: 2^attempts * 60 seconds (1m, 2m, 4m, 8m...)
          const backoffMinutes = Math.pow(2, nextAttempts - 1);
          nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
        }

        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: finalStatus,
            providerId: provider.id,
            errorMessage: sendResult.errorMessage || "Pengiriman gagal",
            nextRetryAt,
          },
        });
        results.push({ id: item.id, success: false, error: sendResult.errorMessage });
      }
    } catch (err: unknown) {
      failedCount++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isPermanent = isPermanentNotificationFailure(errorMsg);
      const nextAttempts = item.attempts + 1;
      const isMaxReached = nextAttempts >= item.maxAttempts;

      let nextRetryAt: Date | null = null;
      let finalStatus: "PENDING" | "FAILED" = "PENDING";

      if (isPermanent || isMaxReached) {
        finalStatus = "FAILED";
        nextRetryAt = null;
      } else {
        const backoffMinutes = Math.pow(2, nextAttempts - 1);
        nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
      }

      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: finalStatus,
          errorMessage: `System Error: ${errorMsg}`,
          nextRetryAt,
        },
      });
      results.push({ id: item.id, success: false, error: errorMsg });
    }
  }

  return {
    processed: results.length,
    succeeded: succeededCount,
    failed: failedCount,
    results,
  };
}

/**
 * List Outbox notifications for current institution
 */
export async function listOutboxNotifications(input?: Partial<NotificationFilterInput>) {
  const context = requireTenantContext();
  const filter = notificationFilterSchema.parse(input || {});

  const where: any = {
    institutionId: context.institutionId,
  };

  if (filter.status) where.status = filter.status;
  if (filter.templateKey) where.templateKey = filter.templateKey;
  if (filter.channel) where.channel = filter.channel;

  if (filter.search) {
    where.OR = [
      { recipient: { contains: filter.search } },
      { payloadJson: { contains: filter.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationOutbox.count({ where }),
  ]);

  return {
    items,
    total,
    page: filter.page,
    limit: filter.limit,
    totalPages: Math.ceil(total / filter.limit) || 1,
  };
}

/**
 * Cancel a pending notification
 */
export async function cancelNotification(id: string) {
  const context = requireTenantContext();

  const item = await prisma.notificationOutbox.findFirst({
    where: { id, institutionId: context.institutionId },
  });

  if (!item) {
    throw new NotificationOutboxError("Notifikasi tidak ditemukan", 404);
  }

  if (item.status === "DELIVERED") {
    throw new NotificationOutboxError("Notifikasi yang sudah terkirim tidak dapat dibatalkan", 400);
  }

  return await prisma.notificationOutbox.update({
    where: { id: item.id },
    data: { status: "CANCELLED" },
  });
}
