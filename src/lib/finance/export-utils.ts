/**
 * Client-safe CSV generation and download utilities with UTF-8 BOM
 * for clean opening in Microsoft Excel and spreadsheet tools.
 */

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  // \uFEFF is UTF-8 Byte Order Mark (BOM) to prevent Excel from scrambling Indonesian accents / numbers
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generatePaymentsCSV(
  items: Array<{
    transactionNumber: string;
    receiptNumber?: string | null;
    paymentDate: string | Date;
    studentName: string;
    studentNis: string;
    amount: number;
    paymentMethod: string;
    receivedByName?: string | null;
    note?: string | null;
  }>
): string {
  const headers = [
    "No. Transaksi",
    "No. Kwitansi",
    "Tanggal Bayar",
    "Nama Siswa",
    "NIS",
    "Nominal (Rp)",
    "Metode",
    "Penerima Kasir",
    "Catatan",
  ];

  const rows = items.map((item) => [
    escapeCSV(item.transactionNumber),
    escapeCSV(item.receiptNumber || "-"),
    escapeCSV(new Date(item.paymentDate).toLocaleDateString("id-ID")),
    escapeCSV(item.studentName),
    escapeCSV(item.studentNis),
    escapeCSV(item.amount),
    escapeCSV(item.paymentMethod),
    escapeCSV(item.receivedByName || "-"),
    escapeCSV(item.note || "-"),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function generateChargesCSV(
  items: Array<{
    studentName: string;
    studentNis: string;
    feeCategoryName: string;
    period?: string | null;
    dueDate?: string | Date | null;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    isOverdue?: boolean;
  }>
): string {
  const headers = [
    "Nama Siswa",
    "NIS",
    "Kategori Biaya",
    "Periode",
    "Jatuh Tempo",
    "Total Tagihan (Rp)",
    "Sudah Dibayar (Rp)",
    "Sisa Tagihan (Rp)",
    "Status",
    "Jatuh Tempo?",
  ];

  const rows = items.map((item) => [
    escapeCSV(item.studentName),
    escapeCSV(item.studentNis),
    escapeCSV(item.feeCategoryName),
    escapeCSV(item.period || "-"),
    escapeCSV(item.dueDate ? new Date(item.dueDate).toLocaleDateString("id-ID") : "-"),
    escapeCSV(item.amount),
    escapeCSV(item.paidAmount),
    escapeCSV(item.remainingAmount),
    escapeCSV(item.status),
    escapeCSV(item.isOverdue ? "YA (TERLAMBAT)" : "TIDAK"),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function generateCashbookCSV(
  items: Array<{
    entryNumber: string;
    entryDate: string | Date;
    type: string;
    amount: number;
    description: string;
    createdByName?: string | null;
    paymentRef?: string | null;
  }>
): string {
  const headers = [
    "No. Kas",
    "Tanggal",
    "Jenis Mutasi",
    "Nominal (Rp)",
    "Keterangan",
    "Petugas",
    "Referensi Transaksi",
  ];

  const rows = items.map((item) => [
    escapeCSV(item.entryNumber),
    escapeCSV(new Date(item.entryDate).toLocaleDateString("id-ID")),
    escapeCSV(item.type === "INCOME" ? "PEMASUKAN" : "PENGELUARAN"),
    escapeCSV(item.amount),
    escapeCSV(item.description),
    escapeCSV(item.createdByName || "-"),
    escapeCSV(item.paymentRef || "-"),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}
