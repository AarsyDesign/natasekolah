import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import type { TenantContext } from "../src/lib/tenant/context";
import { createSubjectInputSchema } from "../src/lib/validation/teaching";
import { ValidationError } from "../src/lib/validation";
import {
  friendlyAIGenerationError,
  isAIGenerationEnabled,
  createAIGenerationJob,
  selectQuestionsForReview,
} from "../src/lib/ai-generation/ai-generation-service";
import { aiQuestionId } from "../src/lib/ai-generation/types";
import type { AIGeneratedQuestion } from "../src/lib/ai-generation/types";
import {
  checkAIGenerationQuota,
  normalizeUsageDate,
} from "../src/lib/ai-generation/usage-service";
import { AI_GENERATION_DAILY_LIMIT } from "../src/lib/ai-generation/types";

// ---------------------------------------------------------------------------
// Fixture TenantContext
// ---------------------------------------------------------------------------
const instId = "inst-qa-ai";
const userId = "user-qa-ai";
const ctx: TenantContext = {
  userId,
  institutionId: instId,
  roles: ["TEACHER"],
  permissions: ["exam:manage"],
  isSuperAdmin: false,
};

// ---------------------------------------------------------------------------
// 1. Validasi subject: field opsional boleh null / "" (temuan QA E2E 9.0)
// ---------------------------------------------------------------------------
describe("QA 9.0 — skema subject toleran null/kosong", () => {
  it("menerima code & shortName null (field tak disentuh)", () => {
    const r = createSubjectInputSchema.safeParse({
      name: "Matematika QA",
      code: null,
      shortName: null,
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.code, undefined);
      assert.equal(r.data.shortName, undefined);
    }
  });

  it("menerima code & shortName string kosong", () => {
    const r = createSubjectInputSchema.safeParse({
      name: "Matematika QA",
      code: "",
      shortName: "",
    });
    assert.equal(r.success, true);
  });

  it("tetap menolak nama < 2 karakter", () => {
    const r = createSubjectInputSchema.safeParse({ name: "M" });
    assert.equal(r.success, false);
  });

  it("mengubah kode menjadi huruf besar", () => {
    const r = createSubjectInputSchema.safeParse({
      name: "Matematika",
      code: "mtk",
      shortName: "mtk",
    });
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.code, "MTK");
  });
});

// ---------------------------------------------------------------------------
// 2. Pesan error ramah (temuan QA E2E 9.0: "fetch failed" tampil mentah)
// ---------------------------------------------------------------------------
describe("QA 9.0 — friendlyAIGenerationError", () => {
  it("menerjemahkan 'fetch failed' jadi pesan ramah", () => {
    const msg = friendlyAIGenerationError(new Error("fetch failed"));
    assert.match(msg, /tidak dapat dihubungi/);
    assert.doesNotMatch(msg, /fetch failed/);
  });

  it("menerjemahkan error API key belum dikonfigurasi", () => {
    const msg = friendlyAIGenerationError(
      new Error("OpenAI API key not configured.")
    );
    assert.match(msg, /Kunci API AI/);
  });

  it("meneruskan ValidationError (sudah Bahasa Indonesia)", () => {
    const msg = friendlyAIGenerationError(
      new ValidationError("Generate AI diblokir: Limit harian 30 tercapai")
    );
    assert.equal(msg, "Generate AI diblokir: Limit harian 30 tercapai");
  });

  it("fallback pesan umum untuk error tak dikenal", () => {
    assert.match(friendlyAIGenerationError(new Error("boom")), /gagal dijalankan/);
  });
});

