/**
 * AI Generation Service
 * Phase 7 Trek C - AI Question Generator with Fair-use Guard
 * Phase 8 - Integrated with real AI providers
 * Alur: Draft → Teacher Review → Save (AI tidak langsung publish)
 */

import { prisma } from '@/lib/prisma';
import { TenantContext } from '@/lib/tenant/context';
import { requirePermission } from '@/lib/auth/permissions';
import { requirePlugin } from '@/lib/plugins/guard';
import {
  CreateAIGenerationJobInput,
  AIGenerationJobResult,
  AIGeneratedQuestion,
  AI_PROVIDERS,
  AIProvider,
  AIGenerationJobStatus,
  AIGenerationPromptParams,
  GenerateQuestionsActionInput,
  ReviewAIGenerationJobInput,
} from './types';
import { checkAIGenerationQuota, recordAIGenerationUsage } from './usage-service';
import { ValidationError } from '@/lib/validation';
import { getAIProvider } from '@/lib/ai-providers';

/**
 * Build prompt untuk AI provider
 */
export function buildAIPrompt(params: AIGenerationPromptParams): string {
  const typeLabels = {
    MULTIPLE_CHOICE: 'Pilihan Ganda (4 opsi A-D, tepat 1 kunci)',
    SHORT_ANSWER: 'Jawaban Singkat (kunci teks, tanpa opsi)',
    ESSAY: 'Essay (pedoman penskoran, tanpa opsi)',
  };

  const difficultyLabels = {
    EASY: 'Mudah',
    MEDIUM: 'Sedang',
    HARD: 'Sulit',
  };

  let prompt = `Buat ${params.count} soal ${typeLabels[params.type]} `;
  prompt += `tingkat ${difficultyLabels[params.difficulty]} `;
  prompt += `untuk mata pelajaran dengan ID ${params.subjectId}.`;
  
  if (params.topic) {
    prompt += ` Topik: ${params.topic}.`;
  }

  if (params.type === 'MULTIPLE_CHOICE') {
    prompt += ` Setiap soal HARUS memiliki tepat 4 opsi (A, B, C, D) dan tepat 1 kunci jawaban benar.`;
  } else if (params.type === 'SHORT_ANSWER') {
    prompt += ` Setiap soal HARUS memiliki kunci jawaban teks (shortAnswerKey) tanpa opsi.`;
  } else {
    prompt += ` Setiap soal HARUS memiliki pedoman penskoran/eksplanasi tanpa opsi.`;
  }

  prompt += ` Format output HARUS berupa JSON array valid dengan struktur:
[
  {
    "type": "${params.type}",
    "difficulty": "${params.difficulty}",
    "topic": "topik soal",
    "stem": "naskah soal lengkap",
    "explanation": "pembahasan atau pedoman penskoran",
    "shortAnswerKey": "kunci jawaban (hanya untuk SHORT_ANSWER)",
    "options": [
      {"label": "A", "content": "opsi A", "isCorrect": true},
      {"label": "B", "content": "opsi B", "isCorrect": false},
      {"label": "C", "content": "opsi C", "isCorrect": false},
      {"label": "D", "content": "opsi D", "isCorrect": false}
    ]
  }
]`;

  if (params.additionalInstructions) {
    prompt += `\nInstruksi tambahan: ${params.additionalInstructions}`;
  }

  prompt += `\nHANYA output JSON array, tanpa teks tambahan, markdown, atau penjelasan.`;

  return prompt;
}

/**
 * Call AI provider using the provider factory
 */
export async function callAIProvider(
  provider: AIProvider,
  model: string,
  prompt: string,
  params: AIGenerationPromptParams
): Promise<AIGenerationJobResult> {
  const aiProvider = getAIProvider();
  
  // Override model if needed (provider uses env var by default)
  // For now, we pass params directly which includes all needed info
  const result = await aiProvider.generate(params);
  
  return {
    questions: result.questions,
    provider,
    model,
    generatedAt: new Date(),
    usage: result.usage,
  };
}

/**
 * Validasi hasil AI sebelum masuk ke review
 */
