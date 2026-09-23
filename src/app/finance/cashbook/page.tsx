"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listCashbookEntriesAction,
  createCashbookEntryAction,
  getCashbookSummaryAction,
} from "@/actions/finance";
import { generateCashbookCSV, downloadCSV } from "@/lib/finance/export-utils";
import {
  DollarSign,
  Plus,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Download,
  Receipt,
  FileText,
  Filter,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface CashbookItem {
  id: string;
  entryNumber: string;
  entryDate: string;
  type: string;
  amount: number;
  description: string;
  paymentTransactionId?: string | null;
  paymentTransaction?: {
    transactionNumber: string;
    student: {
      fullName: string;
    };
  } | null;
  createdBy: {
    name: string;
  };
}

export default function CashbookPage() {
  const [items, setItems] = useState<CashbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    todayIncome: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);

  const [formType, setFormType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formDescription, setFormDescription] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        listCashbookEntriesAction({
          search: search || undefined,
          type: typeFilter === "ALL" ? undefined : (typeFilter as any),
          limit: 100,
        }),
        getCashbookSummaryAction(),
      ]);

      if (listRes.success && listRes.data) {
        setItems(listRes.data.items as any);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load cashbook", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleOpenCreate = () => {
    setFormType("EXPENSE");
    setFormAmount("");
    setFormDescription("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formAmount === "" || !formDescription) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await createCashbookEntryAction({
          type: formType,
          amount: Number(formAmount),
          description: formDescription,
        });

        if (res.success) {
          setMessage({
            type: "success",
            text: `Mutasi kas [${formType === "EXPENSE" ? "PENGELUARAN" : "PEMASUKAN"}] berhasil dicatat.`,
          });
          setModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleExportCSV = () => {
    const csvContent = generateCashbookCSV(
      items.map((i) => ({
        entryNumber: i.entryNumber,
        entryDate: i.entryDate,
        type: i.type,
        amount: i.amount,
        description: i.description,
        createdByName: i.createdBy?.name,
        paymentRef: i.paymentTransaction
          ? `${i.paymentTransaction.transactionNumber} (${i.paymentTransaction.student.fullName})`
          : null,
      }))
    );
    downloadCSV(`Buku_Kas_Umum_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-teal-600" /> Buku Kas Umum (BKU)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pencatatan arus kas masuk dari kasir dan mutasi pengeluaran operasional lembaga
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={items.length === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-xs hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white font-medium rounded-xl shadow-xs hover:bg-teal-700 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Catat Kas Manual
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold underline">
              Tutup
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Pemasukan
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-700">
              Rp {summary.totalIncome.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Kas masuk terakumulasi</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Pengeluaran
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-rose-600">
              Rp {summary.totalExpense.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Operasional & belanja</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Saldo Bersih BKU
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-xl font-bold ${
                summary.netBalance >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              Rp {summary.netBalance.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Total Masuk - Total Keluar</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Penerimaan Hari Ini
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-blue-700">
              Rp {summary.todayIncome.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">Kasir pembayaran hari ini</span>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData();
            }}
            className="flex-1 relative"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari no. kas (CSH-...) atau keterangan mutasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white min-h-[44px]"
            />
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="INCOME">Pemasukan (INCOME)</option>
              <option value="EXPENSE">Pengeluaran (EXPENSE)</option>
            </select>
          </div>
        </div>

        {/* Entries Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
            Memuat mutasi buku kas umum...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700">Belum Ada Catatan Kas</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Setiap transaksi pembayaran kasir dan pencatatan manual akan otomatis terbit di sini.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">No. Kas</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Nominal</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3">Sumber Mutasi</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-900">
                        {item.entryNumber}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(item.entryDate).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.type === "INCOME" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <ArrowUpRight className="w-3.5 h-3.5" /> Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <ArrowDownRight className="w-3.5 h-3.5" /> Keluar
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3.5 font-bold ${
                          item.type === "INCOME" ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {item.type === "INCOME" ? "+" : "-"} Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {item.paymentTransaction ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                            <Receipt className="w-3 h-3" /> Kasir Pembayaran
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            <FileText className="w-3 h-3" /> Manual Operasional
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{item.createdBy?.name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Manual Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Catat Mutasi Kas Manual</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Mutasi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("EXPENSE")}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border min-h-[44px] flex items-center justify-center gap-1.5 transition-all ${
                      formType === "EXPENSE"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    <span>Pengeluaran</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType("INCOME")}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border min-h-[44px] flex items-center justify-center gap-1.5 transition-all ${
                      formType === "INCOME"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    <span>Pemasukan Lain</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="50000"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan / Keperluan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contoh: Pembelian spidol whiteboard dan ATK kantor"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 rounded-xl shadow-xs disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Mutasi Kas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
