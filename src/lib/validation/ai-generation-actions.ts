/**
 * AI Generation Validation Schemas
 * Phase 8 — AI & Automation
 */

import { z } from 'zod';
import { AI_PROVIDERS, AI_GENERATION_JOB_STATUS } from '@/lib/ai-generation/types';

// Provider enum
export const aiProviderSchema = z.enum(AI_PROVIDERS);

// Job status enum
export const aiGenerationJobStatusSchema = z.enum(AI_GENERATION_JOB_STATUS);

// Prompt parameters
export const aiGenerationPromptParamsSchema = z.object({
  subjectId: z.string().uuid('Subject ID harus UUID valid'),
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  topic: z.string().max(200).optional(),
  count: z.number().int().min(1).max(10, 'Maksimal 10 soal per request'),
  additionalInstructions: z.string().max(1000).optional(),
});

// Create job input
export const createAIGenerationJobInputSchema = z.object({
  subjectId: z.string().uuid('Subject ID harus UUID valid'),
  prompt: z.string().min(10).max(5000),
  provider: aiProviderSchema,
  model: z.string().min(1).max(100),
  promptParams: aiGenerationPromptParamsSchema,
});

// Execute job input
export const executeAIGenerationInputSchema = z.object({
  jobId: z.string().uuid('Job ID harus UUID valid'),
});

// Review job input
export const reviewAIGenerationJobInputSchema = z.object({
  jobId: z.string().uuid('Job ID harus UUID valid'),
  action: z.enum(['save', 'discard']),
  selectedQuestionIds: z.array(z.string()).optional(),
});

// List jobs filter
export const listAIGenerationJobsFilterSchema = z.object({
  status: z.enum(AI_GENERATION_JOB_STATUS).optional(),
  subjectId: z.string().uuid().optional(),
});

// Type exports
export type CreateAIGenerationJobInput = z.infer<typeof createAIGenerationJobInputSchema>;
export type ExecuteAIGenerationInput = z.infer<typeof executeAIGenerationInputSchema>;
export type ReviewAIGenerationJobInput = z.infer<typeof reviewAIGenerationJobInputSchema>;
export type ListAIGenerationJobsFilter = z.infer<typeof listAIGenerationJobsFilterSchema>;
export type AIGenerationPromptParams = z.infer<typeof aiGenerationPromptParamsSchema>;

// Quota check result (for UI)
export const aiGenerationQuotaResultSchema = z.object({
  allowed: z.boolean(),
  currentCount: z.number().int().min(0),
  limit: z.number().int().min(1),
  cooldownRemaining: z.number().int().min(0).optional(),
  nextAvailableAt: z.date().optional(),
});
export type AIGenerationQuotaResult = z.infer<typeof aiGenerationQuotaResultSchema>;

// Usage history entry
export const aiGenerationUsageHistoryEntrySchema = z.object({
  date: z.date(),
  count: z.number().int().min(0),
});
export type AIGenerationUsageHistoryEntry = z.infer<typeof aiGenerationUsageHistoryEntrySchema>;