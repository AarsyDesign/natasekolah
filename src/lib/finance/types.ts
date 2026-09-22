export const FEE_CATEGORY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const CHARGE_STATUSES = ["UNPAID", "PARTIAL", "PAID", "OVERPAID", "VOID"] as const;
export const PAYMENT_STATUSES = ["POSTED", "VOID", "REVERSAL"] as const;
export const PAYMENT_METHODS = ["CASH", "TRANSFER", "QRIS", "OTHER"] as const;
export const CASHBOOK_ENTRY_TYPES = ["INCOME", "EXPENSE"] as const;

export type ChargeStatus = (typeof CHARGE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type CashbookEntryType = (typeof CASHBOOK_ENTRY_TYPES)[number];

export class FinanceDomainError extends Error {
  readonly code: string;
  readonly status = 400;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceDomainError";
    this.code = code;
  }
}

export class FinanceNotFoundError extends FinanceDomainError {
  constructor(resource: string, id: string) {
    super("FINANCE_RESOURCE_NOT_FOUND", `${resource} tidak ditemukan: ${id}`);
  }
}

export class FinanceConflictError extends FinanceDomainError {
  constructor(message: string) {
    super("FINANCE_CONFLICT", message);
  }
}

export class ChargeHasPaymentsError extends FinanceDomainError {
  constructor() {
    super("CHARGE_HAS_PAYMENTS", "Tagihan yang sudah memiliki pembayaran aktif tidak dapat diubah secara destruktif.");
  }
}

export class PaymentAlreadyVoidedError extends FinanceDomainError {
  constructor() {
    super("PAYMENT_ALREADY_VOID", "Pembayaran ini sudah tidak aktif.");
  }
}

export function calculateChargeStatus(amount: number, totalPaid: number): ChargeStatus {
  if (totalPaid <= 0) return "UNPAID";
  if (totalPaid < amount) return "PARTIAL";
  if (totalPaid === amount) return "PAID";
  return "OVERPAID";
}

export function calculateOutstanding(amount: number, totalPaid: number): number {
  return Math.max(amount - totalPaid, 0);
}

export function calculateExcess(amount: number, totalPaid: number): number {
  return Math.max(totalPaid - amount, 0);
}
