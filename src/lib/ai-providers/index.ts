/**
 * AI Provider Interface & Factory
 * Phase 8 — AI & Automation
 * Pattern: WhatsApp-style provider abstraction
 */

import { AIProvider, AIGenerationPromptParams, AIGenerationJobResult, AIGeneratedQuestion } from '@/lib/ai-generation/types';

export interface AIProviderAdapter {
  readonly provider: AIProvider;
  readonly name: string;
  
  /**
   * Generate questions from prompt
   * Must return structured JSON matching AIGenerationJobResult
   */
  generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult>;
  
  /**
   * Validate provider configuration
   */
  validateConfig(): { valid: boolean; error?: string };
  
  /**
   * Get model info for logging/debugging
   */
  getModelInfo(): { model: string; provider: AIProvider };
}

/**
 * Factory function — returns provider instance based on env config
 * Similar to getWhatsAppProvider() pattern
 */
export function getAIProvider(): AIProviderAdapter {
  const provider = process.env.AI_PROVIDER as AIProvider || 'local';
  const model = process.env.AI_MODEL || 'default';
  const apiKey = process.env.AI_API_KEY;
  
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(model, apiKey);
    case 'anthropic':
      return new AnthropicProvider(model, apiKey);
    case 'gemini':
      return new GeminiProvider(model, apiKey);
    case 'local':
    default:
      return new LocalProvider(model, apiKey);
  }
}

/**
 * Base class with common functionality
 */
abstract class BaseAIProvider implements AIProviderAdapter {
  abstract readonly provider: AIProvider;
  abstract readonly name: string;
  
  constructor(
    protected readonly model: string,
    protected readonly apiKey: string | undefined
  ) {}
  
  abstract generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult>;
  
  validateConfig(): { valid: boolean; error?: string } {
    if (!this.apiKey && this.provider !== 'local') {
      return { valid: false, error: `${this.name} requires API key` };
    }
    return { valid: true };
  }
  
  getModelInfo() {
    return { model: this.model, provider: this.provider };
  }
  
  /**
   * Build standardized prompt for all providers
   */
  protected buildPrompt(params: AIGenerationPromptParams): string {
    const typeLabels = {
      MULTIPLE_CHOICE: 'Multiple Choice (4 options A-D, exactly 1 correct)',
      SHORT_ANSWER: 'Short Answer (text key, no options)',
      ESSAY: 'Essay (scoring rubric, no options)',
    };

    const difficultyLabels = {
      EASY: 'Easy',
      MEDIUM: 'Medium',
      HARD: 'Hard',
    };

    let prompt = `Generate ${params.count} ${typeLabels[params.type]} questions `;
    prompt += `at ${difficultyLabels[params.difficulty]} level `;
    prompt += `for subject ID ${params.subjectId}.`;
    
    if (params.topic) {
      prompt += ` Topic: ${params.topic}.`;
    }

    if (params.type === 'MULTIPLE_CHOICE') {
      prompt += ` Each question MUST have exactly 4 options (A, B, C, D) and exactly 1 correct answer.`;
    } else if (params.type === 'SHORT_ANSWER') {
      prompt += ` Each question MUST have a text answer key (shortAnswerKey) with no options.`;
    } else {
      prompt += ` Each question MUST have a scoring rubric/explanation with no options.`;
    }

    prompt += ` Output MUST be a valid JSON array with structure:
[
  {
    "type": "${params.type}",
    "difficulty": "${params.difficulty}",
    "topic": "question topic",
    "stem": "complete question text",
    "explanation": "explanation or scoring rubric",
    "shortAnswerKey": "answer key (only for SHORT_ANSWER)",
    "options": [
      {"label": "A", "content": "option A", "isCorrect": true},
      {"label": "B", "content": "option B", "isCorrect": false},
      {"label": "C", "content": "option C", "isCorrect": false},
      {"label": "D", "content": "option D", "isCorrect": false}
    ]
  }
]`;

    if (params.additionalInstructions) {
      prompt += `\nAdditional instructions: ${params.additionalInstructions}`;
    }

    prompt += `\nONLY output the JSON array, no additional text, markdown, or explanation.`;

    return prompt;
  }
  
