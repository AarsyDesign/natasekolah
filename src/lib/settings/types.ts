import type { PluginId, PluginMetadata } from "../plugins/registry";

export const ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "FOUNDATION_HEAD",
  "PRINCIPAL",
  "ADMIN",
  "TEACHER",
  "FINANCE_STAFF",
] as const;

export type Role = (typeof ASSIGNABLE_ROLES)[number];

export interface InstitutionProfileData {
  id: string;
  name: string;
  slug: string;
  type: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  email: string | null;
  website: string | null;
  enabledPlugins: PluginId[];
}

export interface TerminologyDictionary {
  student: string;
  studentPlural: string;
  guardian: string;
  classroom: string;
  academicYear: string;
  fee: string;
  teacher: string;
}

export interface OperationalAttendanceSettings {
  lateThresholdMinutes: number;
  requireAttendanceNotes: boolean;
}

export interface OperationalFinanceSettings {
  receiptNumberPrefix: string;
  invoiceDueDays: number;
  receiptFooterNote: string;
}

export interface OperationalCommunicationSettings {
  enableWhatsAppNotifications: boolean;
  whatsappProvider: "fonnte" | "waha" | "deeplink";
}

export interface OperationalAcademicSettings {
  passingGradeDefault: number;
  reportCardHeader: string;
}

export interface OperationalSettings {
  attendance: OperationalAttendanceSettings;
  finance: OperationalFinanceSettings;
  communication: OperationalCommunicationSettings;
  academic: OperationalAcademicSettings;
}

export interface ParsedInstitutionSettings {
  email?: string | null;
  website?: string | null;
  terminology?: Partial<TerminologyDictionary>;
  operational?: {
    attendance?: Partial<OperationalAttendanceSettings>;
    finance?: Partial<OperationalFinanceSettings>;
    communication?: Partial<OperationalCommunicationSettings>;
    academic?: Partial<OperationalAcademicSettings>;
  };
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phoneWa: string | null;
  roles: Role[];
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
