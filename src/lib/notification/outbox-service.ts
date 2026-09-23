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
 * Queue a new notification into the Outbox inside or outside an existing Prisma transaction
 */
export async function queueNotification(
  input: QueueNotificationInput,
  txPrisma?: typeof prisma
) {
  const context = requireTenantContext();
  const validated = queueNotificationInputSchema.parse(input);

  const client = txPrisma || prisma;

  const payloadJson = JSON.stringify(validated.payload);

  const notification = await client.notificationOutbox.create({
    data: {
      institutionId: context.institutionId,
      recipient: validated.recipient,
      templateKey: validated.templateKey,
      payloadJson: payloadJson,
      channel: validated.channel,
      status: "PENDING",
      attempts: 0,
      maxAttempts: validated.maxAttempts ?? 5,
      nextRetryAt: new Date(),
    },
  });

  return notification;
}

/**
 * Process pending/failed notifications in the Outbox with exponential backoff
 */
export async function processOutboxQueue(
  batchSize = 10,
  providerType?: WhatsAppProviderType
) {
  const context = requireTenantContext();
  const now = new Date();

  // Fetch pending or ready-to-retry notifications
  const items = await prisma.notificationOutbox.findMany({
    where: {
      institutionId: context.institutionId,
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: prisma.notificationOutbox.fields.maxAttempts },
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
    // Mark processing
    await prisma.notificationOutbox.update({
      where: { id: item.id },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });

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
          },
        });
        results.push({ id: item.id, success: true, externalId: sendResult.externalId });
      } else {
        failedCount++;
        const nextAttempts = item.attempts + 1;
        const isMaxReached = nextAttempts >= item.maxAttempts;

        // Exponential backoff: 2^attempts * 60 seconds (1m, 2m, 4m, 8m...)
        const backoffMinutes = Math.pow(2, nextAttempts - 1);
        const nextRetryAt = isMaxReached
          ? null
          : new Date(Date.now() + backoffMinutes * 60 * 1000);

        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: isMaxReached ? "FAILED" : "PENDING",
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
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          errorMessage: `System Error: ${errorMsg}`,
        },
      });
      results.push({ id: item.id, success: false, error: errorMsg });
    }
  }

  return {
    processed: items.length,
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
