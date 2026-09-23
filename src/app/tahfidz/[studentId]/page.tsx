"use client";

import { useState, useEffect, useTransition, use } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { getStudentByIdAction } from "@/actions/academic";
import {
  createTahfidzRecordAction,
  listTahfidzRecordsAction,
  getTahfidzSummaryAction,
} from "@/actions/tahfidz";
import { QURAN_SURAHS } from "@/lib/tahfidz/quran";
import {
  BookMarked,
  ArrowLeft,
  Calendar,
  Save,
  RefreshCw,
  Award,
  BookOpen,
  User,
  GraduationCap,
} from "lucide-react";

export default function StudentTahfidzPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  const [studentData, setStudentData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [surah, setSurah] = useState<number>(1);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endAyah, setEndAyah] = useState<number>(7);
  const [type, setType] = useState<"SETORAN" | "MURAJAAH">("SETORAN");
  const [quality, setQuality] = useState<"MUMTAZ" | "JAYYID" | "MAQBUL" | "REPEAT">("MUMTAZ");
  const [note, setNote] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [stRes, smRes, recRes] = await Promise.all([
        getStudentByIdAction(studentId),
        getTahfidzSummaryAction(studentId),
        listTahfidzRecordsAction({ studentId }),
      ]);

      if (stRes.success && stRes.data) {
        setStudentData(stRes.data);
      }
      if (smRes.success && smRes.data) {
        setSummary(smRes.data);
      }
      if (recRes.success && recRes.data) {
        setRecords(recRes.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  // Adjust default end ayah when surah changes
  const handleSurahChange = (surahNum: number) => {
    setSurah(surahNum);
    const surahMeta = QURAN_SURAHS[surahNum];
    if (surahMeta) {
      setStartAyah(1);
      setEndAyah(Math.min(10, surahMeta.totalAyahs));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const enrollmentId = studentData?.currentEnrollment?.id || studentData?.history?.[0]?.id;
    if (!enrollmentId) {
      setMessage({
        text: "Santri belum memiliki rekaman Enrollment resmi di rombel/tahun ajaran.",
        type: "error",
      });
      return;
    }

    startTransition(async () => {
      const res = await createTahfidzRecordAction({
        studentId,
        enrollmentId,
        date: new Date(date),
        surah,
        startAyah,
        endAyah,
        type,
        quality,
        note: note.trim() || undefined,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal mencatat mutaba'ah.", type: "error" });
      } else {
        setMessage({ text: "Alhamdulillah, catatan mutaba'ah berhasil disimpan!", type: "success" });
        setNote("");
        loadData();
      }
    });
  };

  const activeSurahMeta = QURAN_SURAHS[surah] || { name: "Al-Fatihah", totalAyahs: 7 };

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Pesantren & Tahfidz" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation & Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/tahfidz"
            className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Santri</span>
          </Link>

          <button
            onClick={() => startTransition(loadData)}
            className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Santri Profile Header */}
        <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white font-bold text-lg">
                {studentData?.student?.fullName?.charAt(0) || "S"}
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">
                  {studentData?.student?.fullName || "Memuat santri..."}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  <span>NIS: <strong className="text-stone-700">{studentData?.student?.nis || "-"}</strong></span>
                  <span>•</span>
                  <span>
                    Kelas:{" "}
                    <strong className="text-stone-700">
                      {studentData?.currentEnrollment?.classroom?.name || "Belum ada rombel"}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Tahun Ajaran:{" "}
                    <strong className="text-stone-700">
                      {studentData?.currentEnrollment?.academicYear?.name || "-"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stat Pill */}
            <div className="flex gap-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-center">
                <span className="block text-2xs uppercase tracking-wider font-semibold text-emerald-700">Setoran</span>
                <span className="text-lg font-bold text-emerald-800">{summary?.totalSetoran || 0}</span>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-center">
                <span className="block text-2xs uppercase tracking-wider font-semibold text-blue-700">Muraja'ah</span>
                <span className="text-lg font-bold text-blue-800">{summary?.totalMurajaah || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Content: Form Input (Left) & Riwayat (Right) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Form Input Mutaba'ah (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <BookMarked className="h-5 w-5 text-teal-700" />
                <h2 className="text-base font-bold text-stone-900">Catat Mutaba'ah Baru</h2>
              </div>

              {message && (
                <div
                  className={`mt-4 rounded-lg p-3 text-xs font-medium ${
                    message.type === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSave} className="mt-4 space-y-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Tanggal Simakan</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Jenis & Kualitas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Jenis Mutaba'ah</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                    >
                      <option value="SETORAN">Setoran (Ziyadah)</option>
                      <option value="MURAJAAH">Muraja'ah (Ulang)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Kualitas Bacaan</label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as any)}
                      className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                    >
                      <option value="MUMTAZ">Mumtaz (Sangat Baik)</option>
                      <option value="JAYYID">Jayyid (Baik)</option>
                      <option value="MAQBUL">Maqbul (Cukup)</option>
                      <option value="REPEAT">Ulangi (Perlu Perbaikan)</option>
                    </select>
                  </div>
                </div>

                {/* Surah */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-stone-700">Surah Al-Qur'an</label>
                    <span className="text-2xs text-stone-500">Total {activeSurahMeta.totalAyahs} ayat</span>
                  </div>
                  <select
                    value={surah}
                    onChange={(e) => handleSurahChange(Number(e.target.value))}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                  >
                    {Object.values(QURAN_SURAHS).map((s) => (
                      <option key={s.number} value={s.number}>
                        {s.number}. {s.name} ({s.totalAyahs} ayat)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ayat Awal & Akhir */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Ayat Awal</label>
                    <input
                      type="number"
                      min={1}
                      max={activeSurahMeta.totalAyahs}
                      value={startAyah}
                      onChange={(e) => setStartAyah(Number(e.target.value))}
                      required
                      className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Ayat Akhir</label>
                    <input
                      type="number"
                      min={startAyah}
                      max={activeSurahMeta.totalAyahs}
                      value={endAyah}
                      onChange={(e) => setEndAyah(Number(e.target.value))}
                      required
                      className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Catatan Tajwid / Makhorijul Huruf</label>
                  <input
                    type="text"
                    placeholder="Contoh: Perhatikan ghunnah di ayat 5..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-2.5 text-xs font-bold text-white shadow-2xs transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isPending ? "Menyimpan Catatan..." : "Simpan Catatan Mutaba'ah"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Riwayat Mutaba'ah Table (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-teal-700" />
                  <h2 className="text-base font-bold text-stone-900">Riwayat Mutaba'ah Santri</h2>
                </div>
                <span className="text-xs font-semibold text-stone-500">
                  Total {records.length} entri
                </span>
              </div>

              {records.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center mt-4">
                  <BookOpen className="mx-auto h-8 w-8 text-stone-400" />
                  <p className="mt-2 text-sm font-semibold text-stone-700">Belum ada rekaman mutaba'ah</p>
                  <p className="text-xs text-stone-500">Gunakan formulir di sebelah kiri untuk mencatat setoran santri.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 rounded-xl border border-stone-200/90 bg-stone-50/50 p-4 transition hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                              r.type === "SETORAN"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {r.type}
                          </span>
                          <span className="text-sm font-bold text-stone-900">
                            {r.surahName || `Surah ${r.surah}`} : {r.startAyah} - {r.endAyah}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-2xs font-semibold ${
                              r.quality === "MUMTAZ"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.quality === "JAYYID"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : r.quality === "MAQBUL"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {r.quality}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-2xs text-stone-500">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(r.date).toLocaleDateString("id-ID", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span>•</span>
                          <span>Ustadz: {r.recorder?.name || "Penguji"}</span>
                          {r.enrollment?.classroom?.name && (
                            <>
                              <span>•</span>
                              <span>Kelas: {r.enrollment.classroom.name}</span>
                            </>
                          )}
                        </div>

                        {r.note && (
                          <p className="mt-2 text-2xs italic text-stone-600 bg-white p-2 rounded border border-stone-200/60">
                            "{r.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
