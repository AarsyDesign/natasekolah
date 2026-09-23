import { z } from "zod";

export const FEE_FREQUENCY_TYPES = ["ONE_TIME", "MONTHLY", "ANNUAL", "CUSTOM"] as const;
export type FeeFrequencyType = (typeof FEE_FREQUENCY_TYPES)[number];

export const STUDENT_CHARGE_STATUSES = ["UNPAID", "PARTIAL", "PAID", "VOID"] as const;
export type StudentChargeStatus = (typeof STUDENT_CHARGE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CASHBOOK_TYPES = ["INCOME", "EXPENSE"] as const;
export type CashbookType = (typeof CASHBOOK_TYPES)[number];

// -------------------------------------------------------------
// FeeCategory Validation
// -------------------------------------------------------------
export const feeCategoryInputSchema = z.object({
  code: z
    .string()
    .min(2, "Kode kategori minimal 2 karakter")
    .max(20, "Kode kategori maksimal 20 karakter")
    .transform((val) => val.toUpperCase().trim()),
  name: z.string().min(3, "Nama kategori minimal 3 karakter").max(100).trim(),
  description: z.string().max(255).optional().nullable(),
  amount: z.number().positive("Nominal harus lebih besar dari 0"),
  frequency: z.enum(FEE_FREQUENCY_TYPES).optional().default("MONTHLY"),
  isActive: z.boolean().optional().default(true),
});

export type FeeCategoryInput = z.input<typeof feeCategoryInputSchema>;

export const updateFeeCategoryInputSchema = feeCategoryInputSchema.partial();
export type UpdateFeeCategoryInput = z.input<typeof updateFeeCategoryInputSchema>;

export const feeCategoryFilterSchema = z.object({
  search: z.string().optional(),
  frequency: z.enum(FEE_FREQUENCY_TYPES).optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type FeeCategoryFilterInput = z.infer<typeof feeCategoryFilterSchema>;

// -------------------------------------------------------------
// StudentCharge Validation
// -------------------------------------------------------------
export const studentChargeInputSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib dipilih"),
  feeCategoryId: z.string().min(1, "Kategori biaya wajib dipilih"),
  academicYearId: z.string().optional().nullable(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format periode harus YYYY-MM (misal 2026-09)")
    .optional()
    .nullable(),
  dueDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  amount: z.number().positive("Nominal tagihan harus lebih besar dari 0"),
});

export type StudentChargeInput = z.input<typeof studentChargeInputSchema>;

export const bulkChargeInputSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Pilih minimal 1 siswa"),
  feeCategoryId: z.string().min(1, "Kategori biaya wajib dipilih"),
  academicYearId: z.string().optional().nullable(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Format periode harus YYYY-MM (misal 2026-09)")
    .optional()
    .nullable(),
  dueDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  amount: z.number().positive("Nominal tagihan harus lebih besar dari 0"),
});

export type BulkChargeInput = z.input<typeof bulkChargeInputSchema>;

export const studentChargeFilterSchema = z.object({
  studentId: z.string().optional(),
  feeCategoryId: z.string().optional(),
  academicYearId: z.string().optional(),
  period: z.string().optional(),
  status: z.enum(STUDENT_CHARGE_STATUSES).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type StudentChargeFilterInput = z.infer<typeof studentChargeFilterSchema>;

// -------------------------------------------------------------
// Payment & Allocation Validation
// -------------------------------------------------------------
export const paymentAllocationItemSchema = z.object({
  studentChargeId: z.string().min(1, "ID tagihan wajib diisi"),
  amount: z.number().positive("Nominal alokasi harus lebih besar dari 0"),
});

export type PaymentAllocationItem = z.infer<typeof paymentAllocationItemSchema>;

export const paymentTransactionInputSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib dipilih"),
  paymentDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : new Date())),
  amount: z.number().positive("Total nominal pembayaran harus lebih besar dari 0"),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default("CASH"),
  note: z.string().max(255).optional().nullable(),
  allocations: z
    .array(paymentAllocationItemSchema)
    .min(1, "Pembayaran harus dialokasikan minimal ke 1 tagihan"),
});

export type PaymentTransactionInput = z.input<typeof paymentTransactionInputSchema>;

export const paymentTransactionFilterSchema = z.object({
  studentId: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  search: z.string().optional(),
  startDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PaymentTransactionFilterInput = z.infer<typeof paymentTransactionFilterSchema>;

// -------------------------------------------------------------
// Cashbook Validation
// -------------------------------------------------------------
export const cashbookEntryInputSchema = z.object({
  type: z.enum(CASHBOOK_TYPES, {
    message: "Tipe kas harus INCOME atau EXPENSE",
  }),
  amount: z.number().positive("Nominal transaksi kas harus lebih besar dari 0"),
  description: z.string().min(3, "Deskripsi minimal 3 karakter").max(255).trim(),
  entryDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : new Date())),
});

export type CashbookEntryInput = z.input<typeof cashbookEntryInputSchema>;

export const cashbookFilterSchema = z.object({
  type: z.enum(CASHBOOK_TYPES).optional(),
  search: z.string().optional(),
  startDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type CashbookFilterInput = z.infer<typeof cashbookFilterSchema>;

// -------------------------------------------------------------
// Receipt Query Validation
// -------------------------------------------------------------
export const receiptQuerySchema = z.object({
  receiptNumber: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  studentId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>;
