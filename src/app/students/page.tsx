"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "../../components/nav-header";
import {
  getStudentsAction,
  createStudentAction,
} from "../../actions/academic";
import {
  Search,
  UserPlus,
  Filter,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  FileSpreadsheet,
} from "lucide-react";
import { StudentImportModal } from "../../components/importer/student-import-modal";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    nis: "",
    nisn: "",
    nik: "",
    gender: "L",
    birthPlace: "",
    birthDate: "",
    address: "",
    phone: "",
    email: "",
    status: "ACTIVE",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentsAction({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: 15,
      });

      if (res.success && res.data) {
        setStudents(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      } else {
        setError(res.error || "Gagal memuat data.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const res = await createStudentAction({
        ...formData,
        birthDate: formData.birthDate ? new Date(formData.birthDate) : undefined,
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormData({
          fullName: "",
          nis: "",
          nisn: "",
          nik: "",
          gender: "L",
          birthPlace: "",
          birthDate: "",
          address: "",
          phone: "",
          email: "",
          status: "ACTIVE",
        });
        fetchStudents();
      } else {
        setFormError(res.error || "Gagal menyimpan siswa.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Buku Induk Kesiswaan" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Buku Induk Siswa
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Pengelolaan biodata primer peserta didik dengan catatan historis terpadu.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-800 shadow-xs transition hover:bg-stone-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-teal-800" />
              <span>Impor Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="touch-target inline-flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" />
              <span>Tambah Siswa</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nama, NIS, atau NISN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="touch-target w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-4 text-sm text-stone-900 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </form>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-stone-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="touch-target rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-teal-700 focus:bg-white focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
              <option value="GRADUATED">Lulus</option>
              <option value="TRANSFERRED">Mutasi / Pindah</option>
              <option value="ALUMNI">Alumni</option>
            </select>

            <button
              onClick={handleSearchSubmit}
              className="touch-target rounded-lg bg-stone-200 px-4 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-300"
            >
              Cari
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Table / Cards */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-8 text-center shadow-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-800 border-t-transparent" />
            <p className="mt-3 text-sm text-stone-500">Memuat data Buku Induk...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-xs">
            <GraduationCap className="h-12 w-12 text-stone-300" />
            <h3 className="mt-2 text-base font-semibold text-stone-800">Belum Ada Siswa</h3>
            <p className="mt-1 text-sm text-stone-500">
              Tidak ada data siswa yang cocok dengan filter atau pencarian Anda.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <UserPlus className="h-4 w-4" />
              <span>Daftarkan Siswa Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-6 py-3.5">Nama & Biodata</th>
                    <th className="px-6 py-3.5">NIS / NISN</th>
                    <th className="px-6 py-3.5">Rombel Saat Ini</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 bg-white">
                  {students.map((student) => {
                    const currentEnrollment = student.enrollments?.[0];
                    return (
                      <tr key={student.id} className="transition hover:bg-stone-50/80">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-stone-900">{student.fullName}</div>
                          <div className="text-xs text-stone-500">
                            {student.gender === "L" ? "Laki-laki" : "Perempuan"}
                            {student.birthPlace ? ` • ${student.birthPlace}` : ""}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-semibold text-stone-900">
                            {student.nis}
                          </div>
                          {student.nisn && (
                            <div className="font-mono text-xs text-stone-500">
                              NISN: {student.nisn}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {currentEnrollment?.classroom ? (
                            <span className="inline-flex items-center rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800">
                              {currentEnrollment.classroom.name}
                            </span>
                          ) : (
                            <span className="text-xs italic text-stone-400">
                              Belum terdaftar
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              student.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : student.status === "GRADUATED"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/students/${student.id}`}
                            className="touch-target inline-flex items-center text-xs font-semibold text-teal-800 hover:text-teal-950"
                          >
                            Lihat Profil →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-stone-200 px-6 py-3 text-sm text-stone-600">
              <div>
                Menampilkan <span className="font-semibold">{students.length}</span> dari{" "}
                <span className="font-semibold">{total}</span> siswa
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="touch-target inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Sebelumnya</span>
                </button>
                <span className="text-xs font-medium">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="touch-target inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-40"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Tambah Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-stone-900">Tambah Siswa Baru</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="touch-target rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                    placeholder="cth. Muhammad Fatih"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    NIS (Nomor Induk Siswa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nis}
                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                    placeholder="cth. 2026001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">NISN (10 Digit)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.nisn}
                    onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                    placeholder="0012345678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Jenis Kelamin *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                    placeholder="cth. Bandung"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Alamat Rumah</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-200 p-2 text-sm focus:border-teal-700 focus:outline-none"
                  placeholder="Alamat domisili lengkap..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
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
                  {isPending ? "Menyimpan..." : "Simpan Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Impor Excel */}
      <StudentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchStudents();
        }}
      />
    </div>
  );
}
