"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createQuestion,
  updateQuestion,
  getQuestion,
  listQuestions,
  transitionQuestionStatus,
  archiveQuestion,
  deleteQuestion,
  getQuestionBankSummary,
  listQuestionCategories,
  listQuestionTopics,
  getQuestionDifficultyDistribution,
  generateQuestionImportPreview,
  executeQuestionImport,
  generateQuestionImportTemplateBuffer,
  exportQuestionsCSV,
} from "../lib/question-bank";

/**
 * Server Actions Bank Soal (Question Bank) — Phase 7.
 *
 * Kaidah Next.js 16: SELURUH ekspor pada file "use server" harus async
 * (ekspor sinkron = runtime 500 yang tidak tertangkap tsc/test/build).
 * Setiap action: getContext() -> service (RBAC + plugin + tenant) -> { success, data | error }.
 */

const QUESTION_BANK_ROUTE = "/exams/question-bank";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

// -------------------------------------------------------------
// QUERY ACTIONS
// -------------------------------------------------------------

export async function getQuestionsAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await listQuestions(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat daftar soal." };
  }
}

export async function getQuestionByIdAction(id: string) {
  try {
    const ctx = await getContext();
    const question = await getQuestion(ctx, id);
    return { success: true, data: question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat detail soal." };
  }
}

// -------------------------------------------------------------
// MUTATION ACTIONS
// -------------------------------------------------------------

export async function createQuestionAction(input: unknown) {
  try {
    const ctx = await getContext();
    const question = await createQuestion(ctx, input);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal membuat soal." };
  }
}

export async function updateQuestionAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const question = await updateQuestion(ctx, id, input);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memperbarui soal." };
  }
}

export async function updateQuestionStatusAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const question = await transitionQuestionStatus(ctx, id, input);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: question };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengubah status soal.",
    };
  }
}

export async function archiveQuestionAction(id: string) {
  try {
    const ctx = await getContext();
    const question = await archiveQuestion(ctx, id);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal mengarsipkan soal." };
  }
}

/** Hapus lunak: memindahkan soal ke ARSIP (tanpa hard delete). */
export async function deleteQuestionAction(id: string) {
  try {
    const ctx = await getContext();
    const question = await deleteQuestion(ctx, id);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal menghapus soal." };
  }
}

// -------------------------------------------------------------
// CATEGORY / SUMMARY ACTIONS
// -------------------------------------------------------------

export async function getQuestionBankSummaryAction() {
  try {
    const ctx = await getContext();
    const summary = await getQuestionBankSummary(ctx);
    return { success: true, data: summary };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat ringkasan bank soal." };
  }
}

export async function getQuestionCategoriesAction() {
  try {
    const ctx = await getContext();
    const categories = await listQuestionCategories(ctx);
    return { success: true, data: categories };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat kategori soal." };
  }
}

export async function getQuestionTopicsAction(subjectId?: string) {
  try {
    const ctx = await getContext();
    const topics = await listQuestionTopics(ctx, subjectId);
    return { success: true, data: topics };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat daftar topik." };
  }
}

export async function getQuestionDifficultyDistributionAction() {
  try {
    const ctx = await getContext();
    const distribution = await getQuestionDifficultyDistribution(ctx);
    return { success: true, data: distribution };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat distribusi kesulitan soal.",
    };
  }
}

// -------------------------------------------------------------
// IMPORT ACTIONS
// -------------------------------------------------------------

/** Server Action: Unggah & preview file spreadsheet soal (xlsx / csv). */
export async function previewQuestionImportAction(formData: FormData) {
  try {
    const ctx = await getContext();

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { success: false, error: "Harap pilih file spreadsheet untuk diunggah." };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Ukuran file maksimal adalah 5MB." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await generateQuestionImportPreview(ctx, buffer, file.name);
    return { success: true, data: preview };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memproses file spreadsheet soal.",
    };
  }
}

/** Server Action: Konfirmasi & eksekusi impor baris preview yang VALID. */
export async function executeQuestionImportAction(rows: unknown) {
  try {
    const ctx = await getContext();
    const result = await executeQuestionImport(ctx, rows);
    revalidatePath(QUESTION_BANK_ROUTE);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengeksekusi impor soal.",
    };
  }
}

/** Server Action: Unduh template impor soal (base64). */
export async function getQuestionImportTemplateAction() {
  try {
    const buffer = generateQuestionImportTemplateBuffer();
    return {
      success: true,
      data: {
        fileName: "Template_Import_Soal_NataSekolah.xlsx",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: buffer.toString("base64"),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membuat template impor soal.",
    };
  }
}

// -------------------------------------------------------------
// EXPORT ACTION
// -------------------------------------------------------------

/** Server Action: Ekspor CSV soal lembaga aktif (konsumen memakai downloadCSV). */
export async function exportQuestionsCsvAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await exportQuestionsCSV(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengekspor data soal.",
    };
  }
}
