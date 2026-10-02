"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import { hasPermission } from "../lib/auth/permissions";
import {
  listExams,
  getExamDetail,
  createExam,
  addQuestions,
  setQuestionPoints,
  reorderQuestions,
  transitionExamStatus,
  archiveExam,
} from "../lib/exam-paper/exam-paper-service";

/**
 * Server Actions Exam Paper Engine (Phase 10.2, PRD #31).
 *
 * Kaidah Next.js 16: SELURUH ekspor pada file "use server" wajib async
 * (export sync = runtime 500 yang lolos tsc/test/build). Setiap blok catch
 * diawali `rethrowIfSessionExpired(...)` (sesi berakhir -> redirect login).
 *
 * Rantai otorisasi tetap di service: Session -> Tenant -> RBAC
 * (exam:view / exam:manage) -> Plugin FORMAL_ACADEMIC -> Domain Resource.
 * institutionId tidak pernah datang dari payload klien.
 */

const EXAM_LIST_ROUTE = "/exams/papers";

function examDetailRoute(examId: string): string {
  return `/exams/papers/${examId}`;
}

function defaultError(error: any, fallback: string): string {
  return error?.message || fallback;
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------

/** Daftar naskah (filter status/mapel/tipe/pencarian + pagination) + `canManage`. */
export async function listExamsAction(query?: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () => listExams(context, query));
    return {
      success: true as const,
      data: { ...data, canManage: hasPermission(context, "exam:manage") },
    };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal memuat daftar naskah ujian."),
      code: error?.code || "EXAM_LIST_ERROR",
    };
  }
}

/** Detail satu naskah termasuk komposisi soal terurut + `canManage`. */
export async function getExamDetailAction(examId: string) {
  try {
    const context = await requireActionSession();
    const exam = await runWithTenantContext(context, () => getExamDetail(context, examId));
    return {
      success: true as const,
      data: { exam, canManage: hasPermission(context, "exam:manage") },
    };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal memuat detail naskah ujian."),
      code: error?.code || "EXAM_DETAIL_ERROR",
    };
  }
}

// ---------------------------------------------------------------------------
// Tulis
// ---------------------------------------------------------------------------

/** Buat naskah baru (status DRAFT) lalu arahkan klien ke halaman detail. */
export async function createExamAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const exam = await runWithTenantContext(context, () => createExam(context, rawInput));
    revalidatePath(EXAM_LIST_ROUTE);
    return { success: true as const, data: exam };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal membuat naskah ujian."),
      code: error?.code || "EXAM_CREATE_ERROR",
    };
  }
}

/** Tarik butir soal Bank Soal ke naskah (idempoten terhadap duplikat). */
export async function addExamQuestionsAction(examId: string, rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      addQuestions(context, examId, rawInput)
    );
    revalidatePath(EXAM_LIST_ROUTE);
    revalidatePath(examDetailRoute(examId));
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal menambahkan soal ke naskah."),
      code: error?.code || "EXAM_ADD_QUESTIONS_ERROR",
    };
  }
}

/** Atur poin satu butir soal dalam naskah (1..100). */
export async function setExamQuestionPointsAction(examId: string, rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      setQuestionPoints(context, examId, rawInput)
    );
    revalidatePath(examDetailRoute(examId));
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal mengatur poin soal."),
      code: error?.code || "EXAM_SET_POINTS_ERROR",
    };
  }
}

/** Atur ulang urutan cetak — daftar wajib memuat seluruh soal naskah. */
export async function reorderExamQuestionsAction(examId: string, rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      reorderQuestions(context, examId, rawInput)
    );
    revalidatePath(examDetailRoute(examId));
    return { success: true as const, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal mengatur urutan soal."),
      code: error?.code || "EXAM_REORDER_ERROR",
    };
  }
}

/** Transisi siklus status naskah (DRAFT <-> READY -> ISSUED -> ARCHIVED). */
export async function transitionExamStatusAction(examId: string, rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const exam = await runWithTenantContext(context, () =>
      transitionExamStatus(context, examId, rawInput)
    );
    revalidatePath(EXAM_LIST_ROUTE);
    revalidatePath(examDetailRoute(examId));
    return { success: true as const, data: exam };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal mengubah status naskah."),
      code: error?.code || "EXAM_STATUS_ERROR",
    };
  }
}

/** Arsipkan naskah (soft delete — hard delete tidak pernah dilakukan). */
export async function archiveExamAction(examId: string) {
  try {
    const context = await requireActionSession();
    const exam = await runWithTenantContext(context, () => archiveExam(context, examId));
    revalidatePath(EXAM_LIST_ROUTE);
    revalidatePath(examDetailRoute(examId));
    return { success: true as const, data: exam };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false as const,
      error: defaultError(error, "Gagal mengarsipkan naskah."),
      code: error?.code || "EXAM_ARCHIVE_ERROR",
    };
  }
}
