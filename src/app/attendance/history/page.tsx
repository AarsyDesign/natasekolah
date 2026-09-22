"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "../../../components/nav-header";
import {
  listAttendanceSessionsAction,
  getAttendanceRosterAction,
} from "../../../actions/attendance";
import type { AttendanceRosterResult } from "../../../lib/attendance/record-service";
import { ATTENDANCE_STATUS_LABELS } from "../../../lib/attendance/types";
import {
  ArrowLeft,
  Calendar,
  Filter,
  History,
  Lock,
  Clock,
  Search,
  School,
  BookOpen,
  User,
  X,
  FileText,
  AlertCircle,
} from "lucide-react";

interface SessionListItem {
  id: string;
  attendanceDate: string | Date;
  status: string;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  teacherAssignment: {
    id: string;
    teacher: { id: string; name: string };
    subject: { id: string; name: string; code?: string | null };
    classroom: { id: string; name: string };
    academicYear: { id: string; name: string };
  };
  records: { id: string; status: string }[];
}

export default function AttendanceHistoryPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<AttendanceRosterResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadHistory = () => {
    startTransition(async () => {
      setErrorMessage(null);
      const query: Record<string, unknown> = {
        pageSize: 100,
      };
      if (statusFilter) query.status = statusFilter;
      if (startDate) query.startDate = startDate;
      if (endDate) query.endDate = endDate;

      const res = await listAttendanceSessionsAction(query);
      if (res.success && res.data) {
        setSessions(res.data.items as SessionListItem[]);
      } else {
        setErrorMessage(res.error || "Gagal memuat histori absensi.");
      }
    });
  };

  useEffect(() => {
    loadHistory();
  }, [statusFilter, startDate, endDate]);

  const handleViewDetail = (sessionId: string) => {
    startTransition(async () => {
      setErrorMessage(null);
      const res = await getAttendanceRosterAction(sessionId);
      if (res.success && res.data) {
        setSelectedSessionDetail(res.data);
      } else {
        setErrorMessage(res.error || "Gagal memuat rincian absensi.");
      }
    });
  };

  const formatDateDisplay = (dateVal: string | Date) => {
    const d = new Date(dateVal);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16 text-stone-900">
      <NavHeader subtitle="Histori Presensi" />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-6">
        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/attendance"
            className="touch-target inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Absensi Hari Ini
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Total Ditemukan:</span>
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
              {sessions.length} Sesi
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs mb-6">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900 mb-3">
            <Filter className="h-4 w-4 text-teal-700" />
            Filter Histori
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Status Sesi</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 p-2 text-xs font-medium text-stone-900 focus:outline-hidden focus:border-teal-600"
              >
                <option value="">Semua Status</option>
                <option value="OPEN">Sesi Terbuka (OPEN)</option>
                <option value="CLOSED">Sesi Terkunci (CLOSED)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 p-2 text-xs font-medium text-stone-900 focus:outline-hidden focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 p-2 text-xs font-medium text-stone-900 focus:outline-hidden focus:border-teal-600"
              />
            </div>
          </div>
        </div>

        {/* List Sesi Histori */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {sessions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="mx-auto h-12 w-12 text-stone-300" />
              <h3 className="mt-3 text-sm font-bold text-stone-900">Belum ada riwayat absensi</h3>
              <p className="mt-1 text-xs text-stone-500">
                Sesi absensi yang telah dibuka atau ditutup akan muncul pada daftar ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {sessions.map((item) => {
                const isClosed = item.status === "CLOSED";
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/60 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-stone-500">
                          {formatDateDisplay(item.attendanceDate)}
                        </span>
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
                            <Lock className="h-3 w-3 text-stone-500" />
                            CLOSED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                            <Clock className="h-3 w-3 text-teal-700" />
                            OPEN
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-stone-900">
                        {item.teacherAssignment.subject.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-600 flex items-center gap-2">
                        <span>{item.teacherAssignment.classroom.name}</span>
                        <span>•</span>
                        <span>Guru: {item.teacherAssignment.teacher.name}</span>
                        <span>•</span>
                        <span>{item.records.length} Siswa Dicatat</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleViewDetail(item.id)}
                      className="touch-target inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 self-end sm:self-center"
                    >
                      <FileText className="h-4 w-4" />
                      Lihat Rincian
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Rincian Sesi */}
        {selectedSessionDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-stone-900">
                      {selectedSessionDetail.assignment.subjectName}
                    </h3>
                    {selectedSessionDetail.status === "CLOSED" ? (
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                        CLOSED
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                        OPEN
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    {selectedSessionDetail.assignment.classroomName} • Pengajar: {selectedSessionDetail.assignment.teacherName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="touch-target rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Ringkasan Angka */}
              <div className="my-4 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-xl bg-teal-50 p-2 font-semibold text-teal-800">
                  Hadir: {selectedSessionDetail.summary.present}
                </div>
                <div className="rounded-xl bg-amber-50 p-2 font-semibold text-amber-800">
                  Izin: {selectedSessionDetail.summary.excused}
                </div>
                <div className="rounded-xl bg-blue-50 p-2 font-semibold text-blue-800">
                  Sakit: {selectedSessionDetail.summary.sick}
                </div>
                <div className="rounded-xl bg-rose-50 p-2 font-semibold text-rose-800">
                  Alpa: {selectedSessionDetail.summary.absent}
                </div>
              </div>

              {/* Tabel Roster */}
              <div className="divide-y divide-stone-100 border-t border-stone-100">
                {selectedSessionDetail.roster.map((r, i) => (
                  <div key={r.studentId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-stone-900">
                        {i + 1}. {r.fullName}
                      </span>
                      <span className="text-stone-400 ml-2">NIS: {r.nis}</span>
                      {r.note && (
                        <p className="text-stone-500 italic mt-0.5">Catatan: {r.note}</p>
                      )}
                    </div>
                    <div>
                      {r.status === "UNRECORDED" ? (
                        <span className="text-stone-400 font-medium">Belum Diisi</span>
                      ) : (
                        <span
                          className={`rounded-md px-2 py-0.5 font-bold ${
                            r.status === "PRESENT"
                              ? "bg-teal-100 text-teal-800"
                              : r.status === "EXCUSED"
                              ? "bg-amber-100 text-amber-800"
                              : r.status === "SICK"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {ATTENDANCE_STATUS_LABELS[r.status]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSessionDetail(null)}
                  className="touch-target rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
