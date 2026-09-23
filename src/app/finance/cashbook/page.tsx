"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listCashbookEntriesAction,
  createCashbookEntryAction,
  getCashbookSummaryAction,
} from "@/actions/finance";
import {
  DollarSign,
  Plus,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";

interface CashbookItem {
  id: string;
  entryNumber: string;
  entryDate: string;
  type: string;
  amount: number;
  description: string;
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
  });
  const [modalOpen, setModalOpen] = useState(false);

  const [formType, setFormType] = useState("EXPENSE");
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
          type: formType as any,
          amount: Number(formAmount),
          description: formDescription,
        });

        if (res.success) {
          setMessage({ type: "success", text: "Transaksi kas berhasil dicatat." });
          setModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-teal-600" /> Buku Kas Umum (BKU)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Catatan pergerakan kas lembaga (Pemasukan otomatis dari kasir & pengeluaran operasional)
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-700 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Catat Kas
          </button>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Pemasukan</span>
              <div className="text-xl font-bold text-emerald-600">
                Rp {summary.totalIncome.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Pengeluaran</span>
              <div className="text-xl font-bold text-rose-600">
                Rp {summary.totalExpense.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase">Saldo Kas Bersih</span>
              <div className="text-xl font-bold text-slate-900">
                Rp {summary.netBalance.toLocaleString("id-ID")}
              </div>
            </div>
            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

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

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
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
              placeholder="Cari no. kas (CSH-...) atau deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[44px]"
            />
          </form>

          <div className="flex gap-2">
            {["ALL", "INCOME", "EXPENSE"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border min-h-[44px] ${
                  typeFilter === t
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {t === "ALL" ? "Semua Kas" : t === "INCOME" ? "Pemasukan (INCOME)" : "Pengeluaran (EXPENSE)"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat buku kas umum...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Belum ada transaksi kas yang dicatat.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">No. Kas</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Jenis Kas</th>
                    <th className="px-4 py-3.5">Deskripsi</th>
                    <th className="px-4 py-3.5 text-right">Nominal</th>
                    <th className="px-4 py-3.5">Pencatat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {item.entryNumber}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(item.entryDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.type === "INCOME" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ArrowUpRight className="w-3.5 h-3.5" /> PEMASUKAN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ArrowDownRight className="w-3.5 h-3.5" /> PENGELUARAN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-800">{item.description}</td>
                      <td
                        className={`px-4 py-3.5 text-right font-bold ${
                          item.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {item.type === "INCOME" ? "+" : "-"} Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{item.createdBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Catat Transaksi Kas Baru</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Transaksi</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                >
                  <option value="EXPENSE">PENGELUARAN (EXPENSE)</option>
                  <option value="INCOME">PEMASUKAN (INCOME)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal (Rp)
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Kas</label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Keterangan pengeluaran/pemasukan"
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
                  className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Kas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
