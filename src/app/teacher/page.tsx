"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "../../components/nav-header";
import { getTeacherWorkspaceSummaryAction } from "../../actions/teaching";
import type { TeacherWorkspaceSummary } from "../../lib/teaching/workspace-service";
import {
  GraduationCap,
  BookOpen,
  School,
  Calendar,
  ClipboardCheck,
  FileCheck2,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  History,
  Award,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function TeacherWorkspacePage() {
  const [data, setData] = useState<TeacherWorkspaceSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadSummary = () => {
    startTransition(async () => {
      setErrorMessage(null);
      const res = await getTeacherWorkspaceSummaryAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMessage(res.error || "Gagal memuat ringkasan workspace guru.");
      }
    });
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const todayDateFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <NavHeader subtitle="Workspace Guru" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Banner Salam & Konteks Guru */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-900 via-teal-850 to-teal-800 p-6 sm:p-8 text-white shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-teal-100 backdrop-blur-xs">
                <Calendar className="h-3.5 w-3.5" />
                <span>{todayDateFormatted}</span>
                {data?.activeAcademicYear && (
                  <>
                    <span className="opacity-40">•</span>
                    <span>Tahun Ajaran {data.activeAcademicYear.name}</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Ahlan wa Sahlan, {data?.teacher.name || "Ustadz/Guru"}!
              </h1>
              <p className="text-sm sm:text-base text-teal-100/90 max-w-2xl">
                Pusat kendali pengajaran Anda: pantau rombel, catat presensi harian, evaluasi penilaian, dan pantau perkembangan belajar santri.
              </p>
            </div>

            {/* Quick action button */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/attendance"
                className="touch-target inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 active:scale-95"
              >
                <ClipboardCheck className="h-4 w-4 text-teal-700" />
                <span>Presensi Hari Ini</span>
              </Link>
              {data?.isFormalAcademicEnabled && (
                <Link
                  href="/assessments"
                  className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-700/60 border border-teal-500/40 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:scale-95"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Penilaian</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Notifikasi / Error message */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold">Terjadi Kendala</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Plugin Notice if FORMAL_ACADEMIC is disabled */}
        {data && !data.isFormalAcademicEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Modul Penilaian Formal Nonaktif</p>
              <p className="text-xs text-amber-700">
                Lembaga ini tidak mengaktifkan plugin Akademik Formal. Fitur pembuatan asesmen dan raport dinonaktifkan. Anda tetap dapat menggunakan Presensi dan Rekap Kehadiran Siswa.
              </p>
            </div>
          </div>
        )}

        {/* Metrik Hari Ini */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Kelas Diajar */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-medium">Kelas Diajar</span>
              <School className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900">
              {data?.metrics.totalClasses ?? (isPending ? "..." : 0)}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {data?.metrics.totalAssignments ?? 0} penugasan mapel
            </div>
          </div>

          {/* Card 2: Mata Pelajaran */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-medium">Mata Pelajaran</span>
              <BookOpen className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900">
              {data?.metrics.totalSubjects ?? (isPending ? "..." : 0)}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {data?.metrics.totalStudentsTaught ?? 0} total santri diampu
            </div>
          </div>

          {/* Card 3: Presensi Hari Ini */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-medium">Presensi Hari Ini</span>
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900">
              {data ? `${data.metrics.todaySessionsCompleted}/${data.metrics.totalAssignments}` : (isPending ? "..." : 0)}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {data?.metrics.todaySessionsPending ? (
                <span className="text-amber-600 font-medium">
                  {data.metrics.todaySessionsPending} kelas terbuka
                </span>
              ) : (
                <span>kelas dicatat</span>
              )}
            </div>
          </div>

          {/* Card 4: Penilaian Perlu Diisi */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-medium">Penilaian Belum Lengkap</span>
              <FileCheck2 className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900">
              {data?.isFormalAcademicEnabled
                ? (data?.metrics.pendingAssessments ?? (isPending ? "..." : 0))
                : "-"}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {data?.isFormalAcademicEnabled
                ? "asesmen butuh skor"
                : "modul nonaktif"}
            </div>
          </div>
        </div>

        {/* Section: Kelas & Mata Pelajaran Saya */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-stone-900">
                Kelas & Mata Pelajaran Saya
              </h2>
              <p className="text-xs text-stone-500">
                Pilih rombel untuk mencatat presensi, memasukkan nilai, atau melihat rekap siswa.
              </p>
            </div>
            <span className="text-xs font-medium text-stone-500">
              {data?.assignments.length || 0} Penugasan
            </span>
          </div>

          {/* Loading state */}
          {isPending && !data && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl border border-stone-200 bg-white p-5 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isPending && data?.assignments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700 mb-4">
                <GraduationCap className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                Belum Ada Penugasan Mengajar
              </h3>
              <p className="text-sm text-stone-500 max-w-md mx-auto mb-6">
                Akun Anda belum memiliki mata pelajaran atau rombel yang ditugaskan oleh Bagian Kurikulum / Administrator Akademik lembaga.
              </p>
              <div className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-600">
                <span>Hubungi Administrator Kurikulum untuk memasukkan penugasan mengajar Anda.</span>
              </div>
            </div>
          )}

          {/* List of Assignment Cards */}
          {data && data.assignments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.assignments.map((assignment) => {
                const hasSessionToday = !!assignment.todaySession;
                const isSessionClosed = assignment.todaySession?.status === "CLOSED";

                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                          <School className="h-3 w-3 text-stone-500" />
                          {assignment.classroomName}
                        </span>
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                          {assignment.subjectCategory}
                        </span>
                      </div>

                      {/* Subject Name & Code */}
                      <h3 className="text-lg font-bold tracking-tight text-stone-900 group-hover:text-teal-700">
                        {assignment.subjectName}
                      </h3>
                      {assignment.subjectCode && (
                        <p className="text-xs text-stone-400 font-mono mt-0.5">
                          Kode: {assignment.subjectCode}
                        </p>
                      )}

                      {/* Key Indicators */}
                      <div className="mt-4 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Users className="h-3.5 w-3.5 text-stone-400" />
                          <span>{assignment.studentCount} Santri</span>
                        </div>

                        {data.isFormalAcademicEnabled && (
                          <div className="flex items-center gap-1.5 text-stone-600">
                            <FileCheck2 className="h-3.5 w-3.5 text-stone-400" />
                            <span>{assignment.assessmentCount} Asesmen</span>
                          </div>
                        )}
                      </div>

                      {/* Today's Attendance Status Badge */}
                      <div className="mt-3 pt-2">
                        {hasSessionToday ? (
                          isSessionClosed ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Presensi Hari Ini Selesai</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span>Sesi Presensi Terbuka</span>
                            </div>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                            <Clock className="h-3.5 w-3.5 text-stone-400" />
                            <span>Belum Absensi Hari Ini</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                      <Link
                        href={`/teacher/classes/${assignment.id}`}
                        className="touch-target inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900 transition"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>Rekap Siswa</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/attendance?assignmentId=${assignment.id}`}
                          className="touch-target rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:border-stone-300 transition"
                          title="Buka Presensi Kelas Ini"
                        >
                          Presensi
                        </Link>
                        {data.isFormalAcademicEnabled && (
                          <Link
                            href={`/assessments?assignmentId=${assignment.id}`}
                            className="touch-target rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:border-stone-300 transition"
                            title="Buka Asesmen & Nilai"
                          >
                            Nilai
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Pintasan Kerja Cepat Guru */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-base font-bold text-stone-900">
              Pintasan Kerja Akademik
            </h3>
            <p className="text-xs text-stone-500">
              Akses cepat ke alur presensi, penilaian, raport, dan riwayat kegiatan mengajar.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/attendance"
              className="touch-target flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center hover:bg-teal-50/50 hover:border-teal-200 transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-800 mb-2">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-stone-900">Presensi Harian</span>
              <span className="text-[11px] text-stone-500 mt-0.5">Catat kehadiran santri</span>
            </Link>

            <Link
              href="/attendance/history"
              className="touch-target flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center hover:bg-stone-100 hover:border-stone-300 transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700 mb-2">
                <History className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-stone-900">Riwayat Presensi</span>
              <span className="text-[11px] text-stone-500 mt-0.5">Arsip kehadiran kelas</span>
            </Link>

            {data?.isFormalAcademicEnabled ? (
              <>
                <Link
                  href="/assessments"
                  className="touch-target flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center hover:bg-indigo-50/50 hover:border-indigo-200 transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800 mb-2">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-stone-900">Penilaian & Asesmen</span>
                  <span className="text-[11px] text-stone-500 mt-0.5">Input skor tugas & UH</span>
                </Link>

                <Link
                  href="/reports"
                  className="touch-target flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-center hover:bg-amber-50/50 hover:border-amber-200 transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800 mb-2">
                    <Award className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-stone-900">Raport Santri</span>
                  <span className="text-[11px] text-stone-500 mt-0.5">Hasil belajar & cetak</span>
                </Link>
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center rounded-xl border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">
                Pintasan Penilaian & Raport dinonaktifkan (Plugin Formal Academic nonaktif)
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
