/**
 * AI Generation Validation Schemas
 * Phase 7 Trek C - AI Question Generator
 */

import { z } from 'zod';
import { AI_PROVIDERS } from '@/lib/ai-generation/types';

// Provider enum
export const aiProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'local']);

// Job status enum
export const aiGenerationJobStatusSchema = z.enum(['DRAFT', 'READY_FOR_REVIEW', 'SAVED', 'DISCARDED', 'FAILED']);

// Prompt parameters
export const aiGenerationPromptParamsSchema = z.object({
  subjectId: z.string().cuid(),
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  topic: z.string().max(200).optional(),
  count: z.int().min(1).max(5),
  additionalInstructions: z.string().max(1000).optional(),
});

// Create job input
export const createAIGenerationJobInputSchema = z.object({
  subjectId: z.string().cuid(),
  prompt: z.string().min(10).max(10000),
  provider: aiProviderSchema,
  model: z.string().min(1).max(100),
  promptParams: aiGenerationPromptParamsSchema,
});

// Review job input
export const reviewAIGenerationJobInputSchema = z.object({
  jobId: z.string().cuid(),
  action: z.enum(['save', 'discard']),
  selectedQuestionIds: z.array(z.string()).optional(),
});

// List filters
export const listAIGenerationJobsFilterSchema = z.object({
  status: aiGenerationJobStatusSchema.optional(),
  subjectId: z.string().cuid().optional(),
});

// Quota check result
export const aiGenerationQuotaCheckResultSchema = z.object({
  allowed: z.boolean(),
  currentCount: z.int().min(0),
  limit: z.int().min(1),
  cooldownRemaining: z.int().min(0).optional(),
  nextAvailableAt: z.date().optional(),
});

// Generated question (result from AI)
export const aiGeneratedQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  topic: z.string().max(200).optional(),
  stem: z.string().min(5).max(5000),
  explanation: z.string().max(5000).optional(),
  shortAnswerKey: z.string().max(1000).optional(),
  options: z.array(z.object({
    label: z.enum(['A', 'B', 'C', 'D']),
    content: z.string().min(1).max(1000),
    isCorrect: z.boolean(),
  })).optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'MULTIPLE_CHOICE') {
    if (!val.options || val.options.length !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Soal pilihan ganda harus memiliki tepat 4 opsi',
        path: ['options'],
      });
    } else {
      const correctCount = val.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Soal pilihan ganda harus memiliki tepat 1 kunci jawaban',
          path: ['options'],
        });
      }
      const labels = val.options.map(o => o.label).sort().join(',');
      if (labels !== 'A,B,C,D') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Label opsi harus A, B, C, D',
          path: ['options'],
        });
      }
    }
  } else if (val.type === 'SHORT_ANSWER') {
    if (!val.shortAnswerKey || val.shortAnswerKey.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Soal jawaban singkat harus memiliki kunci jawaban',
        path: ['shortAnswerKey'],
      });
    }
    if (val.options && val.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Soal jawaban singkat tidak boleh memiliki opsi',
        path: ['options'],
      });
    }
  } else if (val.type === 'ESSAY') {
    if (val.options && val.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Soal essay tidak boleh memiliki opsi',
        path: ['options'],
      });
    }
  }
});

// Generation result
export const aiGenerationJobResultSchema = z.object({
  questions: z.array(aiGeneratedQuestionSchema).min(1).max(5),
  provider: aiProviderSchema,
  model: z.string().min(1).max(100),
  generatedAt: z.date(),
  usage: z.object({
    promptTokens: z.int().min(0),
    completionTokens: z.int().min(0),
    totalTokens: z.int().min(0),
  }).optional(),
});

// Type exports
export type AIGenerationPromptParams = z.infer<typeof aiGenerationPromptParamsSchema>;
export type CreateAIGenerationJobInput = z.infer<typeof createAIGenerationJobInputSchema>;
export type ReviewAIGenerationJobInput = z.infer<typeof reviewAIGenerationJobInputSchema>;
export type ListAIGenerationJobsFilter = z.infer<typeof listAIGenerationJobsFilterSchema>;
export type AIGenerationQuotaCheckResult = z.infer<typeof aiGenerationQuotaCheckResultSchema>;
export type AIGeneratedQuestion = z.infer<typeof aiGeneratedQuestionSchema>;
export type AIGenerationJobResult = z.infer<typeof aiGenerationJobResultSchema>;