import type { Guardian, Student, Enrollment, Classroom, AcademicYear } from "@prisma/client";
import type { FrozenReportCardSnapshot } from "../formal-academic/report-card-service";

export interface GuardianLinkedStudent {
  student: Student;
  relationship: string;
  isPrimary: boolean;
  activeEnrollment: (Enrollment & {
    classroom: Classroom;
    academicYear: AcademicYear;
  }) | null;
}

export interface GuardianProfileData {
  guardian: Guardian;
  institution: {
    id: string;
    name: string;
    slug: string;
    type: string;
    address: string | null;
    phone: string | null;
  };
  children: GuardianLinkedStudent[];
}

export interface GuardianAttendanceSummary {
  totalSessions: number;
  presentCount: number;
  sickCount: number;
  excusedCount: number;
  absentCount: number;
  attendanceRate: number; // Persentase (0 - 100)
  recentRecords: Array<{
    id: string;
    date: Date;
    status: string;
    note: string | null;
    context: string;
    subjectName: string | null;
    roomName: string | null;
  }>;
}

export interface GuardianFinanceSummary {
  unpaidChargesCount: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
  recentCharges: Array<{
    id: string;
    categoryName: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    dueDate: Date | null;
  }>;
  recentTransactions: Array<{
    id: string;
    transactionNo: string;
    date: Date;
    totalAmount: number;
    receiptNo: string | null;
    categoryNames: string[];
  }>;
}

export interface GuardianAcademicSummary {
  latestPublishedReportCard: {
    id: string;
    academicYearName: string;
    classroomName: string;
    semester: string;
    publishedAt: Date | null;
    totalSubjects: number;
    averageScore: number;
  } | null;
  recentScores: Array<{
    id: string;
    assessmentTitle: string;
    assessmentType: string;
    subjectName: string;
    score: number;
    maxScore: number;
    date: Date;
  }>;
  publishedReportCards: Array<{
    id: string;
    academicYearName: string;
    classroomName: string;
    semester: string;
    publishedAt: Date | null;
    notes: string | null;
  }>;
}

export interface GuardianTahfidzSummary {
  totalRecords: number;
  totalZiyadahAyat: number;
  totalMurajaahAyat: number;
  lastRecord: {
    surahNumber: number;
    surahName: string;
    startAyah: number;
    endAyah: number;
    type: string;
    quality: string;
    date: Date;
    note: string | null;
  } | null;
  recentRecords: Array<{
    id: string;
    date: Date;
    surahNumber: number;
    surahName: string;
    startAyah: number;
    endAyah: number;
    type: string;
    quality: string;
    note: string | null;
  }>;
}

export interface GuardianDormitorySummary {
  isResident: boolean;
  assignment: {
    dormitoryName: string;
    roomName: string;
    status: string;
    startDate: Date;
    capacity: number;
    currentOccupants: number;
  } | null;
  recentLivingAttendance: Array<{
    id: string;
    date: Date;
    status: string;
    note: string | null;
  }>;
}

export interface GuardianNotificationItem {
  id: string;
  templateKey: string;
  channel: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: Date;
}

export interface GuardianStudentOverview {
  student: Student;
  relationship: string;
  isPrimary: boolean;
  activeEnrollment: (Enrollment & {
    classroom: Classroom;
    academicYear: AcademicYear;
  }) | null;
  attendance: GuardianAttendanceSummary;
  finance: GuardianFinanceSummary;
  academic: GuardianAcademicSummary;
  tahfidz: GuardianTahfidzSummary;
  dormitory: GuardianDormitorySummary;
}

export type { FrozenReportCardSnapshot };
