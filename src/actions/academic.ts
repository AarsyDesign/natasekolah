"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createStudent,
  updateStudent,
  getStudent,
  listStudents,
  archiveStudent,
  createAcademicYear,
  setActiveAcademicYear,
  listAcademicYears,
  getAcademicYear,
  createClassroom,
  listClassrooms,
  getClassroom,
  enrollStudent,
  updateEnrollment,
  getStudentEnrollments,
  getCurrentEnrollment,
} from "../lib/academic";
import { rethrowIfSessionExpired } from "../lib/auth/action-session";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

// -------------------------------------------------------------
// STUDENT ACTIONS
// -------------------------------------------------------------

export async function getStudentsAction(query?: unknown) {
  try {
    const ctx = await getContext();
    const result = await listStudents(ctx, query);
    return { success: true, data: result };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat data siswa." };
  }
}

export async function getStudentByIdAction(id: string) {
  try {
    const ctx = await getContext();
    const student = await getStudent(ctx, id);
    const currentEnrollment = await getCurrentEnrollment(ctx, id);
    const history = await getStudentEnrollments(ctx, id);

    return {
      success: true,
      data: {
        student,
        currentEnrollment,
        history,
      },
    };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat profil siswa." };
  }
}

export async function createStudentAction(input: unknown) {
  try {
    const ctx = await getContext();
    const student = await createStudent(ctx, input);
    revalidatePath("/students");
    return { success: true, data: student };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal mendaftarkan siswa." };
  }
}

export async function updateStudentAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const updated = await updateStudent(ctx, id, input);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memperbarui data siswa." };
  }
}

export async function archiveStudentAction(id: string, input: unknown) {
  try {
    const ctx = await getContext();
    const archived = await archiveStudent(ctx, id, input);
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return { success: true, data: archived };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal mengarsipkan siswa." };
  }
}

// -------------------------------------------------------------
// ACADEMIC YEAR ACTIONS
// -------------------------------------------------------------

export async function getAcademicYearsAction() {
  try {
    const ctx = await getContext();
    const list = await listAcademicYears(ctx);
    return { success: true, data: list };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat tahun ajaran." };
  }
}

export async function createAcademicYearAction(input: unknown) {
  try {
    const ctx = await getContext();
    const year = await createAcademicYear(ctx, input);
    revalidatePath("/academic-years");
    revalidatePath("/classrooms");
    return { success: true, data: year };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal membuat tahun ajaran." };
  }
}

export async function setActiveAcademicYearAction(id: string) {
  try {
    const ctx = await getContext();
    const year = await setActiveAcademicYear(ctx, id);
    revalidatePath("/academic-years");
    revalidatePath("/classrooms");
    revalidatePath("/students");
    return { success: true, data: year };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal mengaktifkan tahun ajaran." };
  }
}

// -------------------------------------------------------------
// CLASSROOM ACTIONS
// -------------------------------------------------------------

export async function getClassroomsAction(academicYearId?: string) {
  try {
    const ctx = await getContext();
    const list = await listClassrooms(ctx, academicYearId);
    return { success: true, data: list };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat daftar rombel." };
  }
}

export async function createClassroomAction(input: unknown) {
  try {
    const ctx = await getContext();
    const classroom = await createClassroom(ctx, input);
    revalidatePath("/classrooms");
    return { success: true, data: classroom };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal membuat rombel." };
  }
}

// -------------------------------------------------------------
// ENROLLMENT ACTIONS
// -------------------------------------------------------------

export async function enrollStudentAction(input: unknown) {
  try {
    const ctx = await getContext();
    const enrollment = await enrollStudent(ctx, input);
    revalidatePath("/students");
    revalidatePath(`/students/${(input as { studentId?: string })?.studentId || ""}`);
    revalidatePath("/classrooms");
    return { success: true, data: enrollment };
  } catch (err: unknown) {
    rethrowIfSessionExpired(err);
    return { success: false, error: err instanceof Error ? err.message : "Gagal menempatkan siswa ke rombel." };
  }
}
