import { AcademicDomainError } from "./types";

export type PromotionStatus = "READY" | "WARNING" | "ERROR";

export interface ClassroomMapping {
  sourceClassroomId: string;
  targetClassroomId: string;
}

export interface PromotionPreviewRow {
  studentId: string;
  studentName: string;
  nis: string;
  studentStatus: string;
  sourceClassroomId: string;
  sourceClassroomName: string;
  targetClassroomId: string;
  targetClassroomName: string;
  status: PromotionStatus;
  message?: string;
}

export interface PromotionPreviewSummary {
  totalStudents: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  sourceAcademicYear: {
    id: string;
    name: string;
  };
  targetAcademicYear: {
    id: string;
    name: string;
  };
  rows: PromotionPreviewRow[];
}

export interface PromotionExecutionItem {
  studentId: string;
  targetClassroomId: string;
}

export interface PromotionExecutionResult {
  success: boolean;
  totalPromoted: number;
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  items: Array<{
    studentId: string;
    studentName: string;
    targetClassroomId: string;
    status: "PROMOTED";
  }>;
  auditLogId: string;
}

export class PromotionValidationError extends AcademicDomainError {
  readonly details?: string[];

  constructor(message: string, details?: string[]) {
    super(message, "PROMOTION_VALIDATION_ERROR", 400);
    this.name = "PromotionValidationError";
    this.details = details;
  }
}
