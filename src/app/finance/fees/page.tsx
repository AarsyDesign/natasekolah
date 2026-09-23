"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listFeeCategoriesAction,
  createFeeCategoryAction,
  updateFeeCategoryAction,
} from "@/actions/finance";
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit2,
  X,
} from "lucide-react";

interface FeeCategoryItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amount: number;
  frequency: string;
  isActive: boolean;
  createdAt: string;
}

export default function FeeCategoriesPage() {
  const [items, setItems] = useState<FeeCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formFrequency, setFormFrequency] = useState("MONTHLY");
  const [formIsActive, setFormIsActive] = useState(true);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listFeeCategoriesAction({ search: search || undefined, limit: 100 });
      if (res.success && res.data) {
        setItems(res.data.items as any);
      }
    } catch (err: unknown) {
      console.error("Failed to load fee categories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setFormCode("");
    setFormName("");
    setFormDesc("");
    setFormAmount("");
    setFormFrequency("MONTHLY");
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: FeeCategoryItem) => {
    setEditId(item.id);
    setFormCode(item.code);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormAmount(item.amount);
    setFormFrequency(item.frequency);
    setFormIsActive(item.isActive);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formName || formAmount === "") return;

    setMessage(null);
    startTransition(async () => {
      try {
        if (editId) {
          const res = await updateFeeCategoryAction(editId, {
            code: formCode,
            name: formName,
            description: formDesc || null,
            amount: Number(formAmount),
            frequency: formFrequency as any,
            isActive: formIsActive,
          });
          if (res.success) {
            setMessage({ type: "success", text: "Kategori biaya berhasil diperbarui." });
            setModalOpen(false);
            loadData();
          }
        } else {
          const res = await createFeeCategoryAction({
            code: formCode,
            name: formName,
            description: formDesc || null,
            amount: Number(formAmount),
            frequency: formFrequency as any,
            isActive: formIsActive,
          });
          if (res.success) {
            setMessage({ type: "success", text: "Kategori biaya baru berhasil dibuat." });
            setModalOpen(false);
            loadData();
          }
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-amber-600" /> Master Kategori Biaya
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Atur komponen biaya dan syahriah lembaga (Perubahan acuan tidak mengubah tagihan historis)
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-700 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Kategori Baru
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

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex gap-3">
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
              placeholder="Cari kode atau nama kategori biaya..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[44px]"
            />
          </form>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat master kategori biaya...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Belum ada kategori biaya yang terdaftar.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Kode</th>
                    <th className="px-4 py-3.5">Nama Kategori</th>
                    <th className="px-4 py-3.5">Frekuensi</th>
                    <th className="px-4 py-3.5">Nominal Acuan</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {item.code}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-slate-400">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">
                          {item.frequency}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        {item.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3.5 h-3.5" /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
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
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">
                {editId ? "Edit Kategori Biaya" : "Tambah Kategori Biaya Baru"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kode Kategori (misal SPP, PANGKAL)
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono min-h-[44px]"
                  placeholder="SPP"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Kategori Biaya
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  placeholder="SPP Syahriah Bulanan"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  placeholder="Catatan tambahan (opsional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal Acuan (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formAmount}
                    onChange={(e) =>
                      setFormAmount(e.target.value ? Number(e.target.value) : "")
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                    placeholder="150000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Frekuensi</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  >
                    <option value="MONTHLY">Bulanan (MONTHLY)</option>
                    <option value="ONE_TIME">Satu Kali (ONE_TIME)</option>
                    <option value="ANNUAL">Tahunan (ANNUAL)</option>
                    <option value="CUSTOM">Khusus (CUSTOM)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Kategori Aktif
                </label>
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
                  {isPending ? "Menyimpan..." : "Simpan Kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
