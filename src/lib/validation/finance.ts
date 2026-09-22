import { z } from "zod";
import { idSchema, nameSchema, nonEmptyString, validate } from "./common";
import { PAYMENT_METHODS } from "../finance/types";

const positiveMoney = z.coerce.number().int().min(1, "Nominal harus lebih besar dari 0");
const nonNegativeMoney = z.coerce.number().int().min(0, "Nominal tidak boleh negatif");

export const createFeeCategoryInputSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/, "Kode kategori hanya boleh A-Z, angka, _ atau -"),
  name: nameSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateFeeCategoryInputSchema = createFeeCategoryInputSchema.partial();

export const createStudentChargeInputSchema = z.object({
  studentId: idSchema,
  feeCategoryId: idSchema,
  academicYearId: idSchema,
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodYear: z.coerce.number().int().min(2000).max(2200).optional(),
  amount: positiveMoney,
  discountAmount: nonNegativeMoney.default(0),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
}).refine((v) => v.discountAmount <= v.amount, {
  message: "Diskon tidak boleh melebihi nominal tagihan",
  path: ["discountAmount"],
});

export const createPaymentInputSchema = z.object({
  studentChargeId: idSchema,
  amount: positiveMoney,
  method: z.enum(PAYMENT_METHODS),
  idempotencyKey: nonEmptyString("Idempotency key", 8, 120),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const voidPaymentInputSchema = z.object({
  paymentTransactionId: idSchema,
  reason: nonEmptyString("Alasan pembatalan", 3, 500),
});

export const feeCategoryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  activeOnly: z.coerce.boolean().default(true),
});

export const chargeQuerySchema = z.object({
  studentId: idSchema.optional(),
  feeCategoryId: idSchema.optional(),
  academicYearId: idSchema.optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "OVERPAID", "VOID"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const paymentQuerySchema = z.object({
  studentChargeId: idSchema.optional(),
  status: z.enum(["POSTED", "VOID", "REVERSAL"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export function validateCreateFeeCategoryInput(input: unknown) { return validate(createFeeCategoryInputSchema, input); }
export function validateUpdateFeeCategoryInput(input: unknown) { return validate(updateFeeCategoryInputSchema, input); }
export function validateCreateStudentChargeInput(input: unknown) { return validate(createStudentChargeInputSchema, input); }
export function validateCreatePaymentInput(input: unknown) { return validate(createPaymentInputSchema, input); }
export function validateVoidPaymentInput(input: unknown) { return validate(voidPaymentInputSchema, input); }
export function validateFeeCategoryQuery(input: unknown) { return validate(feeCategoryQuerySchema, input); }
export function validateChargeQuery(input: unknown) { return validate(chargeQuerySchema, input); }
export function validatePaymentQuery(input: unknown) { return validate(paymentQuerySchema, input); }

export const createCashbookExpenseInputSchema = z.object({
  amount: positiveMoney,
  category: nonEmptyString("Kategori", 1, 100),
  occurredAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export function validateCreateCashbookExpenseInput(input: unknown) { return validate(createCashbookExpenseInputSchema, input); }
