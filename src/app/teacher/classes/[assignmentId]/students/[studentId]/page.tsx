"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavHeader } from "../../../../../../components/nav-header";
import { getTeacherStudentAcademicSummaryAction } from "../../../../../../actions/teaching";
import type { TeacherStudentAcademicDetail } from "../../../../../../lib/teaching/workspace-service";
import {
  ChevronLeft,
  User,
  School,
  Calendar,
  ClipboardCheck,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  BookOpen,
} from "lucide-react";

export default function TeacherStudentAcademicDetailPage() {
  const params = useParams();
  const assignmentId = params?.assignmentId as string;
  const studentId = params?.studentId as string;

  const [data, setData] = useState<TeacherStudentAcademicDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "ACADEMIC">("ATTENDANCE");
  const [isPending, startTransition] = useTransition();

  const loadSummary = () => {
    if (!assignmentId || !studentId) return;
    startTransition(async () => {
      setErrorMessage(null);
      const res = await getTeacherStudentAcademicSummaryAction(assignmentId, studentId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMessage(res.error || "Gagal memuat rekap akademik santri.");
      }
    });
  };

  useEffect(() => {
    loadSummary();
  }, [assignmentId, studentId]);

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <NavHeader subtitle="Profil Akademik Santri" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Link
            href="/teacher"
            className="touch-target inline-flex items-center gap-1 font-medium hover:text-teal-800 transition"
          >
            <span>Workspace Guru</span>
          </Link>
          <span>/</span>
          <Link
            href={`/teacher/classes/${assignmentId}`}
            className="touch-target font-medium hover:text-teal-800 transition truncate max-w-[200px]"
          >
            {data ? `${data.assignment.classroomName} • ${data.assignment.subjectName}` : "Rombel"}
          </Link>
          <span>/</span>
          <span className="text-stone-900 font-semibold truncate">
            {data ? data.student.fullName : "Detail Santri"}
          </span>
        </div>

        {/* Error / Access Denied */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 flex items-start gap-4 shadow-2xs">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-900 mb-1">Data Tidak Dapat Diakses</h3>
              <p className="text-red-700 mb-4">{errorMessage}</p>
              <Link
                href={`/teacher/classes/${assignmentId}`}
                className="touch-target inline-flex items-center gap-2 rounded-xl bg-red-100 text-red-800 px-4 py-2 font-medium hover:bg-red-200 transition"
              >
                <span>Kembali ke Roster Kelas</span>
              </Link>
            </div>
          </div>
        )}

        {/* Student Profile Header */}
        {data && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 font-bold text-xl shadow-2xs">
                  {data.student.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block rounded-xs px-2 py-0.5 text-xs font-semibold ${
                        data.student.gender === "MALE"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-pink-50 text-pink-700"
                      }`}
                    >
                      {data.student.gender === "MALE" ? "Santriwan" : "Santriwati"}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                      {data.student.status}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                    {data.student.fullName}
                  </h1>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">
                    NIS: {data.student.nis} {data.student.nisn ? `• NISN: ${data.student.nisn}` : ""}
                  </p>
                </div>
              </div>

              {/* Assignment Scope Badge */}
              <div className="sm:text-right text-xs text-stone-500 space-y-1">
                <div className="inline-flex items-center gap-1.5 font-bold text-stone-900 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                  <School className="h-4 w-4 text-teal-700" />
                  <span>{data.assignment.classroomName}</span>
                  <span className="opacity-40">•</span>
                  <span>{data.assignment.subjectName}</span>
                </div>
                <p className="text-[11px] text-stone-400">
                  Tahun Ajaran: {data.assignment.academicYearName}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-100">
              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Tingkat Kehadiran</span>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">
                  {data.attendance.attendanceRate}%
                </div>
                <span className="text-[11px] text-stone-400">
                  {data.attendance.present} dari {data.attendance.totalSessions} sesi
                </span>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Sakit & Izin</span>
                <div className="text-xl font-bold text-amber-700 mt-0.5">
                  {data.attendance.sick + data.attendance.excused} Kali
                </div>
                <span className="text-[11px] text-stone-400">
                  {data.attendance.sick}S • {data.attendance.excused}I
                </span>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Alpa (Tanpa Ket.)</span>
                <div className="text-xl font-bold text-red-700 mt-0.5">
                  {data.attendance.absent} Sesi
                </div>
                <span className="text-[11px] text-stone-400">
                  {data.attendance.absent === 0 ? "Disiplin" : "Perlu perhatian"}
                </span>
              </div>

              <div className="rounded-xl bg-stone-50 p-3 text-center">
                <span className="text-xs text-stone-500 font-medium">Rata-rata Nilai</span>
                <div className="text-xl font-bold text-indigo-700 mt-0.5">
                  {data.isFormalAcademicEnabled
                    ? (data.academic.averageScore !== null ? data.academic.averageScore : "-")
                    : "Nonaktif"}
                </div>
                <span className="text-[11px] text-stone-400">
                  {data.isFormalAcademicEnabled
                    ? `${data.academic.scores.length} Asesmen`
                    : "Modul Nonaktif"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs: Kehadiran vs Asesmen & Nilai */}
        {data && (
          <div className="space-y-4">
            <div className="flex border-b border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab("ATTENDANCE")}
                className={`touch-target px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
                  activeTab === "ATTENDANCE"
                    ? "border-teal-800 text-teal-900"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                Riwayat Presensi ({data.attendance.history.length})
              </button>

              {data.isFormalAcademicEnabled && (
                <button
                  type="button"
                  onClick={() => setActiveTab("ACADEMIC")}
                  className={`touch-target px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
                    activeTab === "ACADEMIC"
                      ? "border-teal-800 text-teal-900"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Capaian Nilai & Asesmen ({data.academic.scores.length})
                </button>
              )}
            </div>

            {/* TAB 1: Attendance History */}
            {activeTab === "ATTENDANCE" && (
              <div className="rounded-2xl border border-stone-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-stone-100">
                  <h3 className="text-sm font-bold text-stone-900">
                    Rekam Jejak Kehadiran Sesi Mapel
                  </h3>
                  <p className="text-xs text-stone-500">
                    Histori kehadiran santri pada seluruh sesi pertemuan mata pelajaran ini.
                  </p>
                </div>

                {data.attendance.history.length === 0 ? (
                  <div className="p-10 text-center text-stone-500 text-xs">
                    Belum ada sesi presensi yang tercatat untuk mata pelajaran ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-100 bg-stone-50/70 text-stone-500 font-semibold">
                          <th className="py-2.5 px-4 w-12 text-center">No</th>
                          <th className="py-2.5 px-4">Tanggal Pertemuan</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4">Catatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.attendance.history.map((item, idx) => {
                          const dateObj = new Date(item.date);
                          const dateStr = dateObj.toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });

                          return (
                            <tr key={item.sessionId} className="hover:bg-stone-50/70 transition">
                              <td className="py-2.5 px-4 text-center text-stone-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-stone-800">
                                {dateStr}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    item.status === "PRESENT"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : item.status === "SICK"
                                      ? "bg-amber-50 text-amber-700"
                                      : item.status === "EXCUSED"
                                      ? "bg-blue-50 text-blue-700"
                                      : item.status === "ABSENT"
                                      ? "bg-red-50 text-red-700"
                                      : "bg-stone-100 text-stone-500"
                                  }`}
                                >
                                  {item.status === "PRESENT"
                                    ? "Hadir"
                                    : item.status === "SICK"
                                    ? "Sakit"
                                    : item.status === "EXCUSED"
                                    ? "Izin"
                                    : item.status === "ABSENT"
                                    ? "Alpa"
                                    : "Belum Dicatat"}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-stone-500 italic">
                                {item.note || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Academic Scores */}
            {activeTab === "ACADEMIC" && data.isFormalAcademicEnabled && (
              <div className="rounded-2xl border border-stone-200 bg-white shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-stone-100">
                  <h3 className="text-sm font-bold text-stone-900">
                    Nilai Asesmen & Evaluasi
                  </h3>
                  <p className="text-xs text-stone-500">
                    Rincian nilai tugas, ulangan harian, dan ujian pada mata pelajaran ini.
                  </p>
                </div>

                {data.academic.scores.length === 0 ? (
                  <div className="p-10 text-center text-stone-500 text-xs">
                    Belum ada asesmen yang dibuat untuk penugasan mengajar ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-100 bg-stone-50/70 text-stone-500 font-semibold">
                          <th className="py-2.5 px-4 w-12 text-center">No</th>
                          <th className="py-2.5 px-4">Nama Asesmen</th>
                          <th className="py-2.5 px-4 text-center">Tipe</th>
                          <th className="py-2.5 px-4 text-center">Tanggal</th>
                          <th className="py-2.5 px-4 text-center">Skor Perolehan</th>
                          <th className="py-2.5 px-4">Catatan Guru</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.academic.scores.map((sc, idx) => {
                          const dateObj = new Date(sc.date);
                          const dateStr = dateObj.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });

                          return (
                            <tr key={sc.assessmentId} className="hover:bg-stone-50/70 transition">
                              <td className="py-2.5 px-4 text-center text-stone-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-stone-900">
                                {sc.title}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                                  {sc.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center text-stone-500">
                                {dateStr}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {sc.score !== null ? (
                                  <span className="font-bold text-stone-900">
                                    {sc.score} / {sc.maxScore}
                                  </span>
                                ) : (
                                  <span className="text-stone-300 italic">Belum dinilai</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-stone-500 italic">
                                {sc.note || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
