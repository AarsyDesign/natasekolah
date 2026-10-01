"use server";

import { requireActionSession } from "../lib/auth/action-session";
import { runWithTenantContext } from "../lib/tenant/context";
import {
  createFeeCategory,
  updateFeeCategory,
  listFeeCategories,
  getFeeCategory,
  createStudentCharge,
  bulkCreateStudentCharges,
  listStudentCharges,
  getStudentCharge,
  voidStudentCharge,
  calculateStudentFinancialSummary,
  getTargetStudentsForBilling,
  getBillingSummary,
  createPaymentTransaction,
  listPaymentTransactions,
  getPaymentTransaction,
  createCashbookEntry,
  listCashbookEntries,
  getCashbookSummary,
  getReceiptByPayment,
  getReceiptDetails,
  listReceipts,
  getPaymentSummaryReport,
  getOutstandingSummaryReport,
  getCashflowReport,
} from "../lib/finance";
import {
  FeeCategoryInput,
  UpdateFeeCategoryInput,
  FeeCategoryFilterInput,
  StudentChargeInput,
  BulkChargeInput,
  StudentChargeFilterInput,
  PaymentTransactionInput,
  PaymentTransactionFilterInput,
  CashbookEntryInput,
  CashbookFilterInput,
  ReceiptQueryInput,
  TargetStudentsQueryInput,
  FinancialReportFilterInput,
} from "../lib/validation/finance";

export async function createFeeCategoryAction(input: FeeCategoryInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await createFeeCategory(input);
    return { success: true, data };
  });
}

export async function updateFeeCategoryAction(id: string, input: UpdateFeeCategoryInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await updateFeeCategory(id, input);
    return { success: true, data };
  });
}

export async function listFeeCategoriesAction(input?: Partial<FeeCategoryFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await listFeeCategories(input);
    return { success: true, data };
  });
}

export async function getFeeCategoryAction(id: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getFeeCategory(id);
    return { success: true, data };
  });
}

export async function createStudentChargeAction(input: StudentChargeInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await createStudentCharge(input);
    return { success: true, data };
  });
}

export async function bulkCreateStudentChargesAction(input: BulkChargeInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await bulkCreateStudentCharges(input);
    return { success: true, data };
  });
}

export async function listStudentChargesAction(input?: Partial<StudentChargeFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await listStudentCharges(input);
    return { success: true, data };
  });
}

export async function getStudentChargeAction(id: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getStudentCharge(id);
    return { success: true, data };
  });
}

export async function voidStudentChargeAction(id: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await voidStudentCharge(id);
    return { success: true, data };
  });
}

export async function calculateStudentFinancialSummaryAction(studentId: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await calculateStudentFinancialSummary(studentId);
    return { success: true, data };
  });
}

export async function createPaymentTransactionAction(input: PaymentTransactionInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await createPaymentTransaction(input);
    return { success: true, data };
  });
}

export async function listPaymentTransactionsAction(input?: Partial<PaymentTransactionFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await listPaymentTransactions(input);
    return { success: true, data };
  });
}

export async function getPaymentTransactionAction(id: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getPaymentTransaction(id);
    return { success: true, data };
  });
}

export async function createCashbookEntryAction(input: CashbookEntryInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await createCashbookEntry(input);
    return { success: true, data };
  });
}

export async function listCashbookEntriesAction(input?: Partial<CashbookFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await listCashbookEntries(input);
    return { success: true, data };
  });
}

export async function getCashbookSummaryAction() {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getCashbookSummary();
    return { success: true, data };
  });
}

export async function getReceiptByPaymentAction(paymentTransactionId: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getReceiptByPayment(paymentTransactionId);
    return { success: true, data };
  });
}

export async function listReceiptsAction(input?: Partial<ReceiptQueryInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await listReceipts(input);
    return { success: true, data };
  });
}

export async function getReceiptDetailsAction(paymentTransactionId: string) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getReceiptDetails(paymentTransactionId);
    return { success: true, data };
  });
}

export async function getTargetStudentsForBillingAction(query: TargetStudentsQueryInput) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getTargetStudentsForBilling(query);
    return { success: true, data };
  });
}

export async function getBillingSummaryAction() {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getBillingSummary();
    return { success: true, data };
  });
}

export async function getPaymentSummaryReportAction(input?: Partial<FinancialReportFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getPaymentSummaryReport(input);
    return { success: true, data };
  });
}

export async function getOutstandingSummaryReportAction(input?: Partial<FinancialReportFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getOutstandingSummaryReport(input);
    return { success: true, data };
  });
}

export async function getCashflowReportAction(input?: Partial<FinancialReportFilterInput>) {
  const context = await requireActionSession();
  return runWithTenantContext(context, async () => {
    const data = await getCashflowReport(input);
    return { success: true, data };
  });
}
