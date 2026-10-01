/**
 * AI Provider Interface
 * Phase 8 - AI Question Generator Runtime
 * Mirip pola WhatsApp provider abstraction
 */

import type { AIGeneratedQuestion, AIProvider } from '@/lib/ai-generation/types';

export interface SendAIResult {
  success: boolean;
  questions?: AIGeneratedQuestion[];
  errorMessage?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  isPermanentError?: boolean;
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedModels: string[];
  
  generateQuestions(
    prompt: string,
    model: string,
    params: {
      type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      topic?: string;
      count: number;
    }
  ): Promise<SendAIResult>;
}

export function getAIProvider(providerType: AIProvider): IAIProvider {
  // Import dinamis untuk menghindari circular dependency
  // akan diisi di provider-factory.ts
  throw new Error(`Provider ${providerType} not implemented yet. Use getAIProvider from provider-factory.`);
}