// ---------------------------------------------------------------------------
// 3. Feature flag AI_GENERATION_ENABLED (sebelumnya terdokumentasi tapi mati)
// ---------------------------------------------------------------------------
describe("QA 9.0 — feature flag AI_GENERATION_ENABLED", () => {
  const original = process.env.AI_GENERATION_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.AI_GENERATION_ENABLED;
    else process.env.AI_GENERATION_ENABLED = original;
  });

  it("default nonaktif", () => {
    delete process.env.AI_GENERATION_ENABLED;
    assert.equal(isAIGenerationEnabled(), false);
  });

  it("aktif hanya saat 'true'", () => {
    process.env.AI_GENERATION_ENABLED = "TRUE";
    assert.equal(isAIGenerationEnabled(), true);
    process.env.AI_GENERATION_ENABLED = "false";
    assert.equal(isAIGenerationEnabled(), false);
  });

  it("createAIGenerationJob ditolak saat flag nonaktif", async () => {
    delete process.env.AI_GENERATION_ENABLED;
    const origInst = (prisma.institution as any).findUnique;
    const origUsage = (prisma.aiGenerationUsage as any).findUnique;
    (prisma.institution as any).findUnique = async () => ({
      id: instId,
      enabledPlugins: JSON.stringify(["AI_GENERATION"]),
    });
    (prisma.aiGenerationUsage as any).findUnique = async () => null;
    try {
      await assert.rejects(
        () =>
          createAIGenerationJob(ctx, {
            subjectId: "subj-1",
            provider: "local",
            model: "llama3.1",
            prompt: "{}",
          } as any),
        (err: unknown) =>
          err instanceof ValidationError &&
          /dinonaktifkan di server/.test(err.message)
      );
    } finally {
      (prisma.institution as any).findUnique = origInst;
      (prisma.aiGenerationUsage as any).findUnique = origUsage;
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Fair-use guard: kuota 30/hari + cooldown 15 detik
// ---------------------------------------------------------------------------
describe("QA 9.0 — guard kuota & cooldown", () => {
  const origFindUnique = (prisma.aiGenerationUsage as any).findUnique;

  beforeEach(() => {
    (prisma.aiGenerationUsage as any).findUnique = async () => null;
  });

  afterEach(() => {
    (prisma.aiGenerationUsage as any).findUnique = origFindUnique;
  });

  it("normalizeUsageDate = tengah malam UTC", () => {
    const d = normalizeUsageDate(new Date("2026-10-02T15:30:00.000Z"));
    assert.equal(d.toISOString(), "2026-10-02T00:00:00.000Z");
  });

  it("allowed saat belum ada pemakaian", async () => {
    const r = await checkAIGenerationQuota(ctx, userId);
    assert.equal(r.allowed, true);
    assert.equal(r.currentCount, 0);
    assert.equal(r.limit, AI_GENERATION_DAILY_LIMIT);
  });

  it("diblokir saat limit harian tercapai", async () => {
    (prisma.aiGenerationUsage as any).findUnique = async () => ({
      count: AI_GENERATION_DAILY_LIMIT,
      lastGeneratedAt: new Date(Date.now() - 60_000),
    });
    const r = await checkAIGenerationQuota(ctx, userId);
    assert.equal(r.allowed, false);
    assert.equal(r.currentCount, AI_GENERATION_DAILY_LIMIT);
    assert.equal(r.cooldownRemaining, undefined);
    assert.ok(r.nextAvailableAt);
  });

  it("diblokir saat cooldown < 15 detik dan melaporkan sisa detik", async () => {
    (prisma.aiGenerationUsage as any).findUnique = async () => ({
      count: 1,
      lastGeneratedAt: new Date(Date.now() - 5_000),
    });
    const r = await checkAIGenerationQuota(ctx, userId);
    assert.equal(r.allowed, false);
    assert.ok((r.cooldownRemaining ?? 0) > 0);
    assert.ok((r.cooldownRemaining ?? 0) <= 15);
  });
});

// ---------------------------------------------------------------------------
// 5. Seleksi review berbasis index (temuan QA E2E 9.0: ID tabrakan naskah)
// ---------------------------------------------------------------------------
describe("QA 9.0 — seleksi review generate (index-based)", () => {
  // Semua soal disengaja punya 20 karakter naskah pertama IDENTIK — skema lama
  // `${type}-${stem.substring(0,20)}` membuatnya jadi satu id yang sama.
  const questions: AIGeneratedQuestion[] = Array.from({ length: 5 }, (_, i) => ({
    type: "MULTIPLE_CHOICE" as const,
    difficulty: "MEDIUM" as const,
    topic: "Aljabar dasar",
    stem: `Soal QA E2E 9.0 butir ${i + 1}: hasil dari 2 + 3 x 4 adalah ...`,
    explanation: "pembahasan",
    options: [
      { label: "A", content: "14", isCorrect: true },
      { label: "B", content: "20", isCorrect: false },
      { label: "C", content: "12", isCorrect: false },
      { label: "D", content: "24", isCorrect: false },
    ],
  }));

  it("id unik per index meski naskah identik di 20 karakter pertama", () => {
    const ids = questions.map((_, i) => aiQuestionId(i));
    assert.equal(new Set(ids).size, questions.length);
  });

  it("tanpa selectedQuestionIds → semua soal (kompatibel caller lama)", () => {
    assert.equal(selectQuestionsForReview(questions).length, 5);
    assert.equal(selectQuestionsForReview(questions, null).length, 5);
  });

  it("seleksi parsial 3/5 tersimpan tepat 3 walau naskah kembar", () => {
    const picked = selectQuestionsForReview(questions, ["q0", "q2", "q4"]);
    assert.equal(picked.length, 3);
    assert.equal(picked[0].stem.includes("butir 1"), true);
    assert.equal(picked[1].stem.includes("butir 3"), true);
    assert.equal(picked[2].stem.includes("butir 5"), true);
  });

  it("seleksi kosong → 0 soal (review menolak, bukan simpan semua)", () => {
    assert.equal(selectQuestionsForReview(questions, []).length, 0);
  });
});
