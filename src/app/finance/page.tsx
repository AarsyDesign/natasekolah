"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCashbookSummaryAction, getBillingSummaryAction } from "@/actions/finance";
import {
  CreditCard,
  DollarSign,
  Receipt,
  BookOpen,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  FileSpreadsheet,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/loading/skeletons";

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
    <div className="space-y-6">
      {/* Workspace Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-700" /> Ringkasan Keuangan & Syahriah
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Monitoring penerimaan harian kasir, status pelunasan kewajiban santri, dan saldo BKU.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/finance/charges">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Receipt className="w-4 h-4 text-stone-600" /> Buat Tagihan
            </Button>
          </Link>
          <Link href="/finance/payments">
            <Button variant="primary" size="sm" className="gap-1.5">
              <PlusCircle className="w-4 h-4" /> Kasir Pembayaran
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial Stat Cards (Context / Metric Bar) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: Today Income */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Penerimaan Hari Ini
              </span>
              <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-stone-900 tabular-nums font-mono">
              Rp {cashSummary.todayIncome.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-stone-500 mt-0.5 block">Kasir pembayaran</span>
          </Card>

          {/* Card 2: Total Paid */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Sudah Terbayar
              </span>
              <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-blue-800 tabular-nums font-mono">
              Rp {billingSummary.totalPaidAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-stone-500 mt-0.5 block">{billingSummary.paidCount} tagihan lunas</span>
          </Card>

          {/* Card 3: Remaining Outstanding */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Sisa Tunggakan
              </span>
              <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-amber-800 tabular-nums font-mono">
              Rp {billingSummary.totalOutstandingAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-stone-500 mt-0.5 block">
              {billingSummary.unpaidCount + billingSummary.partialCount} belum beres
            </span>
          </Card>

          {/* Card 4: Overdue */}
          <Card className="p-4 border-rose-200 bg-rose-50/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                Jatuh Tempo (Overdue)
              </span>
              <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-rose-800 tabular-nums font-mono">
              Rp {billingSummary.overdueAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-rose-600 font-medium mt-0.5 block">
              {billingSummary.overdueCount} tagihan lewat batas
            </span>
          </Card>

          {/* Card 5: Net Cashbook Balance */}
          <Card className="p-4 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Saldo Buku Kas Umum
              </span>
              <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-stone-900 tabular-nums font-mono">
              Rp {cashSummary.netBalance.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-stone-500 mt-0.5 block">Total Masuk - Keluar</span>
          </Card>
        </div>
      )}

      {/* Sub-module Navigation Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
          Modul & Alur Operasional Keuangan
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <Link
            href="/finance/payments"
            className="group rounded-lg border border-stone-200 bg-white p-4 shadow-2xs hover:border-teal-600 hover:shadow-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mb-3">
              <CreditCard className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 group-hover:text-teal-800 transition-colors flex items-center justify-between text-sm">
              <span>Kasir & Transaksi Pembayaran</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Penerimaan pembayaran SPP/syahriah, multi-alokasi atomik, dan bukti kwitansi resmi.
            </p>
          </Link>

          <Link
            href="/finance/charges"
            className="group rounded-lg border border-stone-200 bg-white p-4 shadow-2xs hover:border-teal-600 hover:shadow-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center mb-3">
              <Receipt className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 group-hover:text-teal-800 transition-colors flex items-center justify-between text-sm">
              <span>Kewajiban Tagihan Siswa</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Penerbitan tagihan tunggal atau massal per rombel dengan proteksi duplikasi.
            </p>
          </Link>

          <Link
            href="/finance/cashbook"
            className="group rounded-lg border border-stone-200 bg-white p-4 shadow-2xs hover:border-teal-600 hover:shadow-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center mb-3">
              <DollarSign className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 group-hover:text-teal-800 transition-colors flex items-center justify-between text-sm">
              <span>Buku Kas Umum (BKU)</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Mutasi kas masuk otomatis dari kasir dan mutasi belanja operasional lembaga.
            </p>
          </Link>

          <Link
            href="/finance/fees"
            className="group rounded-lg border border-stone-200 bg-white p-4 shadow-2xs hover:border-teal-600 hover:shadow-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mb-3">
              <BookOpen className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 group-hover:text-teal-800 transition-colors flex items-center justify-between text-sm">
              <span>Master Kategori Biaya</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Atur acuan nominal SPP bulanan, uang pangkal, seragam, dan pos syahriah.
            </p>
          </Link>

          <Link
            href="/finance/reports"
            className="group rounded-lg border border-stone-200 bg-white p-4 shadow-2xs hover:border-teal-600 hover:shadow-xs transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-stone-100 text-stone-700 border border-stone-200 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 group-hover:text-teal-800 transition-colors flex items-center justify-between text-sm">
              <span>Laporan & Export Excel</span>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 group-hover:text-teal-700 transition-transform" />
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              Rekap pembayaran berkala, monitoring tunggakan, arus kas, dan unduh CSV.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
