/**
 * Local Provider (Ollama / vLLM / OpenAI-compatible endpoint)
 * Phase 8 - AI Question Generator Runtime
 */

import { IAIProvider, SendAIResult } from './provider.interface';
import type { AIGeneratedQuestion } from '@/lib/ai-generation/types';

export class LocalProvider implements IAIProvider {
  readonly id = 'local';
  readonly name = 'Local (Ollama/vLLM/OpenAI-compatible)';
  readonly supportedModels: string[] = []; // Dynamic - fetched from endpoint

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(config?: { baseUrl?: string; apiKey?: string; model?: string }) {
    this.baseUrl = config?.baseUrl || process.env.LOCAL_AI_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.apiKey = config?.apiKey || process.env.LOCAL_AI_API_KEY || process.env.AI_API_KEY || '';
    this.defaultModel = config?.model || process.env.LOCAL_AI_MODEL || 'llama3.1';
    
    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
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
      const modelToUse = model || this.defaultModel;
      
      // Try OpenAI-compatible endpoint first (vLLM, Ollama with /v1)
      const openAiCompatibleUrl = `${this.baseUrl}/v1/chat/completions`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(openAiCompatibleUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelToUse,
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
          response_format: { type: 'json_object' },
        }),
      });

      // If OpenAI-compatible fails, try Ollama native /api/chat
      if (!response.ok && response.status === 404) {
        return this.tryOllamaNative(prompt, modelToUse, params);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Local AI API error: ${response.status}`;
        
        const isPermanent = response.status === 401 || response.status === 403;
        
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
          errorMessage: 'Local AI returned empty content',
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
      // Network error - could be connection refused
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          errorMessage: `Tidak dapat terhubung ke local AI endpoint (${this.baseUrl}). Pastikan server Ollama/vLLM berjalan.`,
          isPermanentError: true, // Config issue
        };
      }
      
      return {
        success: false,
        errorMessage: `Local provider error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }

  private async tryOllamaNative(
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
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'Anda adalah asisten pembuatan soal pendidikan Indonesia. Output HARUS berupa JSON object dengan key "questions" berisi array soal.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 4000,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Ollama API error: ${response.status}`;
        
        return {
          success: false,
          errorMessage,
          isPermanentError: response.status === 401 || response.status === 403,
        };
      }

      const data = await response.json();
      const content = data.message?.content;
      
      if (!content) {
        return {
          success: false,
          errorMessage: 'Ollama returned empty content',
          isPermanentError: false,
        };
      }

      // Parse JSON response
      let parsed: { questions: AIGeneratedQuestion[] };
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        // Try to extract JSON from text
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
        usage: data.prompt_eval_count && data.eval_count ? {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: data.prompt_eval_count + data.eval_count,
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `Ollama native error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      // Try OpenAI-compatible /v1/models
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data?.map((m: { id: string }) => m.id) || [];
      }

      // Try Ollama native /api/tags
      const ollamaResponse = await fetch(`${this.baseUrl}/api/tags`);
      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json();
        return data.models?.map((m: { name: string }) => m.name) || [];
      }

      return [];
    } catch {
      return [];
    }
  }
}