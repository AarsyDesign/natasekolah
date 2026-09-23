"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import {
  listAssessmentsAction,
  createAssessmentAction,
} from "@/actions/formal-academic";
import { getTeacherAssignmentsAction } from "@/actions/teaching";
import {
  FileCheck2,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  Layers,
  GraduationCap,
  ArrowRight,
  X,
} from "lucide-react";

interface AssessmentItem {
  id: string;
  title: string;
  type: string;
  assessmentDate: string;
  maxScore: number;
  isPublished: boolean;
  teacherAssignment: {
    id: string;
    subject: { name: string; code: string | null };
    classroom: { name: string };
    academicYear: { name: string };
    teacher: { name: string };
  };
  _count?: {
    scores: number;
  };
}

export default function AssessmentsPage() {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [assignments, setAssignments] = useState<Array<any>>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"DAILY" | "QUIZ" | "MIDTERM" | "FINAL" | "PROJECT" | "OTHER">("DAILY");
  const [maxScore, setMaxScore] = useState<number | "">(100);
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split("T")[0]);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listAssessmentsAction({
        search: search || undefined,
        type: typeFilter === "ALL" ? undefined : (typeFilter as any),
        limit: 100,
      });
      if (res.success && res.data) {
        setItems(res.data.items as any);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat data penilaian", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleOpenCreate = async () => {
    setTitle("");
    setType("DAILY");
    setMaxScore(100);
    setAssessmentDate(new Date().toISOString().split("T")[0]);
    setSelectedAssignmentId("");
    setModalOpen(true);

    try {
      const res = await getTeacherAssignmentsAction({ pageSize: 100 });
      if (res.success && res.data) {
        setAssignments(res.data.items);
        if (res.data.items.length > 0) {
          setSelectedAssignmentId(res.data.items[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId || !title) return;

    startTransition(async () => {
      const res = await createAssessmentAction({
        teacherAssignmentId: selectedAssignmentId,
        title,
        type,
        maxScore: Number(maxScore) || 100,
        assessmentDate,
        isPublished: false,
      });

      if (res.success) {
        setMessage({ text: "Penilaian berhasil dibuat!", type: "success" });
        setModalOpen(false);
        loadData();
      } else {
        setMessage({ text: res.error || "Gagal membuat penilaian", type: "error" });
      }
    });
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case "DAILY":
        return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Harian</span>;
      case "QUIZ":
        return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Kuis</span>;
      case "MIDTERM":
        return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">UTS / Tengah Semester</span>;
      case "FINAL":
        return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">UAS / Akhir Semester</span>;
      case "PROJECT":
        return <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">Proyek</span>;
      default:
        return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">{t}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      <NavHeader subtitle="Penilaian Akademik" />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header & Aksi */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl flex items-center gap-3">
              <FileCheck2 className="h-8 w-8 text-teal-700" />
              Penilaian Akademik
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Rencana penilaian, ujian harian/semester, dan penginputan nilai siswa per penugasan mengajar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
            >
              <Plus className="h-4 w-4" />
              Buat Penilaian Baru
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
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between border border-stone-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Cari judul penilaian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-4 py-2 text-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="DAILY">Ulangan Harian</option>
              <option value="QUIZ">Kuis</option>
              <option value="MIDTERM">UTS</option>
              <option value="FINAL">UAS</option>
              <option value="PROJECT">Proyek</option>
              <option value="OTHER">Lainnya</option>
            </select>

            <button
              onClick={loadData}
              disabled={loading}
              className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* List Penilaian */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-500">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-teal-700" />
              <p className="mt-3 text-sm">Memuat daftar penilaian...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <FileCheck2 className="mx-auto h-12 w-12 text-stone-400" />
              <h3 className="mt-3 text-base font-semibold text-stone-900">Belum ada penilaian dibuat</h3>
              <p className="mt-1 text-sm text-stone-500">
                Buat penilaian baru untuk mulai menginput nilai siswa pada rombel Anda.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Buat Penilaian
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-teal-600 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      {getTypeBadge(item.type)}
                      <span className="text-xs font-semibold text-stone-500">
                        Skor Maks: {item.maxScore}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-stone-900 leading-snug">
                      {item.title}
                    </h3>

                    <div className="mt-4 space-y-1.5 text-xs text-stone-600">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-stone-400" />
                        <span className="font-semibold text-stone-800">
                          {item.teacherAssignment.subject.name}
                        </span>
                        <span className="text-stone-400">•</span>
                        <span>{item.teacherAssignment.classroom.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-stone-400" />
                        <span>
                          {new Date(item.assessmentDate).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-stone-400">•</span>
                        <span>{item.teacherAssignment.academicYear.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5 text-stone-400" />
                        <span>Guru: {item.teacherAssignment.teacher.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-stone-100 pt-4 flex items-center justify-between">
                    <span className="text-xs text-stone-500">
                      <strong>{item._count?.scores || 0}</strong> siswa dinilai
                    </span>

                    <Link
                      href={`/assessments/${item.id}`}
                      className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
                    >
                      Input Nilai
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Buat Penilaian */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <h3 className="text-lg font-bold text-stone-900">Buat Penilaian Akademik</h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Pilih Penugasan Mengajar (Rombel & Mapel) *
                  </label>
                  <select
                    value={selectedAssignmentId}
                    onChange={(e) => setSelectedAssignmentId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.subject.name} - {a.classroom.name} ({a.academicYear.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Judul Penilaian *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ulangan Harian Bab 1, Kuis Persamaan Linier"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Jenis Penilaian *
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                    >
                      <option value="DAILY">Ulangan Harian</option>
                      <option value="QUIZ">Kuis</option>
                      <option value="MIDTERM">UTS</option>
                      <option value="FINAL">UAS</option>
                      <option value="PROJECT">Proyek</option>
                      <option value="OTHER">Lainnya</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Skor Maksimal *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : "")}
                      className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Tanggal Penilaian
                  </label>
                  <input
                    type="date"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-stone-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="touch-target rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="touch-target rounded-xl bg-teal-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isPending ? "Menyimpan..." : "Buat Penilaian"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
