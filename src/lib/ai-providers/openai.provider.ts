/**
 * OpenAI Provider Implementation
 * Phase 8 - AI Question Generator Runtime
 */

import { IAIProvider, SendAIResult } from './provider.interface';
import type { AIGeneratedQuestion } from '@/lib/ai-generation/types';

export class OpenAIProvider implements IAIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly supportedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY or AI_API_KEY environment variable.');
    }
  }

  async generateQuestions(
    prompt: string,
    model: string,
    params: {
      type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      topic?: string;
      count: number;
    }
  ): Promise<SendAIResult> {
    try {
      // Validate model
      if (!this.supportedModels.includes(model)) {
        return {
          success: false,
          errorMessage: `Model ${model} not supported. Supported: ${this.supportedModels.join(', ')}`,
          isPermanentError: true,
        };
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Anda adalah asisten pembuatan soal pendidikan Indonesia. Output HARUS berupa JSON array valid tanpa teks tambahan, markdown, atau penjelasan.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' }, // Structured output for JSON
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
        
        // Classify error type
        const isPermanent = response.status === 401 || response.status === 403 || response.status === 429;
        
        return {
          success: false,
          errorMessage,
          isPermanentError: isPermanent,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return {
          success: false,
          errorMessage: 'OpenAI returned empty content',
          isPermanentError: false,
        };
      }

      // Parse JSON response
      let parsed: { questions: AIGeneratedQuestion[] };
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          errorMessage: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          isPermanentError: false,
        };
      }

      // Validate structure
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        return {
          success: false,
          errorMessage: 'AI response missing "questions" array',
          isPermanentError: false,
        };
      }

      return {
        success: true,
        questions: parsed.questions,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `OpenAI provider error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }
}