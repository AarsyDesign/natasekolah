"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedTenantContext } from "../lib/auth/service";
import type { TenantContext } from "../lib/tenant/context";
import {
  createFeeCategory,
  updateFeeCategory,
  setFeeCategoryActive,
  listFeeCategories,
  createStudentCharge,
  getStudentCharge,
  listStudentCharges,
  voidStudentCharge,
  createPayment,
  getPayment,
  listPayments,
  voidPayment,
  createCashbookExpense,
  listCashbook,
  getCashbookBalance,
} from "../lib/finance";

async function getContext(): Promise<TenantContext> {
  return getAuthenticatedTenantContext();
}

function errorResponse(err: unknown, fallback: string) {
  return { success: false as const, error: err instanceof Error ? err.message : fallback };
}

export async function listFeeCategoriesAction(query?: unknown) {
  try { return { success: true as const, data: await listFeeCategories(await getContext(), query) }; }
  catch (err) { return errorResponse(err, "Gagal memuat kategori tagihan."); }
}

export async function createFeeCategoryAction(input: unknown) {
  try { const data = await createFeeCategory(await getContext(), input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal membuat kategori tagihan."); }
}

export async function updateFeeCategoryAction(id: string, input: unknown) {
  try { const data = await updateFeeCategory(await getContext(), id, input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal memperbarui kategori tagihan."); }
}

export async function setFeeCategoryActiveAction(id: string, isActive: boolean) {
  try { const data = await setFeeCategoryActive(await getContext(), id, isActive); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal mengubah status kategori tagihan."); }
}

export async function createStudentChargeAction(input: unknown) {
  try { const data = await createStudentCharge(await getContext(), input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal membuat tagihan siswa."); }
}

export async function getStudentChargeAction(id: string) {
  try { return { success: true as const, data: await getStudentCharge(await getContext(), id) }; }
  catch (err) { return errorResponse(err, "Gagal memuat tagihan siswa."); }
}

export async function listStudentChargesAction(query?: unknown) {
  try { return { success: true as const, data: await listStudentCharges(await getContext(), query) }; }
  catch (err) { return errorResponse(err, "Gagal memuat daftar tagihan."); }
}

export async function voidStudentChargeAction(id: string, reason: string) {
  try { const data = await voidStudentCharge(await getContext(), id, reason); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal membatalkan tagihan."); }
}

export async function createPaymentAction(input: unknown) {
  try { const data = await createPayment(await getContext(), input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal mencatat pembayaran."); }
}

export async function getPaymentAction(id: string) {
  try { return { success: true as const, data: await getPayment(await getContext(), id) }; }
  catch (err) { return errorResponse(err, "Gagal memuat pembayaran."); }
}

export async function listPaymentsAction(query?: unknown) {
  try { return { success: true as const, data: await listPayments(await getContext(), query) }; }
  catch (err) { return errorResponse(err, "Gagal memuat pembayaran."); }
}

export async function voidPaymentAction(input: unknown) {
  try { const data = await voidPayment(await getContext(), input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal membatalkan pembayaran."); }
}

export async function createCashbookExpenseAction(input: unknown) {
  try { const data = await createCashbookExpense(await getContext(), input); revalidatePath("/finance"); return { success: true as const, data }; }
  catch (err) { return errorResponse(err, "Gagal mencatat pengeluaran."); }
}

export async function listCashbookAction(page = 1, pageSize = 50) {
  try { return { success: true as const, data: await listCashbook(await getContext(), page, pageSize) }; }
  catch (err) { return errorResponse(err, "Gagal memuat buku kas."); }
}

export async function getCashbookBalanceAction() {
  try { return { success: true as const, data: await getCashbookBalance(await getContext()) }; }
  catch (err) { return errorResponse(err, "Gagal memuat saldo buku kas."); }
}
