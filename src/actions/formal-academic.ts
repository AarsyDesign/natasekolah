"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessment,
  listAssessments,
  getAssessmentRoster,
  recordScore,
  recordBatchScores,
  listScores,
  generateDraftReportCard,
  publishReportCard,
  getReportCard,
  listReportCards,
} from "../lib/formal-academic";
import type {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  AssessmentFilterQuery,
  RecordScoreInput,
  RecordBatchScoresInput,
  ScoreFilterQuery,
  GenerateReportCardInput,
  PublishReportCardInput,
  ReportCardFilterQuery,
} from "../lib/validation/formal-academic";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

// -------------------------------------------------------------
// ASSESSMENT ACTIONS
// -------------------------------------------------------------

export async function createAssessmentAction(input: CreateAssessmentInput) {
  try {
    const ctx = await getContext();
    const result = await createAssessment(ctx, input);
    revalidatePath("/assessments");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat penilaian.",
    };
  }
}

export async function updateAssessmentAction(id: string, input: UpdateAssessmentInput) {
  try {
    const ctx = await getContext();
    const result = await updateAssessment(ctx, id, input);
    revalidatePath("/assessments");
    revalidatePath(`/assessments/${id}`);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui penilaian.",
    };
  }
}

export async function deleteAssessmentAction(id: string) {
  try {
    const ctx = await getContext();
    const result = await deleteAssessment(ctx, id);
    revalidatePath("/assessments");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus penilaian.",
    };
  }
}

export async function getAssessmentAction(id: string) {
  try {
    const ctx = await getContext();
    const result = await getAssessment(ctx, id);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat detail penilaian.",
    };
  }
}

export async function listAssessmentsAction(query?: AssessmentFilterQuery) {
  try {
    const ctx = await getContext();
    const result = await listAssessments(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar penilaian.",
    };
  }
}

// -------------------------------------------------------------
// GRADE ACTIONS
// -------------------------------------------------------------

export async function getAssessmentRosterAction(assessmentId: string) {
  try {
    const ctx = await getContext();
    const result = await getAssessmentRoster(ctx, assessmentId);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat roster penilaian siswa.",
    };
  }
}

export async function recordScoreAction(input: RecordScoreInput) {
  try {
    const ctx = await getContext();
    const result = await recordScore(ctx, input);
    revalidatePath(`/assessments/${input.assessmentId}`);
    revalidatePath("/grades");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan nilai siswa.",
    };
  }
}

export async function recordBatchScoresAction(input: RecordBatchScoresInput) {
  try {
    const ctx = await getContext();
    const result = await recordBatchScores(ctx, input);
    revalidatePath(`/assessments/${input.assessmentId}`);
    revalidatePath("/grades");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan nilai massal.",
    };
  }
}

export async function listScoresAction(query?: ScoreFilterQuery) {
  try {
    const ctx = await getContext();
    const result = await listScores(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar nilai.",
    };
  }
}

// -------------------------------------------------------------
// REPORT CARD ACTIONS
// -------------------------------------------------------------

export async function generateDraftReportCardAction(input: GenerateReportCardInput) {
  try {
    const ctx = await getContext();
    const result = await generateDraftReportCard(ctx, input);
    revalidatePath("/reports");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghasilkan draf raport.",
    };
  }
}

export async function publishReportCardAction(input: PublishReportCardInput) {
  try {
    const ctx = await getContext();
    const result = await publishReportCard(ctx, input);
    revalidatePath("/reports");
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menerbitkan dan membekukan raport.",
    };
  }
}

export async function getReportCardAction(id: string) {
  try {
    const ctx = await getContext();
    const result = await getReportCard(ctx, id);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat data buku raport.",
    };
  }
}

export async function listReportCardsAction(query?: ReportCardFilterQuery) {
  try {
    const ctx = await getContext();
    const result = await listReportCards(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat daftar buku raport.",
    };
  }
}
