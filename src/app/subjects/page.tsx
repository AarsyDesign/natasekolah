"use client";

import React, { useState, useEffect, useTransition } from "react";
import { NavHeader } from "../../components/nav-header";
import {
  getSubjectsAction,
  createSubjectAction,
  updateSubjectAction,
} from "../../actions/teaching";
import {
  BookOpen,
  Plus,
  Search,
  AlertCircle,
  X,
  Edit2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
  shortName: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string | Date;
  _count?: {
    teacherAssignments: number;
  };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    shortName: "",
    category: "UMUM",
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSubjectsAction({
        search: searchQuery.trim() || undefined,
        isActive: activeFilter === "all" ? undefined : activeFilter === "active",
      });

      if (res.success && res.data) {
        setSubjects(((res.data as any).items || (res.data as any).data || []) as SubjectItem[]);
      } else {
        setError(res.error || "Gagal memuat mata pelajaran.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, activeFilter]);

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({
      name: "",
      code: "",
      shortName: "",
      category: "UMUM",
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (sub: SubjectItem) => {
    setEditingSubject(sub);
    setFormData({
      name: sub.name,
      code: sub.code || "",
      shortName: sub.shortName || "",
      category: sub.category || "UMUM",
      isActive: sub.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const payload = {
        name: formData.name,
        code: formData.code.trim() ? formData.code.trim().toUpperCase() : null,
        shortName: formData.shortName.trim() || null,
        category: formData.category || null,
        isActive: formData.isActive,
      };

      let res;
      if (editingSubject) {
        res = await updateSubjectAction(editingSubject.id, payload);
      } else {
        res = await createSubjectAction(payload);
      }

      if (res.success) {
        setIsModalOpen(false);
        loadData();
      } else {
        setFormError(res.error || "Gagal menyimpan mata pelajaran.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Kurikulum & Pembelajaran" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Mata Pelajaran
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Katalog kurikulum pembelajaran lembaga yang diampu oleh dewan guru.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Mapel</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Cari nama mata pelajaran atau kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-xs text-stone-800 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-600">Status:</span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="touch-target rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 focus:border-teal-700 focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="active">Hanya Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-800 border-t-transparent" />
            <p className="mt-3 text-sm text-stone-500">Memuat katalog mata pelajaran...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <BookOpen className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Belum Ada Mata Pelajaran</h3>
            <p className="mt-1 text-sm text-stone-500">
              Tambahkan mata pelajaran kurikulum (cth: Matematika, Bahasa Indonesia, Fiqih).
            </p>
            <button
              onClick={openCreateModal}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Mapel Baru</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-stone-300"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {sub.code || "NON-KODE"}
                        </span>
                        {sub.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                            <XCircle className="h-3 w-3" /> Nonaktif
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-stone-900">{sub.name}</h3>
                      {sub.shortName && (
                        <div className="text-xs text-stone-500">Alias: {sub.shortName}</div>
                      )}
                    </div>
                    <button
                      onClick={() => openEditModal(sub)}
                      title="Edit Mata Pelajaran"
                      className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-stone-600">
                    <span className="font-medium text-stone-500">Kategori:</span>
                    <span className="rounded bg-stone-100 px-2 py-0.5 font-medium text-stone-800">
                      {sub.category || "UMUM"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                  <div className="flex items-center gap-1.5 font-medium text-stone-800">
                    <BookOpen className="h-3.5 w-3.5 text-teal-800" />
                    <span>{sub._count?.teacherAssignments || 0} Pengajar Terdaftar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Tambah / Edit Mapel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">
                {editingSubject ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="touch-target rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Nama Mata Pelajaran *
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth. Matematika, Fiqih Ibadah"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Kode Mapel (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="cth. MTK, BIND"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm uppercase focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Nama Pendek
                  </label>
                  <input
                    type="text"
                    placeholder="cth. MTK"
                    value={formData.shortName}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Kategori</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  >
                    <option value="UMUM">UMUM</option>
                    <option value="AGAMA">AGAMA</option>
                    <option value="MULOK">MULOK</option>
                    <option value="PEMINATAN">PEMINATAN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Status Aktif</label>
                  <select
                    value={formData.isActive ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "true" })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !formData.name.trim()}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