export function validateAIResult(result: AIGenerationJobResult, expectedCount: number): void {
  if (!result.questions || result.questions.length === 0) {
    throw new ValidationError('AI tidak mengembalikan soal apapun');
  }

  if (result.questions.length > expectedCount) {
    throw new ValidationError(`AI mengembalikan ${result.questions.length} soal, diharapkan maksimal ${expectedCount}`);
  }

  for (const q of result.questions) {
    if (!q.stem || q.stem.trim().length < 5) {
      throw new ValidationError('Naskah soal terlalu pendek atau kosong');
    }

    if (q.type === 'MULTIPLE_CHOICE') {
      if (!q.options || q.options.length !== 4) {
        throw new ValidationError('Soal pilihan ganda harus memiliki tepat 4 opsi');
      }
      const correctCount = q.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new ValidationError('Soal pilihan ganda harus memiliki tepat 1 kunci jawaban');
      }
      const labels = q.options.map(o => o.label).sort();
      if (labels.join(',') !== 'A,B,C,D') {
        throw new ValidationError('Label opsi harus A, B, C, D');
      }
    } else if (q.type === 'SHORT_ANSWER') {
      if (!q.shortAnswerKey || q.shortAnswerKey.trim().length === 0) {
        throw new ValidationError('Soal jawaban singkat harus memiliki kunci jawaban');
      }
      if (q.options && q.options.length > 0) {
        throw new ValidationError('Soal jawaban singkat tidak boleh memiliki opsi');
      }
    } else if (q.type === 'ESSAY') {
      if (q.options && q.options.length > 0) {
        throw new ValidationError('Soal essay tidak boleh memiliki opsi');
      }
      // Pedoman penskoran wajib — konsisten dengan kontrak prompt & invariant
      // Question Bank (rubrik essay hidup di kolom explanation).
      if (!q.explanation || q.explanation.trim().length === 0) {
        throw new ValidationError('Soal essay harus memiliki pedoman penskoran (explanation)');
      }
    }
  }
}

/**
 * Buat job generate AI (status DRAFT)
 */
export async function createAIGenerationJob(
  ctx: TenantContext,
  input: CreateAIGenerationJobInput
): Promise<{ id: string }> {
  // Guard: permission + plugin
  requirePermission(ctx, 'exam:manage');
  // requirePlugin butuh baris institusi (objek enabledPlugins) — mengirim
  // ctx.institutionId (string UUID) membuat guard selalu gagal 403 (temuan QA E2E 8.5).
  const institution = await prisma.institution.findUnique({
    where: { id: ctx.institutionId },
    select: { enabledPlugins: true },
  });
  if (!institution) {
    throw new ValidationError('Lembaga tidak ditemukan untuk guard plugin AI Generator.');
  }
  requirePlugin(institution, 'AI_GENERATION');

  // Guard: quota check
  const quota = await checkAIGenerationQuota(ctx, ctx.userId);
  if (!quota.allowed) {
    const reason = quota.cooldownRemaining
      ? `Cooldown ${quota.cooldownRemaining} detik`
      : `Limit harian ${quota.limit} tercapai`;
    throw new ValidationError(`Generate AI diblokir: ${reason}`);
  }

  // Provider/model yang TERCATAT harus mencerminkan runtime (env server),
  // bukan nilai yang dikirim klien — getAIProvider() membaca AI_PROVIDER env,
  // jadi input.provider dari UI hanya metadata yang bisa menyesatkan (temuan QA 8.5).
  const envProvider = process.env.AI_PROVIDER as AIProvider | undefined;
  const provider: AIProvider =
    envProvider && (AI_PROVIDERS as readonly string[]).includes(envProvider) ? envProvider : input.provider;
  const model = process.env.AI_MODEL?.trim() || input.model;

  // Create job
  const job = await prisma.aiGenerationJob.create({
    data: {
      institutionId: ctx.institutionId,
      userId: ctx.userId,
      subjectId: input.subjectId,
      prompt: input.prompt,
      provider,
      model,
      status: 'DRAFT',
      // Store promptParams as JSON in a separate field or include in prompt
    },
  });

  return { id: job.id };
}

/**
 * Eksekusi generate (panggil AI, simpan hasil, set status READY_FOR_REVIEW)
 */
