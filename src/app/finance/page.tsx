"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { getCashbookSummaryAction, getBillingSummaryAction } from "@/actions/finance";
import {
  CreditCard,
  DollarSign,
  Receipt,
  BookOpen,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function FinanceDashboardPage() {
  const [cashSummary, setCashSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    todayIncome: 0,
  });
  const [billingSummary, setBillingSummary] = useState({
    totalChargesCount: 0,
    totalChargesAmount: 0,
    totalPaidAmount: 0,
    totalOutstandingAmount: 0,
    unpaidCount: 0,
    partialCount: 0,
    paidCount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cashRes, billRes] = await Promise.all([
          getCashbookSummaryAction(),
          getBillingSummaryAction(),
        ]);

        if (cashRes.success && cashRes.data) {
          setCashSummary(cashRes.data);
        }

        if (billRes.success && billRes.data) {
          setBillingSummary(billRes.data);
        }
      } catch (err: unknown) {
        console.error("Failed to load finance summary", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-600" /> Dashboard Keuangan & Syahriah
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pusat kendali transaksi pembayaran, penagihan kesiswaan, dan kasir lembaga
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/finance/charges"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <Receipt className="w-4 h-4 text-purple-600" /> Buat Tagihan
            </Link>
            <Link
              href="/finance/payments"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" /> Kasir Pembayaran
            </Link>
          </div>
        </div>

        {/* Financial Stat Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 mb-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Menghitung ringkasan keuangan realtime...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            {/* Card 1: Today Income */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Penerimaan Hari Ini
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900">
                Rp {cashSummary.todayIncome.toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">Kasir pembayaran</span>
            </div>

            {/* Card 2: Total Paid */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sudah Terbayar
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-blue-700">
                Rp {billingSummary.totalPaidAmount.toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">{billingSummary.paidCount} tagihan lunas</span>
            </div>

            {/* Card 3: Remaining Outstanding */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sisa Tunggakan
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-amber-700">
                Rp {billingSummary.totalOutstandingAmount.toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">{billingSummary.unpaidCount + billingSummary.partialCount} belum beres</span>
            </div>

            {/* Card 4: Overdue */}
            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                  Jatuh Tempo (Overdue)
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-rose-700">
                Rp {billingSummary.overdueAmount.toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-rose-500 font-medium mt-0.5 block">{billingSummary.overdueCount} tagihan lewat batas</span>
            </div>

            {/* Card 5: Net Cashbook Balance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Saldo Buku Kas Umum
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900">
                Rp {cashSummary.netBalance.toLocaleString("id-ID")}
              </div>
              <span className="text-xs text-slate-400 mt-0.5 block">Total Masuk - Keluar</span>
            </div>
          </div>
        )}

        {/* Sub-module Navigation Grid */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Modul Keuangan & Operasional</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/finance/payments"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center justify-between">
              <span>Kasir & Transaksi Pembayaran</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Penerimaan pembayaran SPP/syahriah, multi-alokasi atomik, dan bukti kwitansi resmi.
            </p>
          </Link>

          <Link
            href="/finance/charges"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors flex items-center justify-between">
              <span>Kewajiban Tagihan Siswa</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Penerbitan tagihan tunggal atau massal per rombel dengan proteksi tagihan ganda.
            </p>
          </Link>

          <Link
            href="/finance/reports"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors flex items-center justify-between">
              <span>Laporan & Export Excel</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Rekap pembayaran berkala, monitoring tunggakan, arus kas, dan unduh CSV.
            </p>
          </Link>

          <Link
            href="/finance/cashbook"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-cyan-600 transition-colors flex items-center justify-between">
              <span>Buku Kas Umum (BKU)</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Mutasi kas masuk otomatis dari kasir dan mutasi belanja/operasional lembaga.
            </p>
          </Link>

          <Link
            href="/finance/fees"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors flex items-center justify-between">
              <span>Master Kategori Biaya</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Atur acuan nominal SPP bulanan, uang pangkal, seragam, dan pos syahriah.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
