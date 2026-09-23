"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createDormitory,
  getDormitoryById,
  listDormitories,
  createDormitoryRoom,
  getDormitoryRoomById,
  assignStudentToRoom,
  endDormitoryAssignment,
  listDormitoryAssignments,
} from "../lib/dormitory";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

export async function createDormitoryAction(rawInput: unknown) {
  try {
    const ctx = await getContext();
    const dorm = await createDormitory(ctx, rawInput);
    revalidatePath("/dormitories");
    return { success: true, data: dorm };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal membuat gedung asrama.",
      code: error.code || "DORMITORY_ERROR",
    };
  }
}

export async function getDormitoryAction(id: string) {
  try {
    const ctx = await getContext();
    const dorm = await getDormitoryById(ctx, id);
    return { success: true, data: dorm };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal mengambil rincian gedung asrama.",
    };
  }
}

export async function listDormitoriesAction() {
  try {
    const ctx = await getContext();
    const dorms = await listDormitories(ctx);
    return { success: true, data: dorms };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal menampilkan daftar asrama.",
    };
  }
}

export async function createDormitoryRoomAction(rawInput: unknown) {
  try {
    const ctx = await getContext();
    const room = await createDormitoryRoom(ctx, rawInput);
    revalidatePath("/dormitories");
    revalidatePath(`/dormitories/${room.dormitoryId}`);
    return { success: true, data: room };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal membuat kamar asrama.",
      code: error.code || "DORMITORY_ROOM_ERROR",
    };
  }
}

export async function getDormitoryRoomAction(id: string) {
  try {
    const ctx = await getContext();
    const room = await getDormitoryRoomById(ctx, id);
    return { success: true, data: room };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal mengambil rincian kamar asrama.",
    };
  }
}

export async function assignStudentToRoomAction(rawInput: unknown) {
  try {
    const ctx = await getContext();
    const assignment = await assignStudentToRoom(ctx, rawInput);
    revalidatePath("/dormitories");
    return { success: true, data: assignment };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal menempatkan santri ke kamar.",
      code: error.code || "ASSIGN_DORMITORY_ERROR",
    };
  }
}

export async function endDormitoryAssignmentAction(rawInput: unknown) {
  try {
    const ctx = await getContext();
    const assignment = await endDormitoryAssignment(ctx, rawInput);
    revalidatePath("/dormitories");
    return { success: true, data: assignment };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal mengakhiri penempatan kamar santri.",
      code: error.code || "END_DORMITORY_ERROR",
    };
  }
}

export async function listDormitoryAssignmentsAction(filter?: unknown) {
  try {
    const ctx = await getContext();
    const assignments = await listDormitoryAssignments(ctx, filter);
    return { success: true, data: assignments };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal menampilkan daftar penempatan kamar.",
    };
  }
}
