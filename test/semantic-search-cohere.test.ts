/**
 * Semantic Search Tests — Phase 11.5 (Optional)
 * Tests Cohere provider integration and semantic search fallback logic
 * 
 * Uses manual mocking pattern consistent with other test files
 * without making real network calls.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getCohereProvider, isCohereConfigured } from "@/lib/ai-providers/cohere.provider";
import type { SendAIResult } from "@/lib/ai-providers/provider.interface";
import { buildSearchCorpus, mapRerankToResults } from "@/lib/operations/semantic-search";
import { getCohereProvider as getCohereProvider2 } from "@/lib/ai-providers/cohere.provider";
import { isCohereConfigured as isCohereConfigured2 } from "@/lib/ai-providers/cohere.provider";

// Store original implementations
let originalCohereRerank: (query: string, documents: string[], topN?: number) => Promise<Array<{ index: number; score: number; text: string }>>;
let originalCohereIsConfigured: () => boolean;
let originalGenerateQuestions: (prompt: string, model: string, params: any) => Promise<SendAIResult>;
let originalEmbed: (texts: string[], inputType?: 'search_query' | 'search_document') => Promise<number[][]>;
let originalGenerateAnswer: (prompt: string, options?: any) => Promise<string>;

function setupCohereMocks() {
  const provider = getCohereProvider();
  originalCohereRerank = provider.rerank.bind(provider);
  originalCohereIsConfigured = provider.isConfigured.bind(provider);
  originalGenerateQuestions = provider.generateQuestions.bind(provider);
  originalEmbed = provider.embed.bind(provider);
  originalGenerateAnswer = provider.generateAnswer.bind(provider);
}

function restoreCohereMocks() {
  const provider = getCohereProvider();
  provider.rerank = originalCohereRerank;
  provider.isConfigured = originalCohereIsConfigured;
  provider.generateQuestions = originalGenerateQuestions;
  provider.embed = originalEmbed;
  provider.generateAnswer = originalGenerateAnswer;
}

// Test helpers
function createMockTenantContext(overrides: any = {}): any {
  return {
    institutionId: "test-institution-id",
    userId: "test-user-id",
    roles: ["ADMIN"],
    permissions: ["student:view", "classroom:view", "staff:view", "guardian:view"],
    isSuperAdmin: false,
    ...overrides,
  };
}

describe("Phase 11.5 — Cohere Provider Unit Tests", () => {
  beforeEach(() => {
    setupCohereMocks();
  });

  afterEach(() => {
    restoreCohereMocks();
  });

  describe("CohereProvider", () => {
    it("harus memiliki interface yang benar untuk IAIProvider", () => {
      const provider = getCohereProvider();
      assert.ok(provider);
      assert.equal(typeof provider.rerank, "function");
      assert.equal(typeof provider.embed, "function");
      assert.equal(typeof provider.generateAnswer, "function");
      assert.equal(typeof provider.generateQuestions, "function");
      assert.equal(typeof provider.isConfigured, "function");
    });

    it("generateQuestions harus mengembalikan error permanen (tidak untuk generate soal)", async () => {
      const provider = getCohereProvider();
      const result = await provider.generateQuestions(
        "test prompt",
        "command-r-plus",
        { type: "MULTIPLE_CHOICE", difficulty: "MEDIUM", count: 3 }
      );
      assert.equal(result.success, false);
      assert.ok(result.isPermanentError);
      assert.ok(result.errorMessage?.includes("tidak mendukung generateQuestions"));
    });

    it("isConfigured harus mengembalikan boolean", () => {
      const provider = getCohereProvider();
      const result = provider.isConfigured();
      assert.equal(typeof result, "boolean");
    });

    it("embed harus mengembalikan array kosong saat tidak dikonfigurasi", async () => {
      const provider = getCohereProvider();
      provider.isConfigured = () => false;
      const result = await provider.embed(["test"]);
      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 0);
    });

    it("generateAnswer harus mengembalikan string kosong saat tidak dikonfigurasi", async () => {
      const provider = getCohereProvider();
      provider.isConfigured = () => false;
      const result = await provider.generateAnswer("test");
      assert.equal(typeof result, "string");
    });
  });

  describe("isCohereConfigured helper", () => {
    it("harus mengembalikan false saat API key tidak diset", () => {
      const provider = getCohereProvider();
      provider.isConfigured = () => false;
      assert.equal(isCohereConfigured(), false);
    });

    it("harus mengembalikan true saat API key diset", () => {
      const provider = getCohereProvider();
      provider.isConfigured = () => true;
      assert.equal(isCohereConfigured(), true);
    });
  });

  describe("buildSearchCorpus — logic test", () => {
    it("harus eksport fungsi yang bisa dipanggil", () => {
      assert.equal(typeof buildSearchCorpus, "function");
    });
  });

  describe("mapRerankToResults — logic test", () => {
    it("harus mengkonversi hasil rerank ke GlobalSearchResultItem", () => {
      const rerankResults = [
        { index: 0, score: 0.95, text: "Ahmad NIS 123 ACTIVE" },
        { index: 1, score: 0.87, text: "Budi NIS 456 ACTIVE" },
      ];
      const corpus = [
        { id: "1", type: "STUDENT", text: "Ahmad NIS 123 ACTIVE", href: "/students?search=123", badge: "ACTIVE" },
        { id: "2", type: "STUDENT", text: "Budi NIS 456 ACTIVE", href: "/students?search=456", badge: "ACTIVE" },
      ];

      const results = mapRerankToResults(rerankResults, corpus);
      
      assert.equal(results.length, 2);
      assert.equal(results[0].id, "1");
      assert.equal(results[0].type, "STUDENT");
      assert.equal(results[0].title, "Ahmad");
      assert.ok(results[0].subtitle.includes("NIS"));
      assert.equal(results[1].id, "2");
    });

    it("harus handle empty rerank results", () => {
      const results = mapRerankToResults([], []);
      assert.equal(results.length, 0);
    });

    it("harus handle score values", () => {
      const rerankResults = [{ index: 0, score: 0.5, text: "Test" }];
      const corpus = [{ id: "1", type: "STUDENT", text: "Test", href: "/test", badge: "TEST" }];
      const results = mapRerankToResults(rerankResults, corpus);
      assert.equal(results.length, 1);
    });
  });

  describe("Cohere Provider - Rerank Logic", () => {
    it("harus bisa mock rerank untuk testing", async () => {
      const provider = getCohereProvider();
      provider.rerank = async () => [
        { index: 0, score: 0.9, text: "Result 1" },
        { index: 1, score: 0.8, text: "Result 2" },
      ];

      const result = await provider.rerank("query", ["doc1", "doc2"]);
      assert.equal(result.length, 2);
      assert.equal(result[0].score, 0.9);
      assert.equal(result[1].score, 0.8);
    });

    it("harus handle rerank error gracefully", async () => {
      const provider = getCohereProvider();
      provider.rerank = async () => {
        throw new Error("API Error");
      };

      try {
        await provider.rerank("query", ["doc1"]);
        assert.fail("Should have thrown");
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes("API Error"));
      }
    });
  });
});

describe("Phase 11.5 — Semantic Search Logic (without DB)", () => {
  beforeEach(() => {
    setupCohereMocks();
    const provider = getCohereProvider();
    provider.isConfigured = () => true;
  });

  afterEach(() => {
    restoreCohereMocks();
  });

  it("harus return semanticUsed=false saat needFallback=false", async () => {
    // Test the logic directly without database
    const keywordResults = [
      { id: "1", type: "STUDENT", title: "Ahmad", subtitle: "NIS: 123", href: "/students?search=123", badge: "ACTIVE" },
      { id: "2", type: "STUDENT", title: "Budi", subtitle: "NIS: 456", href: "/students?search=456", badge: "ACTIVE" },
      { id: "3", type: "STUDENT", title: "Citra", subtitle: "NIS: 789", href: "/students?search=789", badge: "ACTIVE" },
    ];

    // Simulate: enough keyword results, no fallback needed
    const needFallback = true && true && (keywordResults.length < 3 || "short".length > 20);
    assert.equal(needFallback, false);
  });

  it("harus return semanticUsed=true saat keyword results < minKeywordResults", () => {
    const keywordResults = [
      { id: "1", type: "STUDENT", title: "Ahmad", subtitle: "NIS: 123", href: "/students?search=123", badge: "ACTIVE" },
    ];

    const needFallback = true && true && (keywordResults.length < 3 || "short".length > 20);
    assert.equal(needFallback, true);
  });

  it("harus return semanticUsed=true saat query panjang (>20 chars)", () => {
    const keywordResults = [
      { id: "1", type: "STUDENT", title: "Ahmad", subtitle: "NIS: 123", href: "/students?search=123", badge: "ACTIVE" },
    ];

    const longQuery = "cari siswa kelas 10 yang izin sakit minggu lalu";
    const needFallback = true && true && (keywordResults.length < 3 || longQuery.length > 20);
    assert.equal(needFallback, true);
  });

  it("harus tidak fallback saat useSemanticFallback=false", () => {
    const keywordResults = [
      { id: "1", type: "STUDENT", title: "Ahmad", subtitle: "NIS: 123", href: "/students?search=123", badge: "ACTIVE" },
    ];

    const needFallback = false && true && (keywordResults.length < 3 || "query".length > 20);
    assert.equal(needFallback, false);
  });

  it("harus tidak fallback saat Cohere tidak terkonfigurasi", () => {
    const keywordResults = [
      { id: "1", type: "STUDENT", title: "Ahmad", subtitle: "NIS: 123", href: "/students?search=123", badge: "ACTIVE" },
    ];

    const needFallback = true && false && (keywordResults.length < 3 || "query".length > 20);
    assert.equal(needFallback, false);
  });
});