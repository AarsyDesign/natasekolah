/**
 * DKAS Bot — Planner LLM (Phase 12.7).
 *
 * Mengubah pertanyaan bahasa natural menjadi RENCANA QUERY JSON yang kemudian
 * divalidasi whitelist oleh `validatePlan` (planner.ts). Model TIDAK PERNAH
 * menghasilkan objek Prisma — hanya `{ dataset, conditions:[{field,op,value}] }`.
 *
 * Gerbang: hanya dipanggil bila `AI_GENERATION_ENABLED=true` (lihat planner.ts).
 * Bila provider tidak terkonfigurasi / gagal / timeout → melempar error yang
 * ditangkap planner untuk jatuh ke rule planner (non-blocking).
 */

import { ValidationError } from "../validation/common";
import {
  catalogForPrompt,
  DKAS_CONDITIONS_MAX,
  DKAS_LIMIT_MAX,
  DKAS_QUERY_MAX,
  DKAS_VALUE_MAX,
} from "./catalog";

/** Timeout panggilan model — cukup untuk JSON kecil, tidak menggantung. */
export const PLANNER_TIMEOUT_MS = 8_000;

export function isPlannerAIEnabled(): boolean {
  return process.env.AI_GENERATION_ENABLED?.trim().toLowerCase() === "true";
}

/** Susun prompt terstruktur berisi katalog whitelist terkini. */
export function buildPlannerPrompt(query: string): string {
  return [
    'Anda adalah planner query data sekolah (DKAS Bot). Ubah pertanyaan pengguna menjadi SATU objek JSON rencana query.',
    "",
    "Aturan keras:",
    "1. Hanya boleh memakai `dataset`, `field`, dan `op` yang ada di KATALOG di bawah.",
    "2. `op` yang valid: equals, notEquals, in, contains, gte, lte.",
    "3. `value` berupa string (maksimal " + String(DKAS_VALUE_MAX) + " karakter), angka, atau array string (untuk op in).",
    "4. Tanggal harus format YYYY-MM-DD. Jangan mengarang nilai enum di luar daftar.",
    `5. \`limit\` bilangan 1-${DKAS_LIMIT_MAX}. Maksimal ${DKAS_CONDITIONS_MAX} kondisi. \`orderBy\` salah satu kunci urut dataset (boleh dihilangkan).`,
    "6. Jangan menyertakan institusi/pengguna/tabel lain di luar katalog.",
    "",
    "Format output HANYA JSON, tanpa markdown, tanpa penjelasan:",
    '{"dataset":"...","conditions":[{"field":"...","op":"...","value":...}],"orderBy":"...","limit":20}',
    "",
    "KATALOG:",
    JSON.stringify(catalogForPrompt(), null, 0),
    "",
    `Pertanyaan pengguna: ${query.slice(0, DKAS_QUERY_MAX)}`,
  ].join("\n");
}

/** Ekstrak objek JSON pertama dari konten model (toleran terhadap pagar markdown). */
export function parsePlanContent(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ValidationError("Respons model tidak berisi objek rencana query.");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (error) {
    throw new ValidationError(
      `Respons model bukan JSON valid: ${error instanceof Error ? error.message : "parse error"}`
    );
  }
}

function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/**
 * Panggil model chat completion sederhana (OpenAI-compatible).
 * Mendukung `AI_PROVIDER=openai` dan `local` (Ollama/vLLM/OpenAI-compatible).
 * Provider lain dilempar sebagai error → jatuh ke rule planner.
 */
export async function callPlannerModel(
  prompt: string,
  timeoutMs: number = PLANNER_TIMEOUT_MS
): Promise<string> {
  const provider = (process.env.AI_PROVIDER ?? "local").trim().toLowerCase();

  if (provider !== "openai" && provider !== "local") {
    throw new Error(
      `Provider AI "${provider}" belum didukung planner DKAS (dukung: openai, local).`
    );
  }

  const baseUrl =
    provider === "openai"
      ? (process.env.AI_BASE_URL?.trim() || "https://api.openai.com")
      : (process.env.AI_LOCAL_BASE_URL?.trim() ||
        process.env.AI_BASE_URL?.trim() ||
        "http://localhost:11434");
  const apiKey = process.env.AI_API_KEY?.trim() || "";
  const model =
    process.env.AI_MODEL?.trim() || (provider === "openai" ? "gpt-4o-mini" : "llama3.1");

  if (provider === "openai" && !apiKey) {
    throw new Error("AI_API_KEY belum dikonfigurasi untuk provider openai.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(chatCompletionsUrl(baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              'Anda hanya mengembalikan JSON rencana query yang valid sesuai katalog, tanpa teks lain.',
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Planner AI HTTP ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Planner AI mengembalikan respons kosong.");
    }
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Planner AI melewati batas waktu ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jalankan planner LLM penuh: prompt → model → parse JSON mentah.
 * Validasi whitelist dilakukan pemanggil (`validatePlan`).
 */
export async function planWithLLM(query: string): Promise<unknown> {
  const content = await callPlannerModel(buildPlannerPrompt(query));
  return parsePlanContent(content);
}
