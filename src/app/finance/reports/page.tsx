"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  getPaymentSummaryReportAction,
  getOutstandingSummaryReportAction,
  getCashflowReportAction,
  listFeeCategoriesAction,
  getBillingSummaryAction,
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
  Filter,
  RefreshCw,
  CreditCard,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react";

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
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-teal-600" /> Laporan Keuangan & Operasional
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rekapitulasi transaksi penerimaan kasir, monitoring tunggakan santri, dan laporan arus kas
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-xs hover:bg-emerald-700 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" /> Download CSV (Excel)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("PAYMENTS")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
              activeTab === "PAYMENTS"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Rekap Pembayaran</span>
          </button>

          <button
            onClick={() => setActiveTab("OUTSTANDING")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
              activeTab === "OUTSTANDING"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Tagihan & Tunggakan</span>
          </button>

          <button
            onClick={() => setActiveTab("CASHFLOW")}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
              activeTab === "CASHFLOW"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Arus Kas (BKU)</span>
          </button>
        </div>

        {/* Date Filter Bar for Payments and Cashflow */}
        {activeTab !== "OUTSTANDING" && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Periode Transaksi:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg min-h-[40px]"
              />
              <span className="text-slate-400 text-xs">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg min-h-[40px]"
              />
            </div>
            <button
              onClick={loadReport}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            Mengolah data laporan keuangan aktual...
          </div>
        ) : (
          <>
            {/* TAB 1: PAYMENTS RECAP */}
            {activeTab === "PAYMENTS" && paymentReport && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Total Penerimaan
                    </span>
                    <div className="text-2xl font-bold text-emerald-700">
                      Rp {paymentReport.totalAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      Periode {startDate} s/d {endDate}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Jumlah Transaksi
                    </span>
                    <div className="text-2xl font-bold text-slate-900">
                      {paymentReport.totalTransactions} transaksi
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">Kwitansi sah diterbitkan</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Rata-Rata per Transaksi
                    </span>
                    <div className="text-2xl font-bold text-blue-700">
                      Rp {paymentReport.averageAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">Rata-rata setoran siswa</span>
                  </div>
                </div>

                {/* Breakdown by Category & Method */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-600" /> Breakdown per Komponen Biaya
                    </h3>
                    <div className="space-y-2">
                      {paymentReport.byCategory.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Tidak ada alokasi pada periode ini.</p>
                      ) : (
                        paymentReport.byCategory.map((c: any) => (
                          <div
                            key={c.id}
                            className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-xs"
                          >
                            <span className="font-medium text-slate-800">{c.name}</span>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">
                                Rp {c.amount.toLocaleString("id-ID")}
                              </span>
                              <span className="text-[10px] text-slate-400">{c.count} alokasi</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" /> Breakdown per Metode Pembayaran
                    </h3>
                    <div className="space-y-2">
                      {paymentReport.byMethod.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Tidak ada transaksi pada periode ini.</p>
                      ) : (
                        paymentReport.byMethod.map((m: any) => (
                          <div
                            key={m.method}
                            className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-xs"
                          >
                            <span className="font-medium text-slate-800">{m.method}</span>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">
                                Rp {m.amount.toLocaleString("id-ID")}
                              </span>
                              <span className="text-[10px] text-slate-400">{m.count} pembayaran</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900">Rincian Riwayat Pembayaran</h3>
                    <span className="text-xs text-slate-400">{paymentReport.items.length} data</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">No. Transaksi</th>
                          <th className="px-4 py-3">Tanggal</th>
                          <th className="px-4 py-3">Siswa</th>
                          <th className="px-4 py-3">Nominal</th>
                          <th className="px-4 py-3">Metode</th>
                          <th className="px-4 py-3">No. Kwitansi</th>
                          <th className="px-4 py-3">Kasir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {paymentReport.items.map((it: any) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {it.transactionNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(it.paymentDate).toLocaleDateString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900">{it.studentName}</span>
                              <span className="block text-[10px] text-slate-400">NIS: {it.studentNis}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-700">
                              Rp {it.amount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                {it.paymentMethod}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-purple-700 font-semibold">
                              {it.receiptNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{it.receivedByName}</td>
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Total Kewajiban
                    </span>
                    <div className="text-xl font-bold text-slate-900">
                      Rp {outstandingReport.totalChargesAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400">{outstandingReport.totalChargesCount} tagihan</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Sudah Terbayar
                    </span>
                    <div className="text-xl font-bold text-emerald-700">
                      Rp {outstandingReport.totalPaidAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400">Kas diterima</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Sisa Tunggakan
                    </span>
                    <div className="text-xl font-bold text-amber-700">
                      Rp {outstandingReport.totalOutstandingAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400">Belum terselesaikan</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
                    <span className="text-xs font-medium text-rose-600 uppercase tracking-wider block mb-1">
                      Jatuh Tempo (Overdue)
                    </span>
                    <div className="text-xl font-bold text-rose-700">
                      Rp {outstandingReport.overdueAmount.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-rose-500 font-medium">
                      {outstandingReport.overdueChargesCount} tagihan lewat batas
                    </span>
                  </div>
                </div>

                {/* Outstanding Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900">Daftar Santri dengan Tunggakan Aktif</h3>
                    <span className="text-xs text-slate-400">{outstandingReport.items.length} siswa</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Siswa</th>
                          <th className="px-4 py-3">Komponen Biaya</th>
                          <th className="px-4 py-3">Periode</th>
                          <th className="px-4 py-3">Jatuh Tempo</th>
                          <th className="px-4 py-3">Total</th>
                          <th className="px-4 py-3">Terbayar</th>
                          <th className="px-4 py-3">Sisa Tagihan</th>
                          <th className="px-4 py-3">Status Overdue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {outstandingReport.items.map((it: any) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900">{it.studentName}</span>
                              <span className="block text-[10px] text-slate-400">NIS: {it.studentNis}</span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{it.feeCategoryName}</td>
                            <td className="px-4 py-3 font-mono text-slate-500">{it.period}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {it.dueDate ? new Date(it.dueDate).toLocaleDateString("id-ID") : "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-800">
                              Rp {it.amount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3 text-blue-700 font-medium">
                              Rp {it.paidAmount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3 font-bold text-rose-600">
                              Rp {it.remainingAmount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              {it.isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  <AlertCircle className="w-3 h-3" /> Lewat {it.daysOverdue} hari
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800">
                                  <Clock className="w-3 h-3" /> Berjalan
                                </span>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Total Kas Masuk
                    </span>
                    <div className="text-2xl font-bold text-emerald-700">
                      Rp {cashflowReport.totalIncome.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">Periode ini</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Total Pengeluaran
                    </span>
                    <div className="text-2xl font-bold text-rose-600">
                      Rp {cashflowReport.totalExpense.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">Belanja & operasional</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
                      Saldo Bersih Periode
                    </span>
                    <div
                      className={`text-2xl font-bold ${
                        cashflowReport.netBalance >= 0 ? "text-slate-900" : "text-rose-600"
                      }`}
                    >
                      Rp {cashflowReport.netBalance.toLocaleString("id-ID")}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">Net Cashflow</span>
                  </div>
                </div>

                {/* Cashflow Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-sm text-slate-900">Rincian Arus Kas Buku Kas Umum</h3>
                    <span className="text-xs text-slate-400">{cashflowReport.items.length} mutasi</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">No. Kas</th>
                          <th className="px-4 py-3">Tanggal</th>
                          <th className="px-4 py-3">Jenis</th>
                          <th className="px-4 py-3">Nominal</th>
                          <th className="px-4 py-3">Keterangan</th>
                          <th className="px-4 py-3">Petugas</th>
                          <th className="px-4 py-3">Ref Transaksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {cashflowReport.items.map((it: any) => (
                          <tr key={it.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {it.entryNumber}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(it.entryDate).toLocaleDateString("id-ID")}
                            </td>
                            <td className="px-4 py-3">
                              {it.type === "INCOME" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <ArrowUpRight className="w-3 h-3" /> MASUK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  <ArrowDownRight className="w-3 h-3" /> KELUAR
                                </span>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 font-bold ${
                                it.type === "INCOME" ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {it.type === "INCOME" ? "+" : "-"} Rp {it.amount.toLocaleString("id-ID")}
                            </td>
                            <td className="px-4 py-3 text-slate-800">{it.description}</td>
                            <td className="px-4 py-3 text-slate-600">{it.createdByName}</td>
                            <td className="px-4 py-3 text-slate-500 font-mono">{it.paymentRef || "-"}</td>
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
      </main>
    </div>
  );
}
