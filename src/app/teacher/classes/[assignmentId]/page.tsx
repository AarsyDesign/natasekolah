"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavHeader } from "../../../../components/nav-header";
import { getTeacherClassDetailAction } from "../../../../actions/teaching";
import type { TeacherClassDetail } from "../../../../lib/teaching/workspace-service";
import {
  School,
  BookOpen,
  Calendar,
  Users,
  ClipboardCheck,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent,
} from "lucide-react";

export default function TeacherClassDetailPage() {
  const params = useParams();
  const assignmentId = params?.assignmentId as string;

  const [data, setData] = useState<TeacherClassDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadDetail = () => {
    if (!assignmentId) return;
    startTransition(async () => {
      setErrorMessage(null);
      const res = await getTeacherClassDetailAction(assignmentId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMessage(res.error || "Gagal memuat data rombel penugasan.");
      }
    });
  };

  useEffect(() => {
    loadDetail();
  }, [assignmentId]);

  // Filter siswa berdasarkan pencarian NIS / Nama
  const filteredStudents = data?.students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.nis.toLowerCase().includes(q) ||
      (s.nisn && s.nisn.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <NavHeader subtitle="Daftar Siswa Rombel" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Link
            href="/teacher"
            className="touch-target inline-flex items-center gap-1 font-medium hover:text-teal-800 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Kembali ke Workspace Guru</span>
          </Link>
          <span>/</span>
          <span className="text-stone-900 font-semibold truncate">
            {data ? `${data.assignment.classroomName} • ${data.assignment.subjectName}` : "Rombel Penugasan"}
          </span>
        </div>

        {/* Error / Access Denied banner */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 flex items-start gap-4 shadow-2xs">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-900 mb-1">Akses Ditolak atau Data Tidak Ditemukan</h3>
              <p className="text-red-700 mb-4">{errorMessage}</p>
              <Link
                href="/teacher"
                className="touch-target inline-flex items-center gap-2 rounded-xl bg-red-100 text-red-800 px-4 py-2 font-medium hover:bg-red-200 transition"
              >
                <span>Kembali ke Workspace Saya</span>
              </Link>
            </div>
          </div>
        )}

        {/* Header Overview Card */}
        {data && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                    <School className="h-3.5 w-3.5 text-teal-600" />
                    {data.assignment.classroomName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    <Calendar className="h-3.5 w-3.5 text-stone-400" />
                    {data.assignment.academicYearName}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                  {data.assignment.subjectName}
                </h1>
                {data.assignment.subjectCode && (
                  <p className="text-xs text-stone-400 font-mono mt-0.5">
                    Kode Mata Pelajaran: {data.assignment.subjectCode}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/attendance?assignmentId=${data.assignment.id}`}
                  className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-800 text-white px-4 py-2.5 text-sm font-semibold shadow-xs hover:bg-teal-900 transition active:scale-95"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Presensi Sesi Ini</span>
                </Link>

                {data.isFormalAcademicEnabled && (
                  <Link
                    href={`/assessments?assignmentId=${data.assignment.id}`}
                    className="touch-target inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition active:scale-95"
                  >
                    <FileCheck2 className="h-4 w-4 text-indigo-600" />
                    <span>Penilaian</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-100">
              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Santri Terdaftar</span>
                <div className="text-xl font-bold text-stone-900 mt-0.5">
                  {data.summary.totalStudents} Siswa
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Sesi Terlaksana</span>
                <div className="text-xl font-bold text-stone-900 mt-0.5">
                  {data.summary.totalSessionsHeld} Pertemuan
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Rata-rata Kehadiran</span>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">
                  {data.summary.classAttendanceRate}%
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Rata-rata Nilai Kelas</span>
                <div className="text-xl font-bold text-indigo-700 mt-0.5">
                  {data.isFormalAcademicEnabled
                    ? (data.summary.classAverageScore !== null ? data.summary.classAverageScore : "-")
                    : "Nonaktif"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section: Daftar Siswa & Rekap */}
        {data && (
          <section className="rounded-2xl border border-stone-200 bg-white shadow-2xs overflow-hidden">
            {/* Table Header & Search */}
            <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Daftar Santri & Rekap Belajar
                </h2>
                <p className="text-xs text-stone-500">
                  Data kehadiran dan capaian nilai santri pada penugasan mengajar ini.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="touch-target w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-teal-700 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Table Roster */}
            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center text-stone-500">
                <Users className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                <p className="text-sm font-medium">
                  {searchQuery ? "Tidak ada santri yang cocok dengan kata kunci pencarian." : "Belum ada santri terdaftar di rombel ini."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/70 text-stone-500 font-semibold">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4">Santri</th>
                      <th className="py-3 px-4 w-20 text-center">Gender</th>
                      <th className="py-3 px-4 text-center">Kehadiran</th>
                      {data.isFormalAcademicEnabled && (
                        <th className="py-3 px-4 text-center">Rata-rata Nilai</th>
                      )}
                      <th className="py-3 px-4 w-28 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredStudents.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-stone-50/80 transition">
                        <td className="py-3 px-4 text-center text-stone-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/teacher/classes/${assignmentId}/students/${student.id}`}
                            className="font-bold text-stone-900 hover:text-teal-800 transition block"
                          >
                            {student.fullName}
                          </Link>
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                            NIS: {student.nis} {student.nisn ? `• NISN: ${student.nisn}` : ""}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                              student.gender === "MALE"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-pink-50 text-pink-700"
                            }`}
                          >
                            {student.gender === "MALE" ? "L" : "P"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                student.attendance.attendanceRate >= 80
                                  ? "bg-emerald-50 text-emerald-700"
                                  : student.attendance.attendanceRate >= 60
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {student.attendance.attendanceRate}%
                            </span>
                            <span className="text-[11px] text-stone-400 hidden sm:inline">
                              ({student.attendance.present}H • {student.attendance.sick}S • {student.attendance.excused}I • {student.attendance.absent}A)
                            </span>
                          </div>
                        </td>
                        {data.isFormalAcademicEnabled && (
                          <td className="py-3 px-4 text-center">
                            {student.academic.averageScore !== null ? (
                              <div className="inline-flex items-center gap-1">
                                <span className="font-bold text-stone-900">
                                  {student.academic.averageScore}
                                </span>
                                <span className="text-[10px] text-stone-400">
                                  ({student.academic.assessmentsTaken} nilai)
                                </span>
                              </div>
                            ) : (
                              <span className="text-stone-300">-</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/teacher/classes/${assignmentId}/students/${student.id}`}
                            className="touch-target inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-stone-50 transition shadow-2xs"
                          >
                            <span>Detail</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
