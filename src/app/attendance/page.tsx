"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { NavHeader } from "../../components/nav-header";
import {
  getTodayAssignmentsWithAttendanceAction,
  createAttendanceSessionAction,
  getAttendanceRosterAction,
  markAttendanceAction,
  markAttendanceBatchAction,
  closeAttendanceSessionAction,
} from "../../actions/attendance";
import type { AttendanceRosterResult, AttendanceRosterItem } from "../../lib/attendance/record-service";
import {
  ATTENDANCE_STATUS_LABELS,
  AttendanceStatus,
} from "../../lib/attendance/types";
import { AttendanceOfflineStore } from "../../lib/attendance/offline/offline-store";
import { AttendanceSyncWorker } from "../../lib/attendance/offline/sync-worker";
import type { OfflineAttendanceMutation } from "../../lib/attendance/offline/types";
import {
  ClipboardCheck,
  Calendar,
  School,
  BookOpen,
  User,
  CheckCircle2,
  Clock,
  Lock,
  ArrowLeft,
  Check,
  AlertCircle,
  FileText,
  ChevronRight,
  History,
  RotateCcw,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface AssignmentWithSession {
  assignment: {
    id: string;
    teacherId: string;
    subjectId: string;
    classroomId: string;
    academicYearId: string;
    teacher: { id: string; name: string };
    subject: { id: string; name: string; code?: string | null };
    classroom: { id: string; name: string };
    academicYear: { id: string; name: string };
  };
  session: {
    id: string;
    status: string;
    openedAt: string | Date;
    closedAt?: string | Date | null;
    recordCount: number;
  } | null;
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [assignmentsData, setAssignmentsData] = useState<AssignmentWithSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeRoster, setActiveRoster] = useState<AttendanceRosterResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notesOpenStudentId, setNotesOpenStudentId] = useState<string | null>(null);
  const [studentNote, setStudentNote] = useState<string>("");

  // Offline & Sync Engine States
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [mutationsMap, setMutationsMap] = useState<Map<string, OfflineAttendanceMutation>>(new Map());
  const [conflictModalItem, setConflictModalItem] = useState<OfflineAttendanceMutation | null>(null);
  const [queueStats, setQueueStats] = useState({ pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 });

  const [isPending, startTransition] = useTransition();

  const offlineStore = AttendanceOfflineStore.getInstance();
  const syncWorker = AttendanceSyncWorker.getInstance();

  // Monitor Network & Sync Worker
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = syncWorker.subscribe((status, msg) => {
      setIsSyncing(status === "SYNCING");
      if (status === "SUCCESS" && msg) {
        setSuccessMessage(msg);
      } else if (status === "ERROR" && msg) {
        setErrorMessage(msg);
      }
      if (activeSessionId) {
        refreshLocalMutations(activeSessionId);
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [activeSessionId]);

  const refreshLocalMutations = useCallback(async (sessionId: string) => {
    const list = await offlineStore.getAllMutations(sessionId);
    const map = new Map<string, OfflineAttendanceMutation>();
    for (const m of list) {
      map.set(m.studentId, m);
    }
    setMutationsMap(map);

    const stats = await offlineStore.getQueueStats(sessionId);
    setQueueStats(stats);
  }, []);

  // Load today's assignments & sessions
  const loadAssignments = (dateStr: string) => {
    startTransition(async () => {
      setErrorMessage(null);
      const res = await getTodayAssignmentsWithAttendanceAction(dateStr);
      if (res.success && res.data) {
        setAssignmentsData(res.data.items as AssignmentWithSession[]);
      } else {
        setErrorMessage(res.error || "Gagal memuat penugasan mengajar.");
      }
    });
  };

  useEffect(() => {
    loadAssignments(selectedDate);
  }, [selectedDate]);

  // Load roster with offline-fallback cache
  const loadRoster = (sessionId: string) => {
    startTransition(async () => {
      setErrorMessage(null);

      // Attempt server fetch if online
      if (navigator.onLine) {
        const res = await getAttendanceRosterAction(sessionId);
        if (res.success && res.data) {
          setActiveRoster(res.data);
          // Cache roster locally for offline resilience
          await offlineStore.saveRosterCache(sessionId, "institution_active", res.data);
          await refreshLocalMutations(sessionId);
          return;
        }
      }

      // Fallback to offline cached roster
      const cached = await offlineStore.getRosterCache(sessionId);
      if (cached) {
        setActiveRoster(cached);
        await refreshLocalMutations(sessionId);
        setSuccessMessage("Memuat daftar siswa dari cache lokal (mode offline).");
      } else {
        setErrorMessage("Tidak ada data presensi offline yang tersedia untuk sesi ini.");
      }
    });
  };

  useEffect(() => {
    if (activeSessionId) {
      loadRoster(activeSessionId);
    } else {
      setActiveRoster(null);
    }
  }, [activeSessionId]);

  // Handle Open Session
  const handleOpenSession = (assignmentId: string) => {
    startTransition(async () => {
      setErrorMessage(null);
      const res = await createAttendanceSessionAction({
        teacherAssignmentId: assignmentId,
        attendanceDate: selectedDate,
      });

      if (res.success && res.data) {
        setSuccessMessage("Sesi absensi berhasil dibuka.");
        loadAssignments(selectedDate);
        setActiveSessionId(res.data.id);
      } else {
        setErrorMessage(res.error || "Gagal membuka sesi absensi.");
      }
    });
  };

  // Optimistic Offline Attendance Marking (< 60s execution speed)
  const handleMarkStudent = async (studentId: string, status: AttendanceStatus, note?: string) => {
    if (!activeSessionId || !activeRoster) return;
    if (activeRoster.status === "CLOSED") {
      setErrorMessage("Sesi absensi telah ditutup (immutable) dan tidak dapat diubah.");
      return;
    }

    const clientMutationId = `attendance:${activeSessionId}:${studentId}:${Date.now()}`;
    const baseStudent = activeRoster.roster.find((s) => s.studentId === studentId);

    // 1. Optimistic UI update
    const updatedRosterList = activeRoster.roster.map((s) => {
      if (s.studentId === studentId) {
        return {
          ...s,
          status,
          note: note !== undefined ? note : s.note,
          markedAt: new Date(),
        };
      }
      return s;
    });

    let present = 0, excused = 0, sick = 0, absent = 0, totalMarked = 0;
    for (const r of updatedRosterList) {
      if (r.status !== "UNRECORDED") {
        totalMarked++;
        if (r.status === "PRESENT") present++;
        else if (r.status === "EXCUSED") excused++;
        else if (r.status === "SICK") sick++;
        else if (r.status === "ABSENT") absent++;
      }
    }

    const updatedRoster: AttendanceRosterResult = {
      ...activeRoster,
      summary: {
        totalEligible: updatedRosterList.length,
        totalMarked,
        totalUnrecorded: updatedRosterList.length - totalMarked,
        present,
        excused,
        sick,
        absent,
      },
      roster: updatedRosterList,
    };
    setActiveRoster(updatedRoster);

    // 2. Queue mutation in local Offline Store
    const queuedMutation = await offlineStore.queueMutation({
      clientMutationId,
      sessionId: activeSessionId,
      institutionId: "tenant_current",
      userId: "teacher_current",
      studentId,
      attendanceStatus: status,
      note: note ?? baseStudent?.note ?? null,
      baseUpdatedAt: baseStudent?.markedAt ? new Date(baseStudent.markedAt).toISOString() : null,
      clientTimestamp: new Date().toISOString(),
    });

    await refreshLocalMutations(activeSessionId);

    // 3. If online, trigger background sync
    if (navigator.onLine) {
      syncWorker.syncSession(activeSessionId);
    }
  };

  // Handle "Semua Hadir" Bulk Marking
  const handleMarkAllPresent = async () => {
    if (!activeSessionId || !activeRoster) return;
    if (activeRoster.status === "CLOSED") return;

    for (const s of activeRoster.roster) {
      await handleMarkStudent(s.studentId, "PRESENT");
    }
    setSuccessMessage("Seluruh siswa berhasil ditandai HADIR secara lokal.");
  };

  // Manual Trigger Sync
  const handleTriggerSync = async () => {
    if (!activeSessionId) return;
    setIsSyncing(true);
    const result = await syncWorker.syncSession(activeSessionId);
    setIsSyncing(false);
    if (result) {
      loadRoster(activeSessionId);
    }
  };

  // Handle Close Session
  const handleCloseSession = () => {
    if (!activeSessionId || !activeRoster) return;
    if (activeRoster.summary.totalUnrecorded > 0) {
      setErrorMessage(
        `Sesi tidak dapat ditutup: Masih ada ${activeRoster.summary.totalUnrecorded} siswa yang belum dicatat.`
      );
      return;
    }

    if (queueStats.pending > 0 || queueStats.conflict > 0) {
      setErrorMessage(
        `Harap selesaikan sinkronisasi (${queueStats.pending} antrean, ${queueStats.conflict} konflik) sebelum menutup sesi.`
      );
      return;
    }

    const confirmClose = window.confirm(
      "Apakah Anda yakin ingin menutup sesi absensi ini?\n\nPERINGATAN: Sesi yang telah ditutup bersifat KEKAL (immutable) dan catatan kehadiran tidak dapat diubah lagi."
    );
    if (!confirmClose) return;

    startTransition(async () => {
      setErrorMessage(null);
      const res = await closeAttendanceSessionAction({
        attendanceSessionId: activeSessionId,
      });

      if (res.success) {
        setSuccessMessage("Sesi absensi resmi ditutup dan dikunci.");
        loadRoster(activeSessionId);
        loadAssignments(selectedDate);
      } else {
        setErrorMessage(res.error || "Gagal menutup sesi absensi.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16 text-stone-900">
      <NavHeader subtitle="Presensi & Absensi Harian" />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Banner Status Konektivitas & Offline Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                Mode Terputus (Offline)
              </span>
            )}

            <div className="text-xs text-stone-600 hidden sm:block">
              {queueStats.pending > 0 ? (
                <span className="font-semibold text-amber-700">
                  {queueStats.pending} perubahan tersimpan lokal menunggu sinkronisasi
                </span>
              ) : queueStats.conflict > 0 ? (
                <span className="font-semibold text-rose-700">
                  {queueStats.conflict} perubahan mengalami konflik
                </span>
              ) : (
                <span className="text-stone-500">Semua perubahan telah tersinkron</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSessionId && (queueStats.pending > 0 || queueStats.conflict > 0 || isSyncing) && (
              <button
                type="button"
                disabled={isSyncing || !isOnline}
                onClick={handleTriggerSync}
                className="touch-target inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
              </button>
            )}
          </div>
        </div>

        {/* Banner Alert Notifikasi */}
        {errorMessage && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="touch-target text-xs font-semibold hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="touch-target text-xs font-semibold hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {/* TAMPILAN 1: ROSTER AKTIF (JIKA SEDANG MENGISI SESI) */}
        {activeSessionId && activeRoster ? (
          <div className="space-y-6">
            {/* Header Sesi Aktif */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setActiveSessionId(null);
                    loadAssignments(selectedDate);
                  }}
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke Daftar Kelas
                </button>

                <div className="flex items-center gap-2">
                  {activeRoster.status === "CLOSED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                      <Lock className="h-3.5 w-3.5 text-stone-500" />
                      TERKUNCI (CLOSED)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                      <Clock className="h-3.5 w-3.5 text-teal-700 animate-pulse" />
                      SESI TERBUKA (OPEN)
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-stone-100 pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                      {activeRoster.assignment?.subjectName || activeRoster.dormitoryRoom?.dormitoryName || "Sesi Absensi"}
                    </h1>
                    <p className="mt-0.5 text-xs sm:text-sm text-stone-600 flex items-center gap-2">
                      <School className="h-4 w-4 text-stone-500" />
                      {activeRoster.assignment ? (
                        <>
                          <span>{activeRoster.assignment.classroomName}</span>
                          <span>•</span>
                          <span>TA {activeRoster.assignment.academicYearName}</span>
                          <span>•</span>
                          <span>Pengajar: {activeRoster.assignment.teacherName}</span>
                        </>
                      ) : activeRoster.dormitoryRoom ? (
                        <span>Kamar {activeRoster.dormitoryRoom.name}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-600 bg-stone-100 px-3 py-1 rounded-md">
                      <Calendar className="h-3.5 w-3.5 text-stone-500" />
                      {selectedDate}
                    </span>
                  </div>
                </div>

                {/* Ringkasan Kehadiran */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-center">
                    <span className="text-[11px] font-medium text-stone-500">Total Siswa</span>
                    <p className="text-lg font-bold text-stone-900">{activeRoster.summary.totalEligible}</p>
                  </div>
                  <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-teal-800">Hadir</span>
                    <p className="text-lg font-bold text-teal-700">{activeRoster.summary.present}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-amber-800">Izin</span>
                    <p className="text-lg font-bold text-amber-700">{activeRoster.summary.excused}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-blue-800">Sakit</span>
                    <p className="text-lg font-bold text-blue-700">{activeRoster.summary.sick}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2.5 text-center">
                    <span className="text-[11px] font-semibold text-rose-800">Alpa</span>
                    <p className="text-lg font-bold text-rose-700">{activeRoster.summary.absent}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-100 p-2.5 text-center col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-semibold text-stone-600">Belum Diisi</span>
                    <p className="text-lg font-bold text-stone-800">{activeRoster.summary.totalUnrecorded}</p>
                  </div>
                </div>

                {/* Toolbar Aksi Cepat */}
                {activeRoster.status !== "CLOSED" && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleMarkAllPresent}
                      className="touch-target inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-teal-800 active:scale-[0.98] transition min-h-[44px]"
                    >
                      <Check className="h-4 w-4" />
                      Tandai Semua Hadir
                    </button>

                    <button
                      type="button"
                      disabled={isPending || activeRoster.summary.totalUnrecorded > 0}
                      onClick={handleCloseSession}
                      className={`touch-target inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition min-h-[44px] ${
                        activeRoster.summary.totalUnrecorded > 0
                          ? "cursor-not-allowed bg-stone-200 text-stone-400"
                          : "bg-stone-900 text-white shadow-xs hover:bg-black active:scale-[0.98]"
                      }`}
                      title={
                        activeRoster.summary.totalUnrecorded > 0
                          ? "Semua siswa wajib dicatat sebelum sesi dapat ditutup."
                          : "Tutup dan kunci sesi absensi"
                      }
                    >
                      <Lock className="h-4 w-4" />
                      Tutup Sesi Absensi
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Daftar Siswa (Roster List) */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-stone-900">
                Daftar Siswa Rombel ({activeRoster.roster.length} Siswa)
              </h2>
              <p className="text-xs text-stone-500 mb-4">
                Siswa terdaftar resmi melalui relasi Enrollment aktif tahun ajaran penugasan ini.
              </p>

              <div className="divide-y divide-stone-100">
                {activeRoster.roster.map((item, idx) => {
                  const mutation = mutationsMap.get(item.studentId);
                  const isPendingSync = mutation?.syncStatus === "PENDING";
                  const isSyncingItem = mutation?.syncStatus === "SYNCING";
                  const isConflict = mutation?.syncStatus === "CONFLICT";

                  return (
                    <div
                      key={item.studentId}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 rounded-xl px-2 transition"
                    >
                      {/* Informasi Siswa */}
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-stone-900">{item.fullName}</span>
                            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                              {item.gender === "L" ? "Laki-laki" : "Perempuan"}
                            </span>

                            {/* Sync Status Badges */}
                            {isPendingSync && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                <Clock className="h-3 w-3 text-amber-600" />
                                Menunggu Sinkron
                              </span>
                            )}
                            {isSyncingItem && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded animate-pulse">
                                <RefreshCw className="h-3 w-3 text-teal-600 animate-spin" />
                                Menyinkronkan
                              </span>
                            )}
                            {isConflict && (
                              <button
                                type="button"
                                onClick={() => setConflictModalItem(mutation)}
                                className="touch-target inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100 transition"
                              >
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                ⚠ Konflik (Klik Selesaikan)
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-stone-500">NIS: {item.nis}</p>
                          {item.note && (
                            <p className="mt-0.5 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block">
                              Catatan: {item.note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tombol Pemilihan Status (4 Pilihan Touch Friendly) */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        {(["PRESENT", "EXCUSED", "SICK", "ABSENT"] as AttendanceStatus[]).map((st) => {
                          const isActive = item.status === st;
                          let activeStyle = "";
                          if (isActive) {
                            if (st === "PRESENT") activeStyle = "bg-teal-700 text-white border-teal-700 font-bold shadow-xs";
                            else if (st === "EXCUSED") activeStyle = "bg-amber-600 text-white border-amber-600 font-bold shadow-xs";
                            else if (st === "SICK") activeStyle = "bg-blue-600 text-white border-blue-600 font-bold shadow-xs";
                            else if (st === "ABSENT") activeStyle = "bg-rose-600 text-white border-rose-600 font-bold shadow-xs";
                          } else {
                            activeStyle = "bg-white text-stone-700 border-stone-200 hover:bg-stone-100";
                          }

                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={isPending || activeRoster.status === "CLOSED"}
                              onClick={() => handleMarkStudent(item.studentId, st, item.note || undefined)}
                              className={`touch-target rounded-lg border px-3 py-1.5 text-xs font-medium transition min-h-[44px] ${activeStyle} ${
                                activeRoster.status === "CLOSED" ? "opacity-90 cursor-not-allowed" : ""
                              }`}
                            >
                              {ATTENDANCE_STATUS_LABELS[st]}
                            </button>
                          );
                        })}

                        {/* Tombol Tambah Catatan */}
                        {activeRoster.status !== "CLOSED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotesOpenStudentId(item.studentId);
                              setStudentNote(item.note || "");
                            }}
                            title="Beri catatan kehadiran"
                            className="touch-target rounded-lg border border-stone-200 p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Resolusi Konflik Presensi */}
            {conflictModalItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-rose-100">
                  <div className="flex items-center gap-2 text-rose-700 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="text-base font-bold">Deteksi Konflik Sinkronisasi</h3>
                  </div>

                  <p className="text-xs text-stone-600 mb-4">
                    Catatan kehadiran siswa ini telah diubah di server setelah Anda mengambil data awal.
                  </p>

                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Pilihan Lokal Anda:</span>
                      <span className="font-bold text-teal-800">
                        {ATTENDANCE_STATUS_LABELS[conflictModalItem.attendanceStatus]}
                      </span>
                    </div>
                    {conflictModalItem.conflictData && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Status Terkini di Server:</span>
                        <span className="font-bold text-rose-800">
                          {ATTENDANCE_STATUS_LABELS[conflictModalItem.conflictData.serverStatus]}
                        </span>
                      </div>
                    )}
                    {conflictModalItem.errorMessage && (
                      <p className="text-[11px] text-stone-500 italic border-t border-stone-200 pt-1.5">
                        {conflictModalItem.errorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await syncWorker.resolveConflict(conflictModalItem.clientMutationId, "KEEP_SERVER");
                        setConflictModalItem(null);
                        if (activeSessionId) loadRoster(activeSessionId);
                      }}
                      className="touch-target rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                    >
                      Gunakan Pilihan Server
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await syncWorker.resolveConflict(conflictModalItem.clientMutationId, "FORCE_LOCAL");
                        setConflictModalItem(null);
                        if (activeSessionId) loadRoster(activeSessionId);
                      }}
                      className="touch-target rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800 min-h-[44px]"
                    >
                      Timpa ke Server (Force)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Tambah Catatan Siswa */}
            {notesOpenStudentId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
                <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                  <h3 className="text-base font-bold text-stone-900">Catatan Kehadiran</h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Misalnya alasan izin, diagnosa surat sakit, atau catatan khusus.
                  </p>
                  <textarea
                    rows={3}
                    value={studentNote}
                    onChange={(e) => setStudentNote(e.target.value)}
                    placeholder="Tuliskan catatan di sini..."
                    className="mt-3 w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-teal-600 focus:outline-hidden"
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNotesOpenStudentId(null)}
                      className="touch-target rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const student = activeRoster.roster.find((s) => s.studentId === notesOpenStudentId);
                        if (student && student.status !== "UNRECORDED") {
                          handleMarkStudent(student.studentId, student.status, studentNote);
                        }
                        setNotesOpenStudentId(null);
                      }}
                      className="touch-target rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 min-h-[44px]"
                    >
                      Simpan Catatan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAMPILAN 2: DAFTAR KELAS HARI INI & PILIH TANGGAL */
          <div className="space-y-6">
            {/* Header & Filter Tanggal */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                    Presensi & Absensi Harian
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-stone-600">
                    Sistem absensi berbasis penugasan mengajar dan histori Enrollment resmi dengan sinkronisasi offline.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-3 py-1.5">
                    <Calendar className="h-4 w-4 text-stone-500" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-xs sm:text-sm font-semibold text-stone-900 focus:outline-hidden"
                    />
                  </div>

                  <Link
                    href="/attendance/history"
                    className="touch-target inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                  >
                    <History className="h-4 w-4 text-stone-500" />
                    Histori
                  </Link>
                </div>
              </div>
            </div>

            {/* Daftar Penugasan Mengajar Hari Ini */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-stone-900">
                  Jadwal Mengajar Anda ({assignmentsData.length} Rombel)
                </h2>
                <button
                  onClick={() => loadAssignments(selectedDate)}
                  className="touch-target text-xs font-semibold text-teal-800 hover:underline flex items-center gap-1 min-h-[44px]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Segarkan
                </button>
              </div>

              {assignmentsData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                  <ClipboardCheck className="mx-auto h-12 w-12 text-stone-400" />
                  <h3 className="mt-3 text-sm font-bold text-stone-900">Tidak ada penugasan mengajar</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Anda belum memiliki penugasan mengajar aktif. Hubungi administrator institusi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignmentsData.map(({ assignment, session }) => {
                    const hasSession = !!session;
                    const isClosed = session?.status === "CLOSED";

                    return (
                      <div
                        key={assignment.id}
                        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs transition hover:border-stone-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600 mb-1.5">
                                {assignment.subject.code || "MAPEL"}
                              </span>
                              <h3 className="text-base font-bold text-stone-900">{assignment.subject.name}</h3>
                            </div>
                            {hasSession ? (
                              isClosed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                                  <Lock className="h-3 w-3 text-stone-500" />
                                  Selesai
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                                  <Clock className="h-3 w-3 text-teal-700" />
                                  Sesi Aktif
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                Belum Dibuka
                              </span>
                            )}
                          </div>

                          <div className="mt-4 space-y-1.5 text-xs text-stone-600">
                            <div className="flex items-center gap-2">
                              <School className="h-4 w-4 text-stone-400" />
                              <span>{assignment.classroom.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-stone-400" />
                              <span>Guru: {assignment.teacher.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-stone-400" />
                              <span>Tahun Ajaran: {assignment.academicYear.name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-stone-100 pt-4 flex items-center justify-between">
                          {hasSession ? (
                            <button
                              type="button"
                              onClick={() => setActiveSessionId(session.id)}
                              className="touch-target w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-teal-800 transition min-h-[44px]"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                              {isClosed ? "Lihat Catatan Absensi" : "Lanjutkan Absensi"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleOpenSession(assignment.id)}
                              className="touch-target w-full inline-flex items-center justify-center gap-2 rounded-xl border border-teal-700 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-teal-800 shadow-xs hover:bg-teal-50 transition min-h-[44px]"
                            >
                              <ClipboardCheck className="h-4 w-4 text-teal-700" />
                              Buka Sesi Absensi
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
