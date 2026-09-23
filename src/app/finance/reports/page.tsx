"use client";

import { useState, useEffect } from "react";
import {
  getPaymentSummaryReportAction,
  getOutstandingSummaryReportAction,
  getCashflowReportAction,
} from "@/actions/finance";
import {
  generatePaymentsCSV,
  generateChargesCSV,
  generateCashbookCSV,
  downloadCSV,
} from "@/lib/finance/export-utils";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  RefreshCw,
  CreditCard,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/loading/skeletons";

export default function FinanceReportsPage() {
  const [activeTab, setActiveTab] = useState<"PAYMENTS" | "OUTSTANDING" | "CASHFLOW">("PAYMENTS");
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Reports data
  const [paymentReport, setPaymentReport] = useState<any | null>(null);
  const [outstandingReport, setOutstandingReport] = useState<any | null>(null);
  const [cashflowReport, setCashflowReport] = useState<any | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate + "T23:59:59.999Z") : undefined;

      if (activeTab === "PAYMENTS") {
        const res = await getPaymentSummaryReportAction({ startDate: start, endDate: end });
        if (res.success && res.data) setPaymentReport(res.data);
      } else if (activeTab === "OUTSTANDING") {
        const res = await getOutstandingSummaryReportAction({});
        if (res.success && res.data) setOutstandingReport(res.data);
      } else if (activeTab === "CASHFLOW") {
        const res = await getCashflowReportAction({ startDate: start, endDate: end });
        if (res.success && res.data) setCashflowReport(res.data);
      }
    } catch (err) {
      console.error("Failed loading report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeTab, startDate, endDate]);

  const handleExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (activeTab === "PAYMENTS" && paymentReport) {
      const csv = generatePaymentsCSV(paymentReport.items);
      downloadCSV(`Laporan_Pembayaran_${startDate}_sd_${endDate}.csv`, csv);
    } else if (activeTab === "OUTSTANDING" && outstandingReport) {
      const csv = generateChargesCSV(outstandingReport.items);
      downloadCSV(`Laporan_Tunggakan_Siswa_${today}.csv`, csv);
    } else if (activeTab === "CASHFLOW" && cashflowReport) {
      const csv = generateCashbookCSV(cashflowReport.items);
      downloadCSV(`Laporan_Arus_Kas_${startDate}_sd_${endDate}.csv`, csv);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-700" /> Laporan Keuangan & Operasional
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Rekapitulasi penerimaan kasir, monitoring kewajiban santri, dan laporan arus kas BKU.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleExport} className="gap-1.5">
          <Download className="w-4 h-4" /> Download CSV (Excel)
        </Button>
      </div>

      {/* Internal Report Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("PAYMENTS")}
          className={`touch-target inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === "PAYMENTS"
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Rekap Pembayaran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("OUTSTANDING")}
          className={`touch-target inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === "OUTSTANDING"
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Tagihan & Tunggakan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CASHFLOW")}
          className={`touch-target inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeTab === "CASHFLOW"
              ? "bg-teal-700 text-white shadow-2xs"
              : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Arus Kas (BKU)</span>
        </button>
      </div>

      {/* Date Filter Bar for Payments and Cashflow */}
      {activeTab !== "OUTSTANDING" && (
        <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <Calendar className="w-4 h-4 text-stone-400" />
            <span>Periode Transaksi:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md min-h-[40px] text-stone-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
            />
            <span className="text-stone-400 text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md min-h-[40px] text-stone-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={loadReport} className="h-10 px-3">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Segarkan
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <>
          {/* TAB 1: PAYMENTS RECAP */}
          {activeTab === "PAYMENTS" && paymentReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Total Penerimaan
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-800 font-mono tabular-nums">
                    Rp {paymentReport.totalAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">
                    Periode {startDate} s/d {endDate}
                  </span>
                </Card>

                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Jumlah Transaksi
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tabular-nums">
                    {paymentReport.totalTransactions} transaksi
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">Kwitansi sah diterbitkan</span>
                </Card>

                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Rata-Rata per Transaksi
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-blue-800 font-mono tabular-nums">
                    Rp {paymentReport.averageAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">Rata-rata setoran santri</span>
                </Card>
              </div>

              {/* Breakdown by Category & Method */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-stone-900 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <BookOpen className="w-4 h-4 text-teal-700" /> Breakdown per Komponen Biaya
                  </h3>
                  <div className="space-y-2">
                    {paymentReport.byCategory.length === 0 ? (
                      <p className="text-xs text-stone-400 py-2">Tidak ada alokasi pada periode ini.</p>
                    ) : (
                      paymentReport.byCategory.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex justify-between items-center p-2.5 bg-stone-50 rounded-md text-xs border border-stone-100"
                        >
                          <span className="font-medium text-stone-800">{c.name}</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-stone-900 block">
                              Rp {c.amount.toLocaleString("id-ID")}
                            </span>
                            <span className="text-[10px] text-stone-500">{c.count} alokasi</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-stone-900 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                    <CreditCard className="w-4 h-4 text-teal-700" /> Breakdown per Metode Pembayaran
                  </h3>
                  <div className="space-y-2">
                    {paymentReport.byMethod.length === 0 ? (
                      <p className="text-xs text-stone-400 py-2">Tidak ada transaksi pada periode ini.</p>
                    ) : (
                      paymentReport.byMethod.map((m: any) => (
                        <div
                          key={m.method}
                          className="flex justify-between items-center p-2.5 bg-stone-50 rounded-md text-xs border border-stone-100"
                        >
                          <span className="font-medium text-stone-800">{m.method}</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-stone-900 block">
                              Rp {m.amount.toLocaleString("id-ID")}
                            </span>
                            <span className="text-[10px] text-stone-500">{m.count} pembayaran</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Detailed Table */}
              <div className="rounded-lg border border-stone-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                  <h3 className="font-semibold text-sm text-stone-900">Rincian Riwayat Pembayaran</h3>
                  <span className="text-xs text-stone-500">{paymentReport.items.length} data</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-stone-700 border-collapse">
                    <thead className="bg-stone-50/80 text-xs font-semibold text-stone-600 uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-3">No. Transaksi</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Santri</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                        <th className="px-4 py-3 text-center">Metode</th>
                        <th className="px-4 py-3">No. Kwitansi</th>
                        <th className="px-4 py-3">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {paymentReport.items.map((it: any) => (
                        <tr key={it.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-stone-900">
                            {it.transactionNumber}
                          </td>
                          <td className="px-4 py-3 text-stone-500">
                            {new Date(it.paymentDate).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-stone-900">{it.studentName}</span>
                            <span className="block text-[10px] text-stone-400 font-mono">
                              NIS: {it.studentNis}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                            Rp {it.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="neutral">{it.paymentMethod}</Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-teal-800 font-semibold">
                            {it.receiptNumber}
                          </td>
                          <td className="px-4 py-3 text-stone-600">{it.receivedByName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OUTSTANDING REPORT */}
          {activeTab === "OUTSTANDING" && outstandingReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-3.5">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Total Kewajiban
                  </span>
                  <div className="text-base sm:text-lg font-bold text-stone-900 font-mono tabular-nums">
                    Rp {outstandingReport.totalChargesAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500">{outstandingReport.totalChargesCount} tagihan</span>
                </Card>

                <Card className="p-3.5">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Sudah Terbayar
                  </span>
                  <div className="text-base sm:text-lg font-bold text-emerald-800 font-mono tabular-nums">
                    Rp {outstandingReport.totalPaidAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500">Kas diterima</span>
                </Card>

                <Card className="p-3.5">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Sisa Tunggakan
                  </span>
                  <div className="text-base sm:text-lg font-bold text-amber-800 font-mono tabular-nums">
                    Rp {outstandingReport.totalOutstandingAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500">Belum terselesaikan</span>
                </Card>

                <Card className="p-3.5 border-rose-200 bg-rose-50/20">
                  <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
                    Jatuh Tempo (Overdue)
                  </span>
                  <div className="text-base sm:text-lg font-bold text-rose-800 font-mono tabular-nums">
                    Rp {outstandingReport.overdueAmount.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-rose-600 font-medium">
                    {outstandingReport.overdueChargesCount} tagihan lewat batas
                  </span>
                </Card>
              </div>

              {/* Outstanding Table */}
              <div className="rounded-lg border border-stone-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                  <h3 className="font-semibold text-sm text-stone-900">Daftar Santri dengan Tunggakan Aktif</h3>
                  <span className="text-xs text-stone-500">{outstandingReport.items.length} santri</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-stone-700 border-collapse">
                    <thead className="bg-stone-50/80 text-xs font-semibold text-stone-600 uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-3">Santri</th>
                        <th className="px-4 py-3">Komponen Biaya</th>
                        <th className="px-4 py-3">Periode</th>
                        <th className="px-4 py-3">Jatuh Tempo</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Terbayar</th>
                        <th className="px-4 py-3 text-right">Sisa Tagihan</th>
                        <th className="px-4 py-3 text-center">Status Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {outstandingReport.items.map((it: any) => (
                        <tr key={it.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-stone-900">{it.studentName}</span>
                            <span className="block text-[10px] text-stone-400 font-mono">
                              NIS: {it.studentNis}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-stone-800">{it.feeCategoryName}</td>
                          <td className="px-4 py-3 font-mono text-stone-500">{it.period || "-"}</td>
                          <td className="px-4 py-3 text-stone-500">
                            {it.dueDate ? new Date(it.dueDate).toLocaleDateString("id-ID") : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-stone-800">
                            Rp {it.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-800">
                            Rp {it.paidAmount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-stone-900">
                            Rp {it.remainingAmount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {it.isOverdue ? (
                              <Badge variant="danger" className="text-[10px]">
                                Lewat {it.daysOverdue} hari
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="text-[10px]">
                                Berjalan
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CASHFLOW REPORT */}
          {activeTab === "CASHFLOW" && cashflowReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Total Kas Masuk
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-800 font-mono tabular-nums">
                    Rp {cashflowReport.totalIncome.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">Periode ini</span>
                </Card>

                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Total Pengeluaran
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-rose-700 font-mono tabular-nums">
                    Rp {cashflowReport.totalExpense.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">Belanja & operasional</span>
                </Card>

                <Card className="p-4">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                    Saldo Bersih Periode
                  </span>
                  <div
                    className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                      cashflowReport.netBalance >= 0 ? "text-stone-900" : "text-rose-700"
                    }`}
                  >
                    Rp {cashflowReport.netBalance.toLocaleString("id-ID")}
                  </div>
                  <span className="text-xs text-stone-500 mt-0.5 block">Net Cashflow</span>
                </Card>
              </div>

              {/* Cashflow Table */}
              <div className="rounded-lg border border-stone-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-3.5 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                  <h3 className="font-semibold text-sm text-stone-900">Rincian Arus Kas Buku Kas Umum</h3>
                  <span className="text-xs text-stone-500">{cashflowReport.items.length} mutasi</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-stone-700 border-collapse">
                    <thead className="bg-stone-50/80 text-xs font-semibold text-stone-600 uppercase tracking-wider border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-3">No. Kas</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3 text-center">Jenis</th>
                        <th className="px-4 py-3 text-right">Nominal</th>
                        <th className="px-4 py-3">Keterangan</th>
                        <th className="px-4 py-3">Petugas</th>
                        <th className="px-4 py-3">Ref Transaksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {cashflowReport.items.map((it: any) => (
                        <tr key={it.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-stone-900">
                            {it.entryNumber}
                          </td>
                          <td className="px-4 py-3 text-stone-500">
                            {new Date(it.entryDate).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {it.type === "INCOME" ? (
                              <Badge variant="success" className="text-[10px]">
                                MASUK
                              </Badge>
                            ) : (
                              <Badge variant="danger" className="text-[10px]">
                                KELUAR
                              </Badge>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${
                              it.type === "INCOME" ? "text-emerald-800" : "text-rose-700"
                            }`}
                          >
                            {it.type === "INCOME" ? "+" : "-"} Rp {it.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-stone-800">{it.description}</td>
                          <td className="px-4 py-3 text-stone-600">{it.createdByName}</td>
                          <td className="px-4 py-3 text-stone-500 font-mono">{it.paymentRef || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
