"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createSubject,
  updateSubject,
  listSubjects,
  getSubject,
  listTeachers,
  getTeacher,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
  listTeacherAssignments,
  getTeacherWorkspaceSummary,
  getTeacherClassDetail,
  getTeacherStudentAcademicSummary,
} from "../lib/teaching";
import { rethrowIfSessionExpired } from "../lib/auth/action-session";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

// -------------------------------------------------------------
// SUBJECT ACTIONS
// -------------------------------------------------------------

export async function getSubjectsAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await listSubjects(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat mata pelajaran." };
  }
}

export async function getSubjectByIdAction(id: string) {
  try {
    const ctx = await getContext();
    const subject = await getSubject(ctx, id);
    return { success: true, data: subject };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat mata pelajaran." };
  }
}

export async function createSubjectAction(input: unknown) {
  try {
    const ctx = await getContext();
    const subject = await createSubject(ctx, input);
    revalidatePath("/subjects");
    revalidatePath("/teacher-assignments");
    return { success: true, data: subject };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal membuat mata pelajaran." };
  }
}

export async function updateSubjectAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const updated = await updateSubject(ctx, id, input);
    revalidatePath("/subjects");
    revalidatePath("/teacher-assignments");
    return { success: true, data: updated };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memperbarui mata pelajaran." };
  }
}

// -------------------------------------------------------------
// TEACHER ACTIONS
// -------------------------------------------------------------

export async function getTeachersAction() {
  try {
    const ctx = await getContext();
    const teachers = await listTeachers(ctx);
    return { success: true, data: teachers };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat daftar guru." };
  }
}

export async function getTeacherByIdAction(id: string) {
  try {
    const ctx = await getContext();
    const teacher = await getTeacher(ctx, id);
    return { success: true, data: teacher };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat profil guru." };
  }
}

// -------------------------------------------------------------
// TEACHER ASSIGNMENT ACTIONS
// -------------------------------------------------------------

export async function getTeacherAssignmentsAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await listTeacherAssignments(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat penugasan mengajar." };
  }
}

export async function createTeacherAssignmentAction(input: unknown) {
  try {
    const ctx = await getContext();
    const assignment = await createTeacherAssignment(ctx, input);
    revalidatePath("/teacher-assignments");
    revalidatePath("/teachers");
    return { success: true, data: assignment };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal menyimpan penugasan mengajar." };
  }
}

export async function updateTeacherAssignmentAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const updated = await updateTeacherAssignment(ctx, id, input);
    revalidatePath("/teacher-assignments");
    return { success: true, data: updated };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memperbarui penugasan mengajar." };
  }
}

export async function deleteTeacherAssignmentAction(id: string) {
  try {
    const ctx = await getContext();
    const deleted = await deleteTeacherAssignment(ctx, id);
    revalidatePath("/teacher-assignments");
    revalidatePath("/teachers");
    return { success: true, data: deleted };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal menghapus penugasan mengajar." };
  }
}

// -------------------------------------------------------------
// TEACHER WORKSPACE ACTIONS
// -------------------------------------------------------------

export async function getTeacherWorkspaceSummaryAction() {
  try {
    const ctx = await getContext();
    const data = await getTeacherWorkspaceSummary(ctx);
    return { success: true, data };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat workspace guru.",
    };
  }
}

export async function getTeacherClassDetailAction(assignmentId: string) {
  try {
    const ctx = await getContext();
    const data = await getTeacherClassDetail(ctx, assignmentId);
    return { success: true, data };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat rincian kelas penugasan.",
    };
  }
}

export async function getTeacherStudentAcademicSummaryAction(
  assignmentId: string,
  studentId: string
) {
  try {
    const ctx = await getContext();
    const data = await getTeacherStudentAcademicSummary(ctx, assignmentId, studentId);
    return { success: true, data };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat ringkasan akademik siswa.",
    };
  }
}
