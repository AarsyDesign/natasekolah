import { queueNotification } from "./outbox-service";
import { prisma } from "../prisma";

export async function notifyPaymentCompleted(
  params: {
    recipientPhone: string;
    studentName: string;
    receiptNo: string;
    amount: number;
    categoryName: string;
    paymentDate?: string;
    idempotencyKey?: string;
  },
  txPrisma?: typeof prisma
) {
  return queueNotification(
    {
      recipient: params.recipientPhone,
      templateKey: "PAYMENT_RECEIPT",
      payload: {
        studentName: params.studentName,
        receiptNo: params.receiptNo,
        amount: params.amount,
        categoryName: params.categoryName,
        paymentDate: params.paymentDate || new Date().toLocaleDateString("id-ID"),
      },
      channel: "WHATSAPP",
      idempotencyKey: params.idempotencyKey,
    },
    txPrisma
  );
}

export async function notifyAttendanceAlert(
  params: {
    recipientPhone: string;
    studentName: string;
    status: "PRESENT" | "EXCUSED" | "SICK" | "ABSENT";
    date?: string;
    subjectName?: string;
    classroomName?: string;
    idempotencyKey?: string;
  },
  txPrisma?: typeof prisma
) {
  return queueNotification(
    {
      recipient: params.recipientPhone,
      templateKey: "ATTENDANCE_ALERT",
      payload: {
        studentName: params.studentName,
        status: params.status,
        date: params.date || new Date().toLocaleDateString("id-ID"),
        subjectName: params.subjectName || null,
        classroomName: params.classroomName || null,
      },
      channel: "WHATSAPP",
      idempotencyKey: params.idempotencyKey,
    },
    txPrisma
  );
}

export async function notifyReportCardPublished(
  params: {
    recipientPhone: string;
    studentName: string;
    reportCardId: string;
    semester: number;
    academicYear: string;
    classroomName?: string;
    reportUrl?: string;
    idempotencyKey?: string;
  },
  txPrisma?: typeof prisma
) {
  return queueNotification(
    {
      recipient: params.recipientPhone,
      templateKey: "REPORT_CARD_PUBLISHED",
      payload: {
        studentName: params.studentName,
        reportCardId: params.reportCardId,
        semester: params.semester,
        academicYear: params.academicYear,
        classroomName: params.classroomName || null,
        reportUrl: params.reportUrl || `/wali/akademik/raport/${params.reportCardId}`,
      },
      channel: "WHATSAPP",
      idempotencyKey: params.idempotencyKey || `REPORT_CARD_PUBLISHED:${params.reportCardId}`,
    },
    txPrisma
  );
}

export async function notifyGuardianInvitation(
  params: {
    recipientPhone: string;
    guardianName: string;
    studentName: string;
    inviteUrl: string;
    idempotencyKey?: string;
  },
  txPrisma?: typeof prisma
) {
  return queueNotification(
    {
      recipient: params.recipientPhone,
      templateKey: "GUARDIAN_INVITE",
      payload: {
        guardianName: params.guardianName,
        studentName: params.studentName,
        inviteUrl: params.inviteUrl,
      },
      channel: "WHATSAPP",
      idempotencyKey: params.idempotencyKey,
    },
    txPrisma
  );
}

/**
 * Notifikasi persetujuan izin pulang (tasrih) ke wali santri via Outbox.
 */
export async function notifyPermitApproved(
  params: {
    recipientPhone: string;
    studentName: string;
    permitType: string;
    leaveAt: string;
    returnAt?: string | null;
    approvedByName?: string | null;
    permitId?: string;
    idempotencyKey?: string;
  },
  txPrisma?: typeof prisma
) {
  return queueNotification(
    {
      recipient: params.recipientPhone,
      templateKey: "PERMIT_APPROVED",
      payload: {
        studentName: params.studentName,
        permitType: params.permitType,
        leaveAt: params.leaveAt,
        returnAt: params.returnAt || null,
        approvedByName: params.approvedByName || null,
      },
      channel: "WHATSAPP",
      idempotencyKey:
        params.idempotencyKey ||
        (params.permitId ? `PERMIT_APPROVED:${params.permitId}` : undefined),
    },
    txPrisma
  );
}
