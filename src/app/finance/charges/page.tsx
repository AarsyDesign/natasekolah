"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listStudentChargesAction,
  createStudentChargeAction,
  listFeeCategoriesAction,
  voidStudentChargeAction,
} from "@/actions/finance";
import { getStudentsAction } from "@/actions/academic";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  X,
  Ban,
} from "lucide-react";

interface ChargeItem {
  id: string;
  studentId: string;
  amount: number;
  allocatedAmount: number;
  remainingAmount: number;
  period?: string | null;
  status: string;
  createdAt: string;
  student: {
    fullName: string;
    nis: string;
  };
  feeCategory: {
    code: string;
    name: string;
  };
}

export default function StudentChargesPage() {
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  const [students, setStudents] = useState<Array<{ id: string; fullName: string; nis: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; amount: number }>>([]);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState("");
  const [period, setPeriod] = useState("2026-09");
  const [amount, setAmount] = useState<number | "">("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listStudentChargesAction({
        search: search || undefined,
        status: statusFilter === "ALL" ? undefined : (statusFilter as any),
        limit: 100,
      });
      if (res.success && res.data) {
        setItems(res.data.items as any);
      }
    } catch (err: unknown) {
      console.error("Failed to load charges", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleOpenCreate = async () => {
    setSelectedStudentId("");
    setSelectedFeeCategoryId("");
    setPeriod("2026-09");
    setAmount("");
    setModalOpen(true);

    // Load active students and categories
    try {
      const [stRes, catRes] = await Promise.all([
        getStudentsAction({ limit: 100 }),
        listFeeCategoriesAction({ isActive: true, limit: 100 }),
      ]);
      if (stRes.success && stRes.data) setStudents(stRes.data.data as any);
      if (catRes.success && catRes.data) setCategories(catRes.data.items as any);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedFeeCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      setAmount(cat.amount);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedFeeCategoryId || amount === "") return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await createStudentChargeAction({
          studentId: selectedStudentId,
          feeCategoryId: selectedFeeCategoryId,
          period: period || null,
          amount: Number(amount),
        });

        if (res.success) {
          setMessage({ type: "success", text: "Kewajiban tagihan berhasil diterbitkan." });
          setModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleVoid = (id: string) => {
    if (!confirm("Void / batalkan tagihan ini? (Tagihan berstatus VOID tidak dapat dibayar)")) return;

    startTransition(async () => {
      try {
        const res = await voidStudentChargeAction(id);
        if (res.success) {
          setMessage({ type: "success", text: "Tagihan berhasil di-void." });
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> LUNAS
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> SEBAGIAN
          </span>
        );
      case "VOID":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" /> VOID
          </span>
        );
      case "UNPAID":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> BELUM BAYAR
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-purple-600" /> Kewajiban Tagihan Siswa
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Daftar tagihan siswa dengan nominal snapshot abadi yang dihitung dari transaksi real-time
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-700 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Terbitkan Tagihan
          </button>
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
              placeholder="Cari siswa (NIS/Nama) atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[44px]"
            />
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "UNPAID", "PARTIAL", "PAID", "VOID"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border min-h-[44px] ${
                  statusFilter === st
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {st === "ALL" ? "Semua Status" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat daftar kewajiban tagihan...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Belum ada data tagihan yang ditemukan.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Siswa</th>
                    <th className="px-4 py-3.5">Kategori / Periode</th>
                    <th className="px-4 py-3.5">Nominal Tagihan</th>
                    <th className="px-4 py-3.5">Terbayar</th>
                    <th className="px-4 py-3.5">Sisa Tagihan</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{item.student.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">NIS: {item.student.nis}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{item.feeCategory.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          Periode: {item.period || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-blue-700 font-medium">
                        Rp {item.allocatedAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-rose-600 font-bold">
                        Rp {item.remainingAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {item.status !== "VOID" && item.allocatedAmount === 0 && (
                          <button
                            onClick={() => handleVoid(item.id)}
                            title="Void Tagihan"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Terbit Kewajiban Tagihan Baru</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} (NIS: {st.nis})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Biaya
                </label>
                <select
                  required
                  value={selectedFeeCategoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                >
                  <option value="">-- Pilih Kategori Biaya --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Acuan: Rp {c.amount.toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periode (YYYY-MM)
                  </label>
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026-09"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal Snapshot (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                    placeholder="150000"
                  />
                </div>
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
                  {isPending ? "Menerbitkan..." : "Terbitkan Tagihan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
