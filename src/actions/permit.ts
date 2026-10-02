"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession, rethrowIfSessionExpired } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import {
  createPermitRequest,
  approvePermitRequest,
  rejectPermitRequest,
  markPermitReturned,
  markPermitOverdue,
  listPermitRequests,
  getPermitRequestById,
} from "../lib/permit";

export async function listPermitRequestsAction(filter?: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      listPermitRequests(context, filter)
    );
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menampilkan daftar izin pulang.",
      code: error.code || "PERMIT_LIST_ERROR",
    };
  }
}

export async function getPermitRequestAction(id: string) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      getPermitRequestById(context, id)
    );
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal mengambil rincian izin pulang.",
      code: error.code || "PERMIT_DETAIL_ERROR",
    };
  }
}

export async function createPermitRequestAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      createPermitRequest(context, rawInput)
    );
    revalidatePath("/dormitories/permits");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal mengajukan izin pulang.",
      code: error.code || "PERMIT_CREATE_ERROR",
    };
  }
}

export async function approvePermitAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      approvePermitRequest(context, rawInput)
    );
    revalidatePath("/dormitories/permits");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menyetujui izin pulang.",
      code: error.code || "PERMIT_APPROVE_ERROR",
    };
  }
}

export async function rejectPermitAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      rejectPermitRequest(context, rawInput)
    );
    revalidatePath("/dormitories/permits");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menolak izin pulang.",
      code: error.code || "PERMIT_REJECT_ERROR",
    };
  }
}

export async function markPermitReturnedAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      markPermitReturned(context, rawInput)
    );
    revalidatePath("/dormitories/permits");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menandai santri kembali.",
      code: error.code || "PERMIT_RETURN_ERROR",
    };
  }
}

export async function markPermitOverdueAction(rawInput: unknown) {
  try {
    const context = await requireActionSession();
    const data = await runWithTenantContext(context, () =>
      markPermitOverdue(context, rawInput)
    );
    revalidatePath("/dormitories/permits");
    return { success: true, data };
  } catch (error: any) {
    rethrowIfSessionExpired(error);
    return {
      success: false,
      error: error.message || "Gagal menandai izin terlambat.",
      code: error.code || "PERMIT_OVERDUE_ERROR",
    };
  }
}
