/**
 * Tipe dan Kontrak untuk Master Data Excel & CSV Importer NataSekolah
 */

export type ImportRowStatus = "VALID" | "WARNING" | "ERROR";

export type ImportRowAction = "CREATE" | "SKIP_DUPLICATE" | "REJECT";

export interface RawImportRow {
  [key: string]: unknown;
}

export interface SanitizedStudentImportData {
  nis: string;
  nisn?: string | null;
  nik?: string | null;
  fullName: string;
  nickname?: string | null;
  gender: "L" | "P";
  birthPlace?: string | null;
  birthDate?: Date | null;
  birthDateString?: string | null;
  religion?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  // Guardian optional fields
  guardianName?: string | null;
  guardianRelationship?: "AYAH" | "IBU" | "WALI" | "LAINNYA";
  guardianPhoneWa?: string | null;
  // Classroom optional fields
  classroomName?: string | null;
}

export interface ImportRowIssue {
  field?: string;
  message: string;
}

export interface PreviewRow {
  rowNumber: number;
  status: ImportRowStatus;
  action: ImportRowAction;
  raw: Record<string, string>;
  sanitized: SanitizedStudentImportData;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  duplicateType?: "EXACT" | "POTENTIAL";
  matchedExistingStudent?: {
    id: string;
    nis: string;
    fullName: string;
  };
}

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  newRecords: number;
  exactDuplicates: number;
  potentialDuplicates: number;
}

export interface ImportPreviewResult {
  fileName: string;
  summary: ImportPreviewSummary;
  rows: PreviewRow[];
  canProceed: boolean;
}

export interface ImportExecutionResult {
  totalProcessed: number;
  createdStudents: number;
  createdGuardians: number;
  linkedEnrollments: number;
  skippedDuplicates: number;
  failedRows: number;
  details: Array<{
    rowNumber: number;
    studentNis: string;
    studentName: string;
    status: "CREATED" | "SKIPPED" | "FAILED";
    message?: string;
  }>;
}
