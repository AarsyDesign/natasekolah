"use client";

import React, { useState, useEffect, useTransition } from "react";
import { NavHeader } from "../../components/nav-header";
import {
  getClassroomsAction,
  getAcademicYearsAction,
  createClassroomAction,
} from "../../actions/academic";
import {
  School,
  Plus,
  Filter,
  Users,
  AlertCircle,
  Calendar,
  X,
} from "lucide-react";

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    name: "",
    gradeLevel: "",
    capacity: 30,
    academicYearId: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsRes, yearsRes] = await Promise.all([
        getClassroomsAction(selectedYearFilter || undefined),
        getAcademicYearsAction(),
      ]);

      if (roomsRes.success && roomsRes.data) {
        setClassrooms(roomsRes.data);
      } else {
        setError(roomsRes.error || "Gagal memuat daftar rombel.");
      }

      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data);
        if (!formData.academicYearId) {
          const active = yearsRes.data.find((y: any) => y.isActive);
          if (active) {
            setFormData((prev) => ({ ...prev, academicYearId: active.id }));
          }
        }
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYearFilter]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createClassroomAction({
        name: formData.name,
        gradeLevel: formData.gradeLevel || undefined,
        capacity: Number(formData.capacity) || undefined,
        academicYearId: formData.academicYearId,
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData((prev) => ({ ...prev, name: "", gradeLevel: "", capacity: 30 }));
        loadData();
      } else {
        setFormError(res.error || "Gagal membuat rombel.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Struktur Akademik" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Rombongan Belajar (Kelas)
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Pengorganisasian ruang belajar peserta didik terikat pada tahun akademik resmi.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Rombel</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <Filter className="h-4 w-4 text-stone-400" />
          <span className="text-xs font-semibold text-stone-700">Filter Tahun Ajaran:</span>
          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="touch-target rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 focus:border-teal-700 focus:bg-white focus:outline-none"
          >
            <option value="">Semua Tahun Ajaran</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isActive ? "(Aktif)" : ""}
              </option>
            ))}
          </select>
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
            <p className="mt-3 text-sm text-stone-500">Memuat rombongan belajar...</p>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <School className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Belum Ada Rombel</h3>
            <p className="mt-1 text-sm text-stone-500">
              Buat rombel baru (misal: VII A, X IPA 1) untuk tahun ajaran yang telah tersedia.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Rombel Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition hover:border-stone-300"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-stone-900">{room.name}</h3>
                      <div className="text-xs text-stone-500">
                        {room.gradeLevel ? `Tingkat: ${room.gradeLevel}` : "Reguler"}
                      </div>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800">
                      <School className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-stone-600">
                    <Calendar className="h-3.5 w-3.5 text-stone-400" />
                    <span>Tahun Ajaran: {room.academicYear?.name}</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                  <div className="flex items-center gap-1.5 font-medium text-stone-800">
                    <Users className="h-3.5 w-3.5 text-teal-800" />
                    <span>{room._count?.enrollments || 0} Siswa Terdaftar</span>
                  </div>
                  {room.capacity && (
                    <span>Kapasitas: {room.capacity}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Tambah Rombel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Tambah Rombel Baru</h3>
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
                <label className="block text-xs font-semibold text-stone-700">Tahun Ajaran *</label>
                <select
                  required
                  value={formData.academicYearId}
                  onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Pilih Tahun Ajaran...</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isActive ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Nama Kelas / Rombel *</label>
                <input
                  type="text"
                  required
                  placeholder="cth. VII A, 10 IPA 1, Halaqah Ula"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tingkat Kelas</label>
                  <input
                    type="text"
                    placeholder="cth. 7, VII, 10"
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Kapasitas Maksimal</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
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
                  disabled={isPending || !formData.academicYearId}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Rombel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
