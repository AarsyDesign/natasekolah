/**
 * AI Generation Types
 * Phase 7 Trek C - AI Question Generator Infrastructure
 */

import type { PluginId } from '@/lib/plugins/registry';

export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_GENERATION_JOB_STATUS = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'SAVED',
  'DISCARDED',
  'FAILED',
] as const;
export type AIGenerationJobStatus = (typeof AI_GENERATION_JOB_STATUS)[number];

export const AI_GENERATION_DAILY_LIMIT = 30;
export const AI_GENERATION_COOLDOWN_SECONDS = 15;

export interface AIGenerationPromptParams {
  subjectId: string;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string;
  count: number; // 1-5 soal per request
  additionalInstructions?: string;
}

export interface AIGeneratedQuestion {
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string;
  stem: string;
  explanation?: string;
  shortAnswerKey?: string;
  options?: Array<{
    label: 'A' | 'B' | 'C' | 'D';
    content: string;
    isCorrect: boolean;
  }>;
}

export interface AIGenerationJobResult {
  questions: AIGeneratedQuestion[];
  provider: AIProvider;
  model: string;
  generatedAt: Date;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CreateAIGenerationJobInput {
  subjectId: string;
  prompt: string;
  provider: AIProvider;
  model: string;
  promptParams: AIGenerationPromptParams;
}

export interface AIGenerationUsageCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  cooldownRemaining?: number; // seconds
  nextAvailableAt?: Date;
}

export interface GenerateQuestionsActionInput {
  subjectId: string;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string;
  count: number; // 1-5
  additionalInstructions?: string;
}

export interface ReviewAIGenerationJobInput {
  jobId: string;
  action: 'save' | 'discard';
  selectedQuestionIds?: string[]; // jika save sebagian
}

export const AI_GENERATION_PLUGIN_ID: PluginId = 'AI_GENERATION';
