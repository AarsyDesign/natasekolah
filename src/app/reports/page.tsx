"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listReportCardsAction,
  generateDraftReportCardAction,
  publishReportCardAction,
  getReportCardAction,
} from "@/actions/formal-academic";
import {
  getStudentsAction,
  getClassroomsAction,
  getAcademicYearsAction,
} from "@/actions/academic";
import {
  Award,
  Plus,
  RefreshCw,
  Printer,
  CheckCircle2,
  Lock,
  FileText,
  Clock,
  X,
  Eye,
  Calendar,
  Layers,
} from "lucide-react";

export default function ReportCardsPage() {
  const [items, setItems] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [semesterFilter, setSemesterFilter] = useState("ALL");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalData, setViewModalData] = useState<any | null>(null);

  // Form states
  const [students, setStudents] = useState<Array<any>>([]);
  const [classrooms, setClassrooms] = useState<Array<any>>([]);
  const [academicYears, setAcademicYears] = useState<Array<any>>([]);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<"ODD" | "EVEN">("ODD");
  const [notes, setNotes] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listReportCardsAction({
        status: statusFilter === "ALL" ? undefined : (statusFilter as any),
        semester: semesterFilter === "ALL" ? undefined : (semesterFilter as any),
        limit: 100,
      });
      if (res.success && res.data) {
        setItems(res.data.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, semesterFilter]);

  const handleOpenCreate = async () => {
    setSelectedStudentId("");
    setSelectedClassroomId("");
    setSelectedAcademicYearId("");
    setSelectedSemester("ODD");
    setNotes("");
    setCreateModalOpen(true);

    try {
      const [stRes, crRes, ayRes] = await Promise.all([
        getStudentsAction({ limit: 100 }),
        getClassroomsAction(),
        getAcademicYearsAction(),
      ]);

      if (stRes.success && stRes.data) setStudents(stRes.data.data);
      if (crRes.success && crRes.data) setClassrooms(crRes.data);
      if (ayRes.success && ayRes.data) {
        setAcademicYears(ayRes.data);
        const activeYear = ayRes.data.find((y: any) => y.isActive);
        if (activeYear) setSelectedAcademicYearId(activeYear.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedClassroomId || !selectedAcademicYearId) return;

    startTransition(async () => {
      const res = await generateDraftReportCardAction({
        studentId: selectedStudentId,
        classroomId: selectedClassroomId,
        academicYearId: selectedAcademicYearId,
        semester: selectedSemester,
        notes: notes || undefined,
      });

      if (res.success && res.data) {
        setMessage({ text: "Draf raport berhasil digenerate!", type: "success" });
        setCreateModalOpen(false);
        setViewModalData(res.data);
        loadData();
      } else {
        setMessage({ text: res.error || "Gagal membuat draf raport.", type: "error" });
      }
    });
  };

  const handleViewDetails = async (id: string) => {
    try {
      const res = await getReportCardAction(id);
      if (res.success && res.data) {
        setViewModalData(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menerbitkan dan membekukan raport ini? Setelah diterbitkan, raport akan menjadi snapshot abadi dan tidak dapat diubah lagi.")) {
      return;
    }

    startTransition(async () => {
      const res = await publishReportCardAction({
        reportCardId: id,
      });

      if (res.success && res.data) {
        setMessage({ text: "Raport berhasil diterbitkan dan dibekukan permanen!", type: "success" });
        setViewModalData(res.data);
        loadData();
      } else {
        setMessage({ text: res.error || "Gagal menerbitkan raport.", type: "error" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      <NavHeader subtitle="Buku Raport" />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl flex items-center gap-3">
              <Award className="h-8 w-8 text-teal-700" />
              Buku Raport Akademik
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Pengelolaan ledger hasil belajar, penerbitan raport semester, dan pembekuan snapshot abadi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
            >
              <Plus className="h-4 w-4" />
              Generate Draf Raport
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <div
            className={`mt-4 rounded-xl p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-teal-50 text-teal-800 border border-teal-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filter bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-stone-200">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">DRAFT (Berjalan)</option>
              <option value="PUBLISHED">PUBLISHED (Frozen)</option>
            </select>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="ALL">Semua Semester</option>
              <option value="ODD">Ganjil</option>
              <option value="EVEN">Genap</option>
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Report Cards Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-500">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-teal-700" />
              <p className="mt-3 text-sm">Memuat buku raport...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <Award className="mx-auto h-12 w-12 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">Belum ada buku raport</h3>
              <p className="mt-1 text-sm text-stone-500">
                Klik tombol "Generate Draf Raport" untuk menghitung nilai dan membuat raport siswa.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((rc) => {
                const isPublished = rc.status === "PUBLISHED";

                return (
                  <div
                    key={rc.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-teal-600 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isPublished
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isPublished ? (
                            <>
                              <Lock className="h-3 w-3" />
                              PUBLISHED (Frozen)
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              DRAFT
                            </>
                          )}
                        </span>

                        <span className="text-xs font-semibold text-stone-500">
                          Semester {rc.semester === "ODD" ? "Ganjil" : "Genap"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-stone-900 leading-snug">
                        {rc.student.fullName}
                      </h3>
                      <p className="text-xs font-mono text-stone-500">NIS: {rc.student.nis}</p>

                      <div className="mt-4 space-y-1 text-xs text-stone-600">
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-stone-400" />
                          <span>{rc.classroom.name}</span>
                          <span className="text-stone-400">•</span>
                          <span>{rc.academicYear.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-stone-400" />
                          <span>{rc.subjects?.length || 0} Mata Pelajaran Terhitung</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-stone-100 pt-4 flex items-center justify-between">
                      <span className="text-xs text-stone-400">
                        {isPublished ? "Snapshot Abadi" : "Nilai Dinamis"}
                      </span>

                      <button
                        onClick={() => handleViewDetails(rc.id)}
                        className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Buka Raport
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Generate Draf Raport */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <h3 className="text-lg font-bold text-stone-900">Generate Draf Raport Siswa</h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDraft} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Pilih Siswa *</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.nis})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Tahun Ajaran *</label>
                    <select
                      value={selectedAcademicYearId}
                      onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                    >
                      <option value="">-- Pilih --</option>
                      {academicYears.map((ay) => (
                        <option key={ay.id} value={ay.id}>
                          {ay.name} {ay.isActive ? "(Aktif)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Rombel *</label>
                    <select
                      value={selectedClassroomId}
                      onChange={(e) => setSelectedClassroomId(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                    >
                      <option value="">-- Pilih --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Semester *</label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    <option value="ODD">Ganjil</option>
                    <option value="EVEN">Genap</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Catatan Wali Kelas (Opsional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan perkembangan belajar siswa..."
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-stone-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="touch-target rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="touch-target rounded-xl bg-teal-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isPending ? "Menghitung Nilai..." : "Generate Draf"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal / Print Preview Raport */}
        {viewModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-stone-200 my-8">
              {/* Header Modal & Print Action */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 print:hidden">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      viewModalData.status === "PUBLISHED"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Status: {viewModalData.status}
                  </span>
                  {viewModalData.status === "PUBLISHED" && (
                    <span className="text-xs font-semibold text-stone-500">
                      (Historical Frozen Snapshot)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    <Printer className="h-4 w-4" />
                    Cetak
                  </button>
                  <button
                    onClick={() => setViewModalData(null)}
                    className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Raport Document Body */}
              <div className="mt-6 font-sans">
                {/* School Header */}
                <div className="text-center border-b-2 border-stone-900 pb-4">
                  <h2 className="text-xl font-bold uppercase tracking-wider text-stone-900">
                    Laporan Hasil Capaian Belajar Siswa
                  </h2>
                  <p className="text-xs text-stone-600 mt-1">
                    NataSekolah Unified Education Management Platform
                  </p>
                </div>

                {/* Student Info Grid */}
                <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p>
                      <span className="font-semibold text-stone-600">Nama Siswa:</span>{" "}
                      <strong className="text-stone-900">{viewModalData.student.fullName}</strong>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-stone-600">NIS / NISN:</span>{" "}
                      {viewModalData.student.nis} / {viewModalData.student.nisn || "-"}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-stone-600">Jenis Kelamin:</span>{" "}
                      {viewModalData.student.gender === "L" ? "Laki-laki" : "Perempuan"}
                    </p>
                  </div>
                  <div className="text-right sm:text-left">
                    <p>
                      <span className="font-semibold text-stone-600">Rombel:</span>{" "}
                      <strong className="text-stone-900">{viewModalData.classroom.name}</strong>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-stone-600">Tahun Ajaran:</span>{" "}
                      {viewModalData.academicYear.name}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold text-stone-600">Semester:</span>{" "}
                      {viewModalData.semester === "ODD" ? "Ganjil" : "Genap"}
                    </p>
                  </div>
                </div>

                {/* Subject Grades Table */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase text-stone-500 mb-2">
                    A. Nilai Capaian Mata Pelajaran
                  </h4>
                  <table className="w-full text-left text-xs border border-stone-300">
                    <thead className="bg-stone-100 font-bold uppercase text-stone-700">
                      <tr>
                        <th className="border border-stone-300 p-2 w-10 text-center">No</th>
                        <th className="border border-stone-300 p-2">Mata Pelajaran</th>
                        <th className="border border-stone-300 p-2 w-20 text-center">Nilai Akhir</th>
                        <th className="border border-stone-300 p-2 w-20 text-center">Predikat</th>
                        <th className="border border-stone-300 p-2">Capaian Kompetensi / Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModalData.parsedSnapshot?.subjects
                        ? viewModalData.parsedSnapshot.subjects.map((sub: any, idx: number) => (
                            <tr key={sub.subjectId}>
                              <td className="border border-stone-300 p-2 text-center">{idx + 1}</td>
                              <td className="border border-stone-300 p-2 font-semibold">
                                {sub.subjectName}
                              </td>
                              <td className="border border-stone-300 p-2 text-center font-bold">
                                {sub.finalScore}
                              </td>
                              <td className="border border-stone-300 p-2 text-center font-bold text-teal-800">
                                {sub.letterGrade || "-"}
                              </td>
                              <td className="border border-stone-300 p-2 text-stone-600">
                                {sub.comments || `Menunjukkan pemahaman yang baik pada mata pelajaran ${sub.subjectName}.`}
                              </td>
                            </tr>
                          ))
                        : viewModalData.subjects?.map((sub: any, idx: number) => (
                            <tr key={sub.id}>
                              <td className="border border-stone-300 p-2 text-center">{idx + 1}</td>
                              <td className="border border-stone-300 p-2 font-semibold">
                                {sub.subject.name}
                              </td>
                              <td className="border border-stone-300 p-2 text-center font-bold">
                                {sub.finalScore}
                              </td>
                              <td className="border border-stone-300 p-2 text-center font-bold text-teal-800">
                                {sub.letterGrade || "-"}
                              </td>
                              <td className="border border-stone-300 p-2 text-stone-600">
                                {sub.comments || `Menunjukkan pemahaman yang baik pada mata pelajaran ${sub.subject.name}.`}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>

                {/* Attendance Summary */}
                {viewModalData.parsedSnapshot?.attendance && (
                  <div className="mt-6">
                    <h4 className="text-xs font-bold uppercase text-stone-500 mb-2">
                      B. Ketidakhadiran
                    </h4>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="border border-stone-200 p-2 rounded-lg bg-stone-50">
                        <span className="text-stone-500 block">Hadir</span>
                        <strong className="text-stone-900 text-sm">
                          {viewModalData.parsedSnapshot.attendance.present} hari
                        </strong>
                      </div>
                      <div className="border border-stone-200 p-2 rounded-lg bg-stone-50">
                        <span className="text-stone-500 block">Sakit</span>
                        <strong className="text-stone-900 text-sm">
                          {viewModalData.parsedSnapshot.attendance.sick} hari
                        </strong>
                      </div>
                      <div className="border border-stone-200 p-2 rounded-lg bg-stone-50">
                        <span className="text-stone-500 block">Izin</span>
                        <strong className="text-stone-900 text-sm">
                          {viewModalData.parsedSnapshot.attendance.excused} hari
                        </strong>
                      </div>
                      <div className="border border-stone-200 p-2 rounded-lg bg-stone-50">
                        <span className="text-stone-500 block">Alpa</span>
                        <strong className="text-stone-900 text-sm">
                          {viewModalData.parsedSnapshot.attendance.absent} hari
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Teacher / Principal Signature Area */}
                <div className="mt-10 grid grid-cols-2 text-center text-xs pt-4 border-t border-stone-200">
                  <div>
                    <p className="text-stone-500">Mengetahui,</p>
                    <p className="font-semibold text-stone-900 mt-0.5">Orang Tua / Wali Murid</p>
                    <div className="h-16"></div>
                    <p className="border-t border-stone-400 w-36 mx-auto pt-1 text-stone-400">
                      ( ........................ )
                    </p>
                  </div>

                  <div>
                    <p className="text-stone-500">
                      Diterbitkan pada:{" "}
                      {viewModalData.publishedAt
                        ? new Date(viewModalData.publishedAt).toLocaleDateString("id-ID")
                        : new Date().toLocaleDateString("id-ID")}
                    </p>
                    <p className="font-semibold text-stone-900 mt-0.5">Kepala Sekolah / Wali Kelas</p>
                    <div className="h-16"></div>
                    <p className="border-t border-stone-400 w-36 mx-auto pt-1 font-semibold text-stone-800">
                      {viewModalData.publishedBy?.name || "Administrator"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons (Publish / Freeze) */}
              <div className="mt-8 border-t border-stone-200 pt-4 flex items-center justify-between print:hidden">
                <button
                  type="button"
                  onClick={() => setViewModalData(null)}
                  className="touch-target rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Tutup
                </button>

                {viewModalData.status === "DRAFT" ? (
                  <button
                    type="button"
                    onClick={() => handlePublish(viewModalData.id)}
                    disabled={isPending}
                    className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" />
                    {isPending ? "Membekukan..." : "Terbitkan & Bekukan Raport (Publish & Freeze)"}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Raport telah dibekukan secara permanen
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
