"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "@/lib/auth/service";
import type { TenantContext } from "@/lib/tenant/context";
import {
  createAIGenerationJob,
  executeAIGeneration,
  reviewAIGenerationJob,
  listAIGenerationJobs,
  getAIGenerationJobDetail,
} from "@/lib/ai-generation/ai-generation-service";
import { rethrowIfSessionExpired } from "@/lib/auth/action-session";
import type {
  CreateAIGenerationJobInput,
  ReviewAIGenerationJobInput,
  AIGenerationJobResult,
} from "@/lib/ai-generation/types";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

/**
 * Create AI generation job (status DRAFT)
 */
export async function createAIGenerationJobAction(
  input: CreateAIGenerationJobInput
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const ctx = await getContext();
    const result = await createAIGenerationJob(ctx, input);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal membuat job generate AI." };
  }
}

/**
 * Execute AI generation (call provider, validate, update job to READY_FOR_REVIEW)
 */
export async function executeAIGenerationAction(
  jobId: string
): Promise<{ success: true; data: AIGenerationJobResult } | { success: false; error: string }> {
  try {
    const ctx = await getContext();
    const result = await executeAIGeneration(ctx, jobId);
    revalidatePath("/exams/question-bank");
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal menjalankan generate AI." };
  }
}

/**
 * Review AI generation job (save or discard)
 */
export async function reviewAIGenerationJobAction(
  input: ReviewAIGenerationJobInput
): Promise<{ success: true; data: { saved: number } } | { success: false; error: string }> {
  try {
    const ctx = await getContext();
    const result = await reviewAIGenerationJob(ctx, input);
    revalidatePath("/exams/question-bank");
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal review hasil generate AI." };
  }
}

/**
 * List AI generation jobs for current teacher
 */
export async function listAIGenerationJobsAction(
  filters?: { status?: 'DRAFT' | 'READY_FOR_REVIEW' | 'SAVED' | 'DISCARDED' | 'FAILED'; subjectId?: string }
): Promise<{ success: true; data: Awaited<ReturnType<typeof listAIGenerationJobs>> } | { success: false; error: string }> {
  try {
    const ctx = await getContext();
    const result = await listAIGenerationJobs(ctx, filters);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat daftar job generate AI." };
  }
}

/**
 * Get AI generation job detail with result
 */
export async function getAIGenerationJobDetailAction(
  jobId: string
): Promise<{ success: true; data: Awaited<ReturnType<typeof getAIGenerationJobDetail>> } | { success: false; error: string }> {
  try {
    const ctx = await getContext();
    const result = await getAIGenerationJobDetail(ctx, jobId);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat detail job generate AI." };
  }
}