  /**
   * Parse and validate AI response
   */
  protected parseResponse(rawResponse: string, expectedCount: number): AIGeneratedQuestion[] {
    let parsed: unknown;
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      const jsonMatch = rawResponse.match(/```(?:json)?\n([\s\S]*?)\n```/) || 
                        rawResponse.match(/(\[[\s\S]*\])/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : rawResponse;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
    
    if (!Array.isArray(parsed)) {
      throw new Error('AI response is not an array');
    }
    
    if (parsed.length === 0) {
      throw new Error('AI returned empty question array');
    }
    
    if (parsed.length > expectedCount) {
      throw new Error(`AI returned ${parsed.length} questions, expected max ${expectedCount}`);
    }
    
    return parsed as AIGeneratedQuestion[];
  }
}

/**
 * OpenAI Provider (GPT-4o, GPT-4o-mini, etc.)
 * Uses function calling / structured outputs for reliable JSON
 */
class OpenAIProvider extends BaseAIProvider {
  readonly provider = 'openai' as const;
  readonly name = 'OpenAI';
  
  async generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult> {
    const config = this.validateConfig();
    if (!config.valid) throw new Error(config.error);
    
    const prompt = this.buildPrompt(params);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert educational content generator. Output only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }
    
    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '[]';
    const questions = this.parseResponse(rawContent, params.count);
    
    return {
      questions,
      provider: this.provider,
      model: this.model,
      generatedAt: new Date(),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}

/**
 * Anthropic Provider (Claude 3.5 Sonnet, Haiku, Opus)
 * Uses JSON mode / tool use for structured output
 */
class AnthropicProvider extends BaseAIProvider {
  readonly provider = 'anthropic' as const;
  readonly name = 'Anthropic';
  
  async generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult> {
    const config = this.validateConfig();
    if (!config.valid) throw new Error(config.error);
    
    const prompt = this.buildPrompt(params);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3,
        system: 'You are an expert educational content generator. Output only valid JSON arrays.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }
    
    const data = await response.json();
    const rawContent = data.content[0]?.text || '[]';
    const questions = this.parseResponse(rawContent, params.count);
    
    return {
      questions,
      provider: this.provider,
      model: this.model,
      generatedAt: new Date(),
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }
}

/**
 * Google Gemini Provider (Gemini 1.5 Pro, Flash)
 * Uses JSON mode for structured output
 */
class GeminiProvider extends BaseAIProvider {
  readonly provider = 'gemini' as const;
  readonly name = 'Google Gemini';
  
  async generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult> {
    const config = this.validateConfig();
    if (!config.valid) throw new Error(config.error);
    
    const prompt = this.buildPrompt(params);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${error}`);
    }
    
    const data = await response.json();
    const rawContent = data.candidates[0]?.content?.parts[0]?.text || '[]';
    const questions = this.parseResponse(rawContent, params.count);
    
    return {
      questions,
      provider: this.provider,
      model: this.model,
      generatedAt: new Date(),
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}

/**
 * Local Provider (Ollama, vLLM, LM Studio compatible)
 * OpenAI-compatible endpoint
 */
class LocalProvider extends BaseAIProvider {
  readonly provider = 'local' as const;
  readonly name = 'Local (Ollama/vLLM)';
  
  private get baseUrl(): string {
    return process.env.AI_LOCAL_BASE_URL || 'http://localhost:11434';
  }
  
  async generate(params: AIGenerationPromptParams): Promise<AIGenerationJobResult> {
    const prompt = this.buildPrompt(params);
    
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert educational content generator. Output only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local provider error: ${response.status} ${error}`);
    }
    
    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '[]';
    const questions = this.parseResponse(rawContent, params.count);
    
    return {
      questions,
      provider: this.provider,
      model: this.model,
      generatedAt: new Date(),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}

// Export for testing
export { BaseAIProvider, OpenAIProvider, AnthropicProvider, GeminiProvider, LocalProvider };