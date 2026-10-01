/**
 * AI Provider Factory
 * Phase 8 - AI Question Generator Runtime
 * Mirip pola WhatsApp provider factory
 */

import { IAIProvider, SendAIResult } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { LocalProvider } from './local.provider';
import type { AIProvider } from '@/lib/ai-generation/types';

let providerCache: Map<AIProvider, IAIProvider> = new Map();

export function getAIProvider(providerType: AIProvider): IAIProvider {
  // Check cache first
  const cached = providerCache.get(providerType);
  if (cached) {
    return cached;
  }

  let provider: IAIProvider;

  switch (providerType) {
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'anthropic':
      provider = new AnthropicProvider();
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    case 'local':
      provider = new LocalProvider();
      break;
    default:
      throw new Error(`Unknown AI provider: ${providerType}`);
  }

  // Cache the provider instance
  providerCache.set(providerType, provider);
  return provider;
}

export function clearAIProviderCache(): void {
  providerCache.clear();
}

export function getAvailableProviders(): AIProvider[] {
  return ['openai', 'anthropic', 'gemini', 'local'];
}

/**
 * Validate that a provider is configured and accessible
 * Returns true if provider can be instantiated (has API key, etc.)
 */
export function isProviderConfigured(providerType: AIProvider): boolean {
  try {
    getAIProvider(providerType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get configured providers only
 */
export function getConfiguredProviders(): AIProvider[] {
  return getAvailableProviders().filter(isProviderConfigured);
}

/**
 * Call AI provider with fallback support
 * Tries primary provider, falls back to next configured provider on transient errors
 */
export async function callAIProviderWithFallback(
  primaryProvider: AIProvider,
  prompt: string,
  model: string,
  params: {
    type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    topic?: string;
    count: number;
  },
  fallbackProviders?: AIProvider[]
): Promise<SendAIResult> {
  const providersToTry = [primaryProvider, ...(fallbackProviders || getConfiguredProviders().filter(p => p !== primaryProvider))];
  
  let lastError: SendAIResult = { success: false, errorMessage: 'No providers available', isPermanentError: true };
  
  for (const providerType of providersToTry) {
    try {
      const provider = getAIProvider(providerType);
      const result = await provider.generateQuestions(prompt, model, params);
      
      if (result.success) {
        return result;
      }
      
      // If permanent error, don't try fallback
      if (result.isPermanentError) {
        return result;
      }
      
      // Transient error - try next provider
      lastError = result;
    } catch (error) {
      lastError = {
        success: false,
        errorMessage: `Provider ${providerType} error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPermanentError: false,
      };
    }
  }
  
  return lastError;
}