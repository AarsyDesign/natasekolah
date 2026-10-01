/**
 * AI Generation Usage Service
 * Phase 7 Trek C - Fair-use guard: 30 generate/hari/guru + cooldown 15 detik
 */

import { prisma } from '@/lib/prisma';
import { TenantContext } from '@/lib/tenant/context';
import {
  AIGenerationUsageCheckResult,
  AI_GENERATION_DAILY_LIMIT,
  AI_GENERATION_COOLDOWN_SECONDS,
} from './types';

/**
 * Normalisasi tanggal ke UTC midnight (Date only)
 */
export function normalizeUsageDate(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Cek kuota harian dan cooldown untuk generate soal AI
 */
export async function checkAIGenerationQuota(
  ctx: TenantContext,
  userId: string
): Promise<AIGenerationUsageCheckResult> {
  const today = normalizeUsageDate();
  
  const usage = await prisma.aiGenerationUsage.findUnique({
    where: {
      institutionId_userId_date: {
        institutionId: ctx.institutionId,
        userId,
        date: today,
      },
    },
  });

  const currentCount = usage?.count ?? 0;
  const lastGeneratedAt = usage?.lastGeneratedAt ?? null;

  // Cek cooldown
  if (lastGeneratedAt) {
    const now = new Date();
    const elapsedMs = now.getTime() - lastGeneratedAt.getTime();
    const cooldownMs = AI_GENERATION_COOLDOWN_SECONDS * 1000;
    
    if (elapsedMs < cooldownMs) {
      const remainingMs = cooldownMs - elapsedMs;
      return {
        allowed: false,
        currentCount,
        limit: AI_GENERATION_DAILY_LIMIT,
        cooldownRemaining: Math.ceil(remainingMs / 1000),
        nextAvailableAt: new Date(lastGeneratedAt.getTime() + cooldownMs),
      };
    }
  }

  // Cek daily limit
  if (currentCount >= AI_GENERATION_DAILY_LIMIT) {
    return {
      allowed: false,
      currentCount,
      limit: AI_GENERATION_DAILY_LIMIT,
      nextAvailableAt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // tomorrow midnight UTC
    };
  }

  return {
    allowed: true,
    currentCount,
    limit: AI_GENERATION_DAILY_LIMIT,
  };
}

/**
 * Increment usage counter dan update lastGeneratedAt
 */
export async function recordAIGenerationUsage(
  ctx: TenantContext,
  userId: string
): Promise<void> {
  const today = normalizeUsageDate();
  
  await prisma.aiGenerationUsage.upsert({
    where: {
      institutionId_userId_date: {
        institutionId: ctx.institutionId,
        userId,
        date: today,
      },
    },
    create: {
      institutionId: ctx.institutionId,
      userId,
      date: today,
      count: 1,
      lastGeneratedAt: new Date(),
    },
    update: {
      count: { increment: 1 },
      lastGeneratedAt: new Date(),
    },
  });
}

/**
 * Get usage stats for a user (for UI display)
 */
export async function getAIGenerationUsageStats(
  ctx: TenantContext,
  userId: string,
  days: number = 7
): Promise<Array<{ date: Date; count: number }>> {
  const startDate = normalizeUsageDate();
  startDate.setDate(startDate.getDate() - days + 1);
  
  const usage = await prisma.aiGenerationUsage.findMany({
    where: {
      institutionId: ctx.institutionId,
      userId,
      date: { gte: startDate },
    },
    orderBy: { date: 'asc' },
  });

  // Fill missing days with 0
  const result: Array<{ date: Date; count: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const found = usage.find(u => u.date.getTime() === d.getTime());
    result.push({ date: d, count: found?.count ?? 0 });
  }
  
  return result;
}
