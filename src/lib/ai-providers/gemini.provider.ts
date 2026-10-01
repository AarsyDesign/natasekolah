/**
 * Google Gemini Provider Implementation
 * Phase 8 - AI Question Generator Runtime
 */

import { IAIProvider, SendAIResult } from './provider.interface';
import type { AIGeneratedQuestion } from '@/lib/ai-generation/types';

export class GeminiProvider implements IAIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly supportedModels = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY or AI_API_KEY environment variable.');
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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Anda adalah asisten pembuatan soal pendidikan Indonesia. Output HARUS berupa JSON array valid tanpa teks tambahan, markdown, atau penjelasan. Balas HANYA dengan JSON object yang memiliki key "questions" berisi array soal.\n\n${prompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Gemini API error: ${response.status}`;
        
        // Classify error type
        const isPermanent = response.status === 400 || response.status === 401 || response.status === 403 || response.status === 429;
        
        return {
          success: false,
          errorMessage,
          isPermanentError: isPermanent,
        };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        return {
          success: false,
          errorMessage: 'Gemini returned empty content',
          isPermanentError: false,
        };
      }

      // Parse JSON response
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

      // Extract usage from Gemini response
      const usage = data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined;

      return {
        success: true,
        questions: parsed.questions,
        usage,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `Gemini provider error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }
}