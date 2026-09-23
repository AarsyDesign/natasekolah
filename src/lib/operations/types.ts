import { PluginId } from "../plugins/registry";

export type AttentionCategory =
  | "ATTENDANCE"
  | "FINANCE"
  | "NOTIFICATION"
  | "ACADEMIC"
  | "CLASSROOM";

export type AttentionSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface OperationalAttentionItem {
  id: string;
  category: AttentionCategory;
  title: string;
  description: string;
  count: number;
  severity: AttentionSeverity;
  actionLabel: string;
  actionHref: string;
}

export interface QuickActionItem {
  id: string;
  label: string;
  description: string;
  href: string;
  category: "STUDENT" | "ACADEMIC" | "ATTENDANCE" | "FINANCE" | "PESANTREN" | "SYSTEM";
  iconName: string;
}

export interface OperationalDashboardStats {
  students: {
    totalActive: number;
  } | null;
  attendance: {
    todaySessionsTotal: number;
    openSessionsCount: number;
    closedSessionsCount: number;
    totalPresent: number;
    totalSick: number;
    totalExcused: number;
    totalAbsent: number;
  } | null;
  finance: {
    unpaidChargesCount: number;
    unpaidChargesSum: number;
    overdueChargesCount: number;
    overdueChargesSum: number;
    todayPaymentsCount: number;
    todayPaymentsSum: number;
  } | null;
  academic: {
    totalAssessments: number;
    draftAssessmentsCount: number;
    draftReportsCount: number;
  } | null;
  tahfidz: {
    todayRecordsCount: number;
  } | null;
  living: {
    activeResidentsCount: number;
    todayDormSessionsCount: number;
  } | null;
  notifications: {
    failedCount: number;
    pendingCount: number;
  } | null;
}

export interface OperationalDashboardData {
  institution: {
    id: string;
    name: string;
    slug: string;
    type: string;
    enabledPlugins: PluginId[];
  };
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  stats: OperationalDashboardStats;
  attentionItems: OperationalAttentionItem[];
  quickActions: QuickActionItem[];
}

export type SearchEntityType = "STUDENT" | "CLASSROOM" | "TEACHER" | "GUARDIAN";

export interface GlobalSearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}
