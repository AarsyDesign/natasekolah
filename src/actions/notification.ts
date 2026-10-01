"use server";

import { requireActionSession } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import { requirePermission } from "../lib/auth/permissions";
import {
  queueNotification,
  processOutboxQueue,
  listOutboxNotifications,
  cancelNotification,
} from "../lib/notification/outbox-service";
import {
  QueueNotificationInput,
  NotificationFilterInput,
  WhatsAppProviderType,
} from "../lib/validation/notification";

export async function queueNotificationAction(input: QueueNotificationInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    requirePermission(context as any, "academic:manage");
    const notification = await queueNotification(input);
    return { success: true, data: notification };
  });
}

export async function processOutboxQueueAction(batchSize = 10, providerType?: WhatsAppProviderType) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    requirePermission(context as any, "academic:manage");
    const result = await processOutboxQueue(batchSize, providerType);
    return { success: true, data: result };
  });
}

export async function listNotificationsAction(input?: Partial<NotificationFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const result = await listOutboxNotifications(input);
    return { success: true, data: result };
  });
}

export async function cancelNotificationAction(id: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    requirePermission(context as any, "academic:manage");
    const result = await cancelNotification(id);
    return { success: true, data: result };
  });
}
