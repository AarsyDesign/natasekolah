"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavHeader } from "../../../components/nav-header";
import {
  getStudentByIdAction,
  getAcademicYearsAction,
  getClassroomsAction,
  enrollStudentAction,
  archiveStudentAction,
} from "../../../actions/academic";
import {
  ArrowLeft,
  Calendar,
  School,
  History,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Clock,
  Archive,
  PlusCircle,
  X,
} from "lucide-react";

export default function StudentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [student, setStudent] = useState<any>(null);
  const [currentEnrollment, setCurrentEnrollment] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enroll modal state
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Archive modal state
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState("GRADUATED");

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentByIdAction(id);
      if (res.success && res.data) {
        setStudent(res.data.student);
        setCurrentEnrollment(res.data.currentEnrollment);
        setHistory(res.data.history);
      } else {
        setError(res.error || "Gagal memuat profil siswa.");
      }

      // Load years and classrooms for enrollment modal
      const [yearsRes, roomsRes] = await Promise.all([
        getAcademicYearsAction(),
        getClassroomsAction(),
      ]);

      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data);
        const active = yearsRes.data.find((y: any) => y.isActive);
        if (active) setSelectedYearId(active.id);
      }
      if (roomsRes.success && roomsRes.data) {
        setClassrooms(roomsRes.data);
      }
    } catch {
      setError("Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);

    startTransition(async () => {
      const res = await enrollStudentAction({
        studentId: id,
        academicYearId: selectedYearId,
        classroomId: selectedClassroomId,
        status: "ENROLLED",
      });

      if (res.success) {
        setIsEnrollModalOpen(false);
        loadData();
      } else {
        setEnrollError(res.error || "Gagal melakukan enrollment.");
      }
    });
  };

  const handleArchiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const res = await archiveStudentAction(id, {
        status: archiveStatus,
      });

      if (res.success) {
        setIsArchiveModalOpen(false);
        loadData();
      } else {
        alert(res.error || "Gagal mengubah status.");
      }
    });
  };

  const filteredClassrooms = classrooms.filter(
    (c) => c.academicYearId === selectedYearId
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavHeader subtitle="Profil Buku Induk" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/students"
            className="touch-target inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Buku Induk</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsArchiveModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Archive className="h-3.5 w-3.5 text-stone-500" />
              <span>Ubah Status / Arsip</span>
            </button>

            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Penempatan Rombel</span>
            </button>
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
            <p className="mt-3 text-sm text-stone-500">Memuat profil siswa...</p>
          </div>
        ) : !student ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-sm text-stone-500">Siswa tidak ditemukan.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Identity Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                      {student.fullName}
                    </h1>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        student.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-700"
                      }`}
                    >
                      {student.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                    <div>
                      NIS: <span className="font-mono font-semibold text-stone-900">{student.nis}</span>
                    </div>
                    {student.nisn && (
                      <div>
                        NISN: <span className="font-mono font-semibold text-stone-900">{student.nisn}</span>
                      </div>
                    )}
                    {student.nik && (
                      <div>
                        NIK: <span className="font-mono text-stone-700">{student.nik}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner Status Rombel Saat Ini */}
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-left sm:text-right">
                  <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Rombel Tahun Aktif
                  </div>
                  {currentEnrollment?.classroom ? (
                    <div className="mt-1">
                      <span className="text-lg font-bold text-teal-800">
                        {currentEnrollment.classroom.name}
                      </span>
                      <div className="text-xs text-stone-500">
                        {currentEnrollment.academicYear.name}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs italic text-stone-400">
                      Belum terdaftar di rombel tahun ini
                    </div>
                  )}
                </div>
              </div>

              {/* Biodata details grid */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-stone-100 pt-6 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-stone-500">Jenis Kelamin</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.gender === "L" ? "Laki-laki" : "Perempuan"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Tempat, Tanggal Lahir</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.birthPlace || "-"}
                    {student.birthDate
                      ? `, ${new Date(student.birthDate).toLocaleDateString("id-ID")}`
                      : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500">Alamat Rumah</div>
                  <div className="mt-1 text-sm font-medium text-stone-800">
                    {student.address || "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Sacred History: Riwayat Penempatan Kelas (Enrollment History) */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
                <History className="h-5 w-5 text-teal-800" />
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    Histori Penempatan Kelas (Sacred History)
                  </h2>
                  <p className="text-xs text-stone-500">
                    Rekam jejak akademik abadi per tahun ajaran yang tidak pernah tertimpa saat naik kelas.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="py-8 text-center text-sm text-stone-400">
                  Belum ada catatan enrollment tersimpan untuk siswa ini.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800">
                          <School className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900">
                            {record.classroom.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500">
                            <Calendar className="h-3.5 w-3.5 text-stone-400" />
                            <span>Tahun Ajaran {record.academicYear.name}</span>
                            {record.academicYear.isActive && (
                              <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-semibold text-teal-800">
                                Aktif
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="rounded-full bg-stone-200/70 px-2.5 py-0.5 font-medium text-stone-700">
                          {record.status}
                        </span>
                        <span className="text-stone-400">
                          Terdaftar: {new Date(record.enrolledAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Enroll Siswa */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Penempatan Rombel Baru</h3>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="touch-target rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {enrollError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {enrollError}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Tahun Ajaran *</label>
                <select
                  value={selectedYearId}
                  onChange={(e) => {
                    setSelectedYearId(e.target.value);
                    setSelectedClassroomId("");
                  }}
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
                <label className="block text-xs font-semibold text-stone-700">
                  Rombongan Belajar (Kelas) *
                </label>
                <select
                  required
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  disabled={!selectedYearId}
                >
                  <option value="">Pilih Rombel...</option>
                  {filteredClassrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.gradeLevel ? `(Tingkat ${c.gradeLevel})` : ""}
                    </option>
                  ))}
                </select>
                {filteredClassrooms.length === 0 && selectedYearId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Belum ada rombel pada tahun ajaran ini. Tambahkan rombel terlebih dahulu di menu Rombongan Belajar.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedClassroomId}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Daftarkan ke Rombel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubah Status / Arsip */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Ubah Status Siswa</h3>
            <p className="mt-1 text-xs text-stone-500">
              Perubahan status mempertahankan seluruh histori rombel dan pembayaran siswa secara abadi.
            </p>

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Pilih Status Baru</label>
                <select
                  value={archiveStatus}
                  onChange={(e) => setArchiveStatus(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="GRADUATED">Lulus (GRADUATED)</option>
                  <option value="TRANSFERRED">Pindah / Mutasi (TRANSFERRED)</option>
                  <option value="ALUMNI">Alumni (ALUMNI)</option>
                  <option value="INACTIVE">Nonaktif (INACTIVE)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
