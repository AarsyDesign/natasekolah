"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import { getStudentsAction } from "@/actions/academic";
import { listTahfidzRecordsAction } from "@/actions/tahfidz";
import {
  BookMarked,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export default function TahfidzPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, recordsRes] = await Promise.all([
        getStudentsAction({ pageSize: 100 }),
        listTahfidzRecordsAction(),
      ]);

      if (studentsRes.success && studentsRes.data) {
        setStudents(studentsRes.data.data || []);
      }
      if (recordsRes.success && recordsRes.data) {
        setRecentRecords(recordsRes.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.nis.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecords = recentRecords.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    return true;
  });

  const totalSetoran = recentRecords.filter((r) => r.type === "SETORAN").length;
  const totalMurajaah = recentRecords.filter((r) => r.type === "MURAJAAH").length;

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Pesantren & Tahfidz" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <BookMarked className="h-4 w-4" />
              <span>Halaqah & Mutaba'ah</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Tahfidz Al-Qur'an
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Pencatatan setoran ziyadah dan muraja'ah hafalan santri dengan integritas histori sakral.
            </p>
          </div>

          <button
            onClick={() => startTransition(loadData)}
            className="touch-target inline-flex items-center gap-2 self-start rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Total Santri</span>
            <p className="mt-1 text-2xl font-bold text-stone-900">{students.length}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-emerald-600">Setoran Ziyadah</span>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{totalSetoran}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-blue-600">Muraja'ah</span>
            <p className="mt-1 text-2xl font-bold text-blue-700">{totalMurajaah}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Total Mutaba'ah</span>
            <p className="mt-1 text-2xl font-bold text-stone-900">{recentRecords.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Santri List Column (2 cols on lg) */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-bold text-stone-900">Buku Mutaba'ah per Santri</h2>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari santri / NIS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-stone-200 bg-white">
                <RefreshCw className="h-6 w-6 animate-spin text-teal-700" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-stone-400" />
                <p className="mt-2 text-sm font-semibold text-stone-700">Tidak ada santri ditemukan</p>
                <p className="text-xs text-stone-500">Coba ubah kata kunci pencarian Anda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStudents.map((st) => {
                  const studentRecords = recentRecords.filter((r) => r.studentId === st.id);
                  const lastRec = studentRecords[0] ?? null;

                  return (
                    <div
                      key={st.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-stone-900">
                            {st.fullName}
                          </h3>
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-2xs font-mono text-stone-600">
                            {st.nis}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                          {lastRec ? (
                            <span>
                              Terakhir:{" "}
                              <strong className="text-stone-700">
                                {lastRec.surahName || `Surah ${lastRec.surah}`} : {lastRec.startAyah}-{lastRec.endAyah}
                              </strong>{" "}
                              ({lastRec.type})
                            </span>
                          ) : (
                            <span className="italic text-stone-400">Belum ada catatan mutaba'ah</span>
                          )}
                          <span>•</span>
                          <span>{studentRecords.length} kali simakan</span>
                        </div>
                      </div>

                      <Link
                        href={`/tahfidz/${st.id}`}
                        className="touch-target inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700"
                      >
                        <span>Buku Mutaba'ah</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Records Activity Feed */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Aktivitas Simakan Terkini</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setTypeFilter("ALL")}
                  className={`rounded px-2 py-1 text-2xs font-semibold ${
                    typeFilter === "ALL"
                      ? "bg-stone-800 text-white"
                      : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setTypeFilter("SETORAN")}
                  className={`rounded px-2 py-1 text-2xs font-semibold ${
                    typeFilter === "SETORAN"
                      ? "bg-emerald-700 text-white"
                      : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  }`}
                >
                  Setoran
                </button>
                <button
                  onClick={() => setTypeFilter("MURAJAAH")}
                  className={`rounded px-2 py-1 text-2xs font-semibold ${
                    typeFilter === "MURAJAAH"
                      ? "bg-blue-700 text-white"
                      : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  }`}
                >
                  Muraja'ah
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500">
                  Belum ada aktivitas mutaba'ah terbaru.
                </div>
              ) : (
                filteredRecords.slice(0, 10).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-stone-200/90 bg-white p-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-900">
                        {r.student?.fullName || "Santri"}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                          r.type === "SETORAN"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {r.type}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-700">
                        {r.surahName || `Surah ${r.surah}`} : {r.startAyah}-{r.endAyah}
                      </span>
                      <span
                        className={`font-semibold ${
                          r.quality === "MUMTAZ"
                            ? "text-emerald-700"
                            : r.quality === "JAYYID"
                            ? "text-blue-700"
                            : r.quality === "MAQBUL"
                            ? "text-amber-700"
                            : "text-rose-700"
                        }`}
                      >
                        {r.quality}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-2xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(r.date).toLocaleDateString("id-ID")}
                      </span>
                      <span>Disimak: {r.recorder?.name || "Ustadz"}</span>
                    </div>

                    {r.note && (
                      <p className="mt-1.5 border-t border-stone-100 pt-1 text-2xs italic text-stone-500">
                        "{r.note}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
