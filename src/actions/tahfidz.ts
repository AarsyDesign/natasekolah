"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createTahfidzRecord,
  getTahfidzRecordById,
  listTahfidzRecords,
  getTahfidzSummary,
} from "../lib/tahfidz";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

export async function createTahfidzRecordAction(rawInput: unknown) {
  try {
    const ctx = await getContext();
    const record = await createTahfidzRecord(ctx, rawInput);
    revalidatePath("/tahfidz");
    revalidatePath(`/tahfidz/${record.studentId}`);
    return { success: true, data: record };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal mencatat mutaba'ah tahfidz.",
      code: error.code || "TAHFIDZ_ERROR",
    };
  }
}

export async function getTahfidzRecordAction(id: string) {
  try {
    const ctx = await getContext();
    const record = await getTahfidzRecordById(ctx, id);
    return { success: true, data: record };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal mengambil rincian mutaba'ah tahfidz.",
    };
  }
}

export async function listTahfidzRecordsAction(filter?: unknown) {
  try {
    const ctx = await getContext();
    const records = await listTahfidzRecords(ctx, filter);
    return { success: true, data: records };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal menampilkan daftar mutaba'ah tahfidz.",
    };
  }
}

export async function getTahfidzSummaryAction(studentId: string) {
  try {
    const ctx = await getContext();
    const summary = await getTahfidzSummary(ctx, studentId);
    return { success: true, data: summary };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gagal menghitung ringkasan tahfidz santri.",
    };
  }
}