export async function executeAIGeneration(
  ctx: TenantContext,
  jobId: string
): Promise<AIGenerationJobResult> {
  // Get job
  const job = await prisma.aiGenerationJob.findFirst({
    where: { id: jobId, institutionId: ctx.institutionId },
  });

  if (!job) {
    throw new ValidationError('Job generate tidak ditemukan');
  }

  if (job.status !== 'DRAFT') {
    throw new ValidationError(`Job sudah diproses (status: ${job.status})`);
  }

  // Check quota again
  const quota = await checkAIGenerationQuota(ctx, ctx.userId);
  if (!quota.allowed) {
    throw new ValidationError('Kuota generate habis atau cooldown aktif');
  }

  try {
    // Call AI provider
    // Parse promptParams from the stored prompt JSON
    let promptParams: AIGenerationPromptParams;
    try {
      promptParams = JSON.parse(job.prompt);
    } catch {
      // Fallback if prompt is not JSON
      promptParams = {
        subjectId: job.subjectId,
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MEDIUM',
        count: 3,
      };
    }
    
    const result = await callAIProvider(job.provider as AIProvider, job.model, job.prompt, promptParams);

    // Validate
    const expectedCount = JSON.parse(job.prompt).count ?? 3; // parse from promptParams or estimate
    validateAIResult(result, expectedCount);

    // Update job with result
    await prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'READY_FOR_REVIEW',
        resultJson: JSON.stringify(result),
      },
    });

    // Record usage
    await recordAIGenerationUsage(ctx, ctx.userId);

    return result;
  } catch (error) {
    // Update job with error
    await prisma.aiGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

/**
 * Review job oleh guru (save atau discard)
 */
export async function reviewAIGenerationJob(
  ctx: TenantContext,
  input: ReviewAIGenerationJobInput
): Promise<{ saved: number }> {
  const job = await prisma.aiGenerationJob.findFirst({
    where: { id: input.jobId, institutionId: ctx.institutionId },
  });

  if (!job) {
    throw new ValidationError('Job generate tidak ditemukan');
  }

  if (job.status !== 'READY_FOR_REVIEW') {
    throw new ValidationError(`Job tidak siap review (status: ${job.status})`);
  }

  if (input.action === 'discard') {
    await prisma.aiGenerationJob.update({
      where: { id: input.jobId },
      data: { status: 'DISCARDED', reviewedAt: new Date() },
    });
    return { saved: 0 };
  }

  // Parse result
  const result: AIGenerationJobResult = JSON.parse(job.resultJson || '{"questions":[]}');
  let questionsToSave = result.questions;

  // If partial selection
  if (input.selectedQuestionIds && input.selectedQuestionIds.length > 0) {
    questionsToSave = result.questions.filter(q => 
      input.selectedQuestionIds!.includes(`${q.type}-${q.stem.substring(0, 20)}`)
    );
  }

  if (questionsToSave.length === 0) {
    throw new ValidationError('Tidak ada soal yang dipilih untuk disimpan');
  }

  // Save questions to Question Bank
  const savedQuestions = [];
  for (const q of questionsToSave) {
    const payload = {
      subjectId: job.subjectId,
      type: q.type,
      difficulty: q.difficulty,
      topic: q.topic,
      stem: q.stem,
      explanation: q.explanation,
      shortAnswerKey: q.shortAnswerKey,
      options: q.options?.map(o => ({
        label: o.label,
        content: o.content,
        isCorrect: o.isCorrect,
      })) ?? [],
      status: 'DRAFT' as const,
    };

    // Use question service to create
    const { createQuestion } = await import('@/lib/question-bank');
    const created = await createQuestion(ctx, payload);
    savedQuestions.push(created);
  }

  // Update job
  await prisma.aiGenerationJob.update({
    where: { id: input.jobId },
    data: {
      status: 'SAVED',
      reviewedAt: new Date(),
      savedAt: new Date(),
    },
  });

  return { saved: savedQuestions.length };
}

/**
 * List AI generation jobs untuk guru
 */
export async function listAIGenerationJobs(
  ctx: TenantContext,
  filters?: { status?: AIGenerationJobStatus; subjectId?: string }
): Promise<Array<{
  id: string;
  subjectId: string;
  provider: string;
  model: string;
  status: AIGenerationJobStatus;
  createdAt: Date;
  reviewedAt?: Date;
  savedAt?: Date;
  errorMessage?: string;
}>> {
  requirePermission(ctx, 'exam:view');

  const where: any = { institutionId: ctx.institutionId, userId: ctx.userId };
  if (filters?.status) where.status = filters.status;
  if (filters?.subjectId) where.subjectId = filters.subjectId;

  const jobs = await prisma.aiGenerationJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      subjectId: true,
      provider: true,
      model: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      savedAt: true,
      errorMessage: true,
    },
  });

  return jobs.map((j: {
    id: string;
    subjectId: string;
    provider: string;
    model: string;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    savedAt: Date | null;
    errorMessage: string | null;
  }) => ({
    id: j.id,
    subjectId: j.subjectId,
    provider: j.provider,
    model: j.model,
    status: j.status as AIGenerationJobStatus,
    createdAt: j.createdAt,
    reviewedAt: j.reviewedAt ?? undefined,
    savedAt: j.savedAt ?? undefined,
    errorMessage: j.errorMessage ?? undefined,
  }));
}

/**
 * Get job detail dengan hasil AI
 */
export async function getAIGenerationJobDetail(
  ctx: TenantContext,
  jobId: string
): Promise<{
  id: string;
  subjectId: string;
  prompt: string;
  provider: string;
  model: string;
  status: AIGenerationJobStatus;
  result?: AIGenerationJobResult;
  errorMessage?: string;
  createdAt: Date;
  reviewedAt?: Date;
  savedAt?: Date;
} | null> {
  const job = await prisma.aiGenerationJob.findFirst({
    where: { id: jobId, institutionId: ctx.institutionId, userId: ctx.userId },
  });

  if (!job) return null;

  return {
    id: job.id,
    subjectId: job.subjectId,
    prompt: job.prompt,
    provider: job.provider,
    model: job.model,
    status: job.status as AIGenerationJobStatus,
    result: job.resultJson ? JSON.parse(job.resultJson) : undefined,
    errorMessage: job.errorMessage ?? undefined,
    createdAt: job.createdAt,
    reviewedAt: job.reviewedAt ?? undefined,
    savedAt: job.savedAt ?? undefined,
  };
}
