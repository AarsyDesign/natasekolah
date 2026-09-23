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
      },
      channel: "WHATSAPP",
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
    },
    txPrisma
  );
}
