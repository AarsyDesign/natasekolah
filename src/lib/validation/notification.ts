import { z } from "zod";

export const NOTIFICATION_CHANNELS = ["WHATSAPP", "EMAIL", "SMS"] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export const NOTIFICATION_TEMPLATE_KEYS = [
  "PAYMENT_RECEIPT",
  "ATTENDANCE_ALERT",
  "GUARDIAN_INVITE",
  "ANNOUNCEMENT",
  "CUSTOM_ALERT",
] as const;
export type NotificationTemplateKey = typeof NOTIFICATION_TEMPLATE_KEYS[number];

export const NOTIFICATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

export const WHATSAPP_PROVIDERS = ["DEEPLINK", "FONNTE", "WAHA"] as const;
export type WhatsAppProviderType = typeof WHATSAPP_PROVIDERS[number];

// Indonesian phone number sanitizer for WhatsApp (ensures 628xxx format)
export function sanitizeIndonesianPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

export const queueNotificationInputSchema = z.object({
  recipient: z
    .string()
    .min(10, "Nomor tujuan minimal 10 digit")
    .max(16, "Nomor tujuan maksimal 16 digit")
    .transform(sanitizeIndonesianPhone)
    .refine((val) => /^628\d{8,12}$/.test(val), {
      message: "Nomor tujuan harus merupakan nomor seluler Indonesia yang sah (misal 08123456789)",
    }),
  templateKey: z.enum(NOTIFICATION_TEMPLATE_KEYS, {
    message: "Template notifikasi tidak dikenal",
  }),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  channel: z.enum(NOTIFICATION_CHANNELS).default("WHATSAPP"),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export type QueueNotificationInput = z.infer<typeof queueNotificationInputSchema>;

export const notificationFilterSchema = z.object({
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  templateKey: z.enum(NOTIFICATION_TEMPLATE_KEYS).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

export const whatsappProviderConfigSchema = z.object({
  provider: z.enum(WHATSAPP_PROVIDERS).default("DEEPLINK"),
  apiKey: z.string().optional(),
  endpointUrl: z.string().url("Endpoint URL WAHA harus URL valid").optional(),
  sessionKey: z.string().optional(),
});

export type WhatsAppProviderConfig = z.infer<typeof whatsappProviderConfigSchema>;
