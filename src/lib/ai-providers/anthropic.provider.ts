/**
 * Anthropic (Claude) Provider Implementation
 * Phase 8 - AI Question Generator Runtime
 */

import { IAIProvider, SendAIResult } from './provider.interface';
import type { AIGeneratedQuestion } from '@/lib/ai-generation/types';

export class AnthropicProvider implements IAIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic (Claude)';
  readonly supportedModels = ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY or AI_API_KEY environment variable.');
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          temperature: 0.7,
          system: 'Anda adalah asisten pembuatan soal pendidikan Indonesia. Output HARUS berupa JSON array valid tanpa teks tambahan, markdown, atau penjelasan. Balas HANYA dengan JSON object yang memiliki key "questions" berisi array soal.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Anthropic API error: ${response.status}`;
        
        // Classify error type
        const isPermanent = response.status === 401 || response.status === 403 || response.status === 429;
        
        return {
          success: false,
          errorMessage,
          isPermanentError: isPermanent,
        };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      
      if (!content) {
        return {
          success: false,
          errorMessage: 'Anthropic returned empty content',
          isPermanentError: false,
        };
      }

      // Parse JSON response - Anthropic returns text that should be JSON
      let parsed: { questions: AIGeneratedQuestion[] };
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        // Try to extract JSON from text if wrapped
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            return {
              success: false,
              errorMessage: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
              isPermanentError: false,
            };
          }
        } else {
          return {
            success: false,
            errorMessage: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
            isPermanentError: false,
          };
        }
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
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `Anthropic provider error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }
}