"use client";

import React, { useState, useEffect, useTransition } from "react";
import { NavHeader } from "../../components/nav-header";
import {
  getAcademicYearsAction,
  createAcademicYearAction,
  setActiveAcademicYearAction,
} from "../../actions/academic";
import {
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  School,
  X,
} from "lucide-react";

export default function AcademicYearsPage() {
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isActive: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchYears = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAcademicYearsAction();
      if (res.success && res.data) {
        setYears(res.data);
      } else {
        setError(res.error || "Gagal memuat tahun ajaran.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createAcademicYearAction({
        name: formData.name,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        isActive: formData.isActive,
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData({ name: "", startDate: "", endDate: "", isActive: false });
        fetchYears();
      } else {
        setFormError(res.error || "Gagal membuat tahun ajaran.");
      }
    });
  };

  const handleActivate = (id: string) => {
    startTransition(async () => {
      const res = await setActiveAcademicYearAction(id);
      if (res.success) {
        fetchYears();
      } else {
        alert(res.error || "Gagal mengaktifkan tahun ajaran.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Struktur Akademik" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Tahun Ajaran
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Pengaturan siklus kalender pendidikan dan penetapan tahun akademik aktif lembaga.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Tahun Ajaran</span>
          </button>
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
            <p className="mt-3 text-sm text-stone-500">Memuat daftar tahun ajaran...</p>
          </div>
        ) : years.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <Calendar className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Belum Ada Tahun Ajaran</h3>
            <p className="mt-1 text-sm text-stone-500">
              Buat tahun ajaran pertama untuk memulai pengelompokan kelas dan enrollment siswa.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {years.map((year) => (
              <div
                key={year.id}
                className={`flex flex-col justify-between rounded-2xl border p-6 shadow-xs transition ${
                  year.isActive
                    ? "border-teal-700 bg-white ring-2 ring-teal-700/20"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xl font-bold tracking-tight text-stone-900">
                        {year.name}
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        {year._count?.classrooms || 0} Rombel • {year._count?.enrollments || 0} Siswa Terdaftar
                      </div>
                    </div>

                    {year.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aktif</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivate(year.id)}
                        disabled={isPending}
                        className="touch-target rounded-lg border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                      >
                        Jadikan Aktif
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-4 text-xs text-stone-500">
                    <div>
                      Mulai:{" "}
                      <span className="font-medium text-stone-700">
                        {year.startDate
                          ? new Date(year.startDate).toLocaleDateString("id-ID")
                          : "Belum diset"}
                      </span>
                    </div>
                    <div>
                      Selesai:{" "}
                      <span className="font-medium text-stone-700">
                        {year.endDate
                          ? new Date(year.endDate).toLocaleDateString("id-ID")
                          : "Belum diset"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Tambah Tahun Ajaran */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Tambah Tahun Ajaran Baru</h3>
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

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Nama Tahun Ajaran *
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth. 2026/2027"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 text-teal-800 focus:ring-teal-700"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-stone-700">
                  Tetapkan sebagai Tahun Ajaran Aktif saat ini
                </label>
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
                  disabled={isPending}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Tahun Ajaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
