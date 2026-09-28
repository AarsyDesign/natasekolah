"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "../../../components/nav-header";
import {
  getAcademicYearsAction,
  getClassroomsAction,
} from "../../../actions/academic";
import {
  getPromotionCandidatesAction,
  previewBulkPromotionAction,
  executeBulkPromotionAction,
} from "../../../actions/promotion";
import type {
  PromotionPreviewSummary,
  PromotionExecutionResult,
} from "../../../lib/academic";
import {
  GraduationCap,
  Calendar,
  School,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  Plus,
  Trash2,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Check,
} from "lucide-react";
import { SuccessCheck } from "../../../components/ui/success-check";
import { Dialog } from "../../../components/ui/dialog";

interface ClassroomMappingItem {
  id: string;
  sourceClassroomId: string;
  targetClassroomId: string;
}

export default function BulkPromotionPage() {
  // Stepper: 1: Setup & Mapping, 2: Student Selection, 3: Review & Preview, 4: Result
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Master Data
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [sourceRooms, setSourceRooms] = useState<any[]>([]);
  const [targetRooms, setTargetRooms] = useState<any[]>([]);

  // Step 1: Mappings
  const [mappings, setMappings] = useState<ClassroomMappingItem[]>([]);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Step 2: Candidates & Selection
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [candidateFilterRoom, setCandidateFilterRoom] = useState<string>("");
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Step 3: Preview Data
  const [previewSummary, setPreviewSummary] = useState<PromotionPreviewSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"ALL" | "READY" | "WARNING" | "ERROR">("ALL");
  const [allowWarnings, setAllowWarnings] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);

  // Step 4: Execution Result
  const [executionResult, setExecutionResult] = useState<PromotionExecutionResult | null>(null);

  // Global UI States
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load Academic Years
  useEffect(() => {
    async function loadYears() {
      setLoadingInitial(true);
      setGeneralError(null);
      try {
        const res = await getAcademicYearsAction();
        if (res.success && res.data) {
          setAcademicYears(res.data);
          const activeYear = res.data.find((y: any) => y.isActive);
          if (activeYear) {
            setSourceYearId(activeYear.id);
          } else if (res.data.length > 0) {
            setSourceYearId(res.data[0].id);
          }

          // Choose a default target year (different from source)
          const otherYear = res.data.find((y: any) => y.id !== (activeYear?.id || res.data[0]?.id));
          if (otherYear) {
            setTargetYearId(otherYear.id);
          }
        } else {
          setGeneralError(res.error || "Gagal memuat tahun ajaran.");
        }
      } catch {
        setGeneralError("Terjadi gangguan koneksi saat memuat data.");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadYears();
  }, []);

  // Load Classrooms when sourceYearId changes
  useEffect(() => {
    async function loadSourceClassrooms() {
      if (!sourceYearId) {
        setSourceRooms([]);
        return;
      }
      const res = await getClassroomsAction(sourceYearId);
      if (res.success && res.data) {
        setSourceRooms(res.data);
      }
    }
    loadSourceClassrooms();
  }, [sourceYearId]);

  // Load Classrooms when targetYearId changes
  useEffect(() => {
    async function loadTargetClassrooms() {
      if (!targetYearId) {
        setTargetRooms([]);
        return;
      }
      const res = await getClassroomsAction(targetYearId);
      if (res.success && res.data) {
        setTargetRooms(res.data);
      }
    }
    loadTargetClassrooms();
  }, [targetYearId]);

  // When source or target rooms change, initialize default mappings if empty
  useEffect(() => {
    if (sourceRooms.length > 0 && targetRooms.length > 0 && mappings.length === 0) {
      // Try to auto-map based on similar grade level or order
      const initialMappings: ClassroomMappingItem[] = [];
      sourceRooms.forEach((sr, idx) => {
        // Find matching target classroom by name or index
        const matched = targetRooms.find((tr) => tr.name.toLowerCase() === sr.name.toLowerCase()) || targetRooms[idx];
        if (matched) {
          initialMappings.push({
            id: `map_${Date.now()}_${idx}`,
            sourceClassroomId: sr.id,
            targetClassroomId: matched.id,
          });
        }
      });
      if (initialMappings.length > 0) {
        setMappings(initialMappings);
      }
    }
  }, [sourceRooms, targetRooms]);

  // Handlers for Mappings
  const handleAddMapping = () => {
    if (sourceRooms.length === 0 || targetRooms.length === 0) return;
    setMappings((prev) => [
      ...prev,
      {
        id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        sourceClassroomId: sourceRooms[0].id,
        targetClassroomId: targetRooms[0].id,
      },
    ]);
  };

  const handleRemoveMapping = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMapping = (id: string, field: "sourceClassroomId" | "targetClassroomId", value: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  // Step 1 -> Step 2
  const handleProceedToSelection = async () => {
    setMappingError(null);
    if (!sourceYearId || !targetYearId) {
      setMappingError("Tahun ajaran asal dan target harus dipilih.");
      return;
    }
    if (sourceYearId === targetYearId) {
      setMappingError("Tahun ajaran target harus berbeda dari tahun ajaran asal.");
      return;
    }
    if (mappings.length === 0) {
      setMappingError("Minimal satu pemetaan rombel harus ditentukan.");
      return;
    }

    // Verify all mappings have valid selections
    for (const m of mappings) {
      if (!m.sourceClassroomId || !m.targetClassroomId) {
        setMappingError("Seluruh baris pemetaan rombel wajib diisi lengkap.");
        return;
      }
    }

    // Load Candidates
    setLoadingCandidates(true);
    setStep(2);

    try {
      const mappedSourceRoomIds = Array.from(new Set(mappings.map((m) => m.sourceClassroomId)));
      const candidateList: any[] = [];

      for (const roomId of mappedSourceRoomIds) {
        const res = await getPromotionCandidatesAction({
          sourceAcademicYearId: sourceYearId,
          sourceClassroomId: roomId,
          targetAcademicYearId: targetYearId,
          pageSize: 100,
        });

        if (res.success && res.data) {
          candidateList.push(...res.data.data);
        }
      }

      setCandidates(candidateList);
      // Select all candidate students by default (except those already enrolled in target)
      const initialSelected = new Set<string>();
      candidateList.forEach((c) => {
        if (!c.isAlreadyEnrolledInTarget) {
          initialSelected.add(c.studentId);
        }
      });
      setSelectedStudentIds(initialSelected);
    } catch {
      setGeneralError("Gagal memuat daftar siswa untuk rombel yang dipilih.");
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Candidate Selection Helpers
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const selectAllEligible = () => {
    const next = new Set<string>();
    candidates.forEach((c) => {
      if (!c.isAlreadyEnrolledInTarget) {
        next.add(c.studentId);
      }
    });
    setSelectedStudentIds(next);
  };

  const deselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  // Step 2 -> Step 3: Run Preview
  const handleProceedToPreview = async () => {
    if (selectedStudentIds.size === 0) {
      setGeneralError("Pilih minimal satu siswa untuk dipromosikan.");
      return;
    }

    setIsPreviewLoading(true);
    setGeneralError(null);

    try {
      const res = await previewBulkPromotionAction({
        sourceAcademicYearId: sourceYearId,
        targetAcademicYearId: targetYearId,
        classroomMappings: mappings.map((m) => ({
          sourceClassroomId: m.sourceClassroomId,
          targetClassroomId: m.targetClassroomId,
        })),
        selectedStudentIds: Array.from(selectedStudentIds),
      });

      if (res.success && res.data) {
        setPreviewSummary(res.data);
        setStep(3);
      } else {
        setGeneralError(res.error || "Gagal memproses prapinjau kenaikan kelas.");
      }
    } catch {
      setGeneralError("Terjadi kesalahan jaringan saat memvalidasi promosi.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Step 3 -> Step 4: Execute Promotion
  const handleExecutePromotion = () => {
    if (!previewSummary) return;

    // Filter items to promote: only READY, or READY + WARNING if allowWarnings is true
    const eligibleRows = previewSummary.rows.filter((r) => {
      if (r.status === "READY") return true;
      if (r.status === "WARNING" && allowWarnings) return true;
      return false;
    });

    if (eligibleRows.length === 0) {
      setGeneralError("Tidak ada siswa yang memenuhi syarat untuk dipromosikan.");
      return;
    }

    startTransition(async () => {
      setIsConfirmDialogOpen(false);
      try {
        const res = await executeBulkPromotionAction({
          sourceAcademicYearId: sourceYearId,
          targetAcademicYearId: targetYearId,
          promotions: eligibleRows.map((r) => ({
            studentId: r.studentId,
            targetClassroomId: r.targetClassroomId,
          })),
          allowWarnings,
        });

        if (res.success && res.data) {
          setExecutionResult(res.data);
          setStep(4);
        } else {
          setGeneralError(res.error || "Eksekusi kenaikan kelas gagal.");
        }
      } catch {
        setGeneralError("Terjadi gangguan jaringan saat mengeksekusi kenaikan kelas.");
      }
    });
  };

  // Filtered candidate list in Step 2
  const filteredCandidates = candidates.filter((c) => {
    if (candidateFilterRoom && c.classroomId !== candidateFilterRoom) return false;
    if (candidateSearch) {
      const query = candidateSearch.toLowerCase();
      const matchName = c.fullName.toLowerCase().includes(query);
      const matchNis = c.nis.toLowerCase().includes(query);
      return matchName || matchNis;
    }
    return true;
  });

  // Filtered preview rows in Step 3
  const filteredPreviewRows = previewSummary?.rows.filter((r) => {
    if (previewFilter === "ALL") return true;
    return r.status === previewFilter;
  }) || [];

  const sourceYearObj = academicYears.find((y) => y.id === sourceYearId);
  const targetYearObj = academicYears.find((y) => y.id === targetYearId);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16">
      <NavHeader subtitle="Kenaikan Kelas Massal" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-stone-500">
          <Link href="/dashboard" className="transition hover:text-stone-800">
            Beranda
          </Link>
          <ChevronRight className="h-3 w-3 text-stone-400" />
          <Link href="/students" className="transition hover:text-stone-800">
            Buku Induk
          </Link>
          <ChevronRight className="h-3 w-3 text-stone-400" />
          <span className="font-semibold text-stone-800">Kenaikan Kelas Massal</span>
        </nav>

        {/* Title Header */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl flex items-center gap-2.5">
              <GraduationCap className="h-7 w-7 text-teal-800 shrink-0" />
              Kenaikan Kelas Massal
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Workflow kenaikan kelas siswa antar-tahun ajaran dengan penjagaan mutlak riwayat historis (<em>Sacred History</em>).
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />
            <span>Riwayat Lama Tidak Ditimpa</span>
          </div>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Terjadi Kesalahan</span>
              <span>{generalError}</span>
            </div>
            <button
              onClick={() => setGeneralError(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-semibold p-1"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Stepper Progress Bar */}
        <div className="mb-8 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
            {/* Step 1 */}
            <div
              className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                step === 1
                  ? "bg-teal-50 text-teal-900 border border-teal-200"
                  : step > 1
                  ? "text-stone-700"
                  : "text-stone-400"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step === 1
                    ? "bg-teal-800 text-white"
                    : step > 1
                    ? "bg-teal-100 text-teal-800"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {step > 1 ? <Check className="h-4 w-4" /> : "1"}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider">Tahap 1</span>
                <span className="block truncate text-xs">Tahun & Rombel</span>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                step === 2
                  ? "bg-teal-50 text-teal-900 border border-teal-200"
                  : step > 2
                  ? "text-stone-700"
                  : "text-stone-400"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step === 2
                    ? "bg-teal-800 text-white"
                    : step > 2
                    ? "bg-teal-100 text-teal-800"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {step > 2 ? <Check className="h-4 w-4" /> : "2"}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider">Tahap 2</span>
                <span className="block truncate text-xs">Pilih Siswa</span>
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                step === 3
                  ? "bg-teal-50 text-teal-900 border border-teal-200"
                  : step > 3
                  ? "text-stone-700"
                  : "text-stone-400"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step === 3
                    ? "bg-teal-800 text-white"
                    : step > 3
                    ? "bg-teal-100 text-teal-800"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {step > 3 ? <Check className="h-4 w-4" /> : "3"}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider">Tahap 3</span>
                <span className="block truncate text-xs">Validasi & Prapinjau</span>
              </div>
            </div>

            {/* Step 4 */}
            <div
              className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                step === 4
                  ? "bg-teal-50 text-teal-900 border border-teal-200"
                  : "text-stone-400"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step === 4
                    ? "bg-teal-800 text-white"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                4
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider">Tahap 4</span>
                <span className="block truncate text-xs">Hasil Eksekusi</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: SETUP & CLASSROOM MAPPINGS */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs animate-fade-in">
            <div className="mb-6 border-b border-stone-200 pb-4">
              <h2 className="text-base font-semibold text-stone-900">
                Langkah 1: Tentukan Tahun Ajaran & Pemetaan Rombel
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Tentukan tahun ajaran asal dan tahun ajaran tujuan, lalu pasangkan rombel asal ke rombel sasaran.
              </p>
            </div>

            {/* Academic Year Selection Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8">
              {/* Source Academic Year */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-stone-500" />
                  Tahun Ajaran Asal (Saat Ini)
                </label>
                <select
                  value={sourceYearId}
                  onChange={(e) => {
                    setSourceYearId(e.target.value);
                    setMappings([]);
                  }}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-900 shadow-2xs focus:border-teal-700 focus:outline-hidden"
                >
                  <option value="">Pilih Tahun Ajaran Asal</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isActive ? "(Aktif)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  Data siswa akan diambil dari rombel-rombel pada tahun ajaran ini.
                </p>
              </div>

              {/* Target Academic Year */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-700" />
                  Tahun Ajaran Target (Tujuan Kenaikan)
                </label>
                <select
                  value={targetYearId}
                  onChange={(e) => {
                    setTargetYearId(e.target.value);
                    setMappings([]);
                  }}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-900 shadow-2xs focus:border-teal-700 focus:outline-hidden"
                >
                  <option value="">Pilih Tahun Ajaran Target</option>
                  {academicYears
                    .filter((y) => y.id !== sourceYearId)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isActive ? "(Aktif)" : ""}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  Tahun ajaran tempat siswa akan menerima penempatan rombel baru.
                </p>
              </div>
            </div>

            {/* Mapping Section Header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <School className="h-4 w-4 text-stone-500" />
                  Pemetaan Rombongan Belajar (Classroom Mapping)
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">
                  Setiap rombel asal akan dipetakan ke rombel tujuan di tahun ajaran target.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddMapping}
                disabled={sourceRooms.length === 0 || targetRooms.length === 0}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Pemetaan</span>
              </button>
            </div>

            {/* Mapping Alert if error */}
            {mappingError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{mappingError}</span>
              </div>
            )}

            {/* Mapping Table */}
            {sourceRooms.length === 0 || targetRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-xs text-stone-500">
                <School className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                <p className="font-semibold text-stone-700">Rombel Belum Tersedia</p>
                <p className="mt-1">
                  Pastikan tahun ajaran asal dan tahun ajaran target telah memiliki rombel terdaftar.
                </p>
              </div>
            ) : mappings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-xs text-stone-500">
                <p className="font-semibold text-stone-700">Belum Ada Pemetaan Rombel</p>
                <p className="mt-1">Klik tombol &quot;Tambah Pemetaan&quot; di atas untuk menghubungkan rombel asal ke rombel target.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-stone-200 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-600">
                    <tr>
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Rombel Asal ({sourceYearObj?.name || "Asal"})</th>
                      <th className="py-3 px-2 text-center w-10"></th>
                      <th className="py-3 px-4">Rombel Sasaran ({targetYearObj?.name || "Target"})</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {mappings.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-stone-50/50">
                        <td className="py-3 px-4 font-mono text-stone-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <select
                            value={m.sourceClassroomId}
                            onChange={(e) => handleUpdateMapping(m.id, "sourceClassroomId", e.target.value)}
                            className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-teal-700 focus:outline-hidden"
                          >
                            {sourceRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} {r.gradeLevel ? `(Tingkat ${r.gradeLevel})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2 text-center text-stone-400">
                          <ArrowRight className="mx-auto h-4 w-4 text-stone-400" />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={m.targetClassroomId}
                            onChange={(e) => handleUpdateMapping(m.id, "targetClassroomId", e.target.value)}
                            className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-teal-700 focus:outline-hidden"
                          >
                            {targetRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} {r.gradeLevel ? `(Tingkat ${r.gradeLevel})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMapping(m.id)}
                            className="touch-target inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            aria-label="Hapus baris pemetaan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Next Action Button */}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleProceedToSelection}
                disabled={mappings.length === 0 || sourceRooms.length === 0 || targetRooms.length === 0}
                className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-50"
              >
                <span>Lanjut ke Pemilihan Siswa</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: STUDENT SELECTION */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs animate-fade-in">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Langkah 2: Pilih Siswa yang Akan Dipromosikan
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Pilih seluruh siswa dalam rombel atau sesuaikan siswa tertentu yang berhak naik kelas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllEligible}
                  className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
                >
                  Batal Pilih
                </button>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Cari siswa berdasarkan nama atau NIS..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="touch-target w-full rounded-md border border-stone-200 bg-white pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:border-teal-700 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-stone-400" />
                <select
                  value={candidateFilterRoom}
                  onChange={(e) => setCandidateFilterRoom(e.target.value)}
                  className="touch-target rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 focus:border-teal-700 focus:outline-hidden"
                >
                  <option value="">Semua Rombel Terpetakan</option>
                  {Array.from(new Set(mappings.map((m) => m.sourceClassroomId))).map((id) => {
                    const room = sourceRooms.find((r) => r.id === id);
                    return (
                      <option key={id} value={id}>
                        {room ? room.name : id}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-md">
                Terpilih: <strong>{selectedStudentIds.size}</strong> dari {candidates.length} siswa
              </div>
            </div>

            {/* Candidate Table */}
            {loadingCandidates ? (
              <div className="flex h-48 flex-col items-center justify-center p-8 text-center text-xs text-stone-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-800 border-t-transparent mb-2" />
                <span>Memuat data calon siswa...</span>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
                <Users className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                <p className="font-semibold text-stone-700">Tidak Ada Siswa Ditemukan</p>
                <p className="mt-1">Tidak ada siswa yang terdaftar di rombel terpilih atau pencarian tidak cocok.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-600">
                    <tr>
                      <th className="py-3 px-4 w-10 text-center">Pilih</th>
                      <th className="py-3 px-4">Nama Lengkap & NIS</th>
                      <th className="py-3 px-4">Rombel Saat Ini</th>
                      <th className="py-3 px-4">Rombel Tujuan (Tahun Target)</th>
                      <th className="py-3 px-4">Status Siswa</th>
                      <th className="py-3 px-4">Status Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {filteredCandidates.map((c) => {
                      const isSelected = selectedStudentIds.has(c.studentId);
                      const isConflict = c.isAlreadyEnrolledInTarget;
                      const mappedTargetId = mappings.find((m) => m.sourceClassroomId === c.classroomId)?.targetClassroomId;
                      const targetRoom = targetRooms.find((r) => r.id === mappedTargetId);

                      return (
                        <tr
                          key={c.studentId}
                          className={`hover:bg-stone-50/50 ${
                            isConflict ? "bg-rose-50/30 text-stone-500" : isSelected ? "bg-teal-50/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isConflict}
                              onChange={() => toggleStudentSelection(c.studentId)}
                              className="h-4 w-4 rounded-xs border-stone-300 text-teal-800 focus:ring-teal-700 disabled:opacity-30"
                              aria-label={`Pilih ${c.fullName}`}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-stone-900 block">{c.fullName}</span>
                            <span className="font-mono text-stone-500 text-[11px]">NIS: {c.nis}</span>
                          </td>
                          <td className="py-3 px-4 text-stone-700">{c.classroomName}</td>
                          <td className="py-3 px-4 font-medium text-teal-800">
                            {targetRoom ? targetRoom.name : "Belum ditentukan"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                c.status === "ACTIVE"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isConflict ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                Sudah Terdaftar di Target
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                Siap Dipromosikan
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stepper Buttons */}
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali</span>
              </button>

              <button
                type="button"
                onClick={handleProceedToPreview}
                disabled={selectedStudentIds.size === 0 || isPreviewLoading}
                className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-50"
              >
                {isPreviewLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Memvalidasi...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut ke Prapinjau ({selectedStudentIds.size} Siswa)</span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: REVIEW & PREVIEW */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && previewSummary && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Total Calon
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1 block">
                  {previewSummary.totalStudents}
                </span>
                <span className="text-xs text-stone-400 mt-1 block">Siswa dipilih</span>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 shadow-xs">
                <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider block">
                  Siap Promosi
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-teal-900 mt-1 block">
                  {previewSummary.readyCount}
                </span>
                <span className="text-xs text-teal-700 mt-1 block">Valid tanpa kendala</span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                  Perhatian (Warning)
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-amber-900 mt-1 block">
                  {previewSummary.warningCount}
                </span>
                <span className="text-xs text-amber-700 mt-1 block">Status non-ACTIVE</span>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
                <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider block">
                  Konflik (Error)
                </span>
                <span className="text-2xl font-bold font-mono tabular-nums text-rose-900 mt-1 block">
                  {previewSummary.errorCount}
                </span>
                <span className="text-xs text-rose-700 mt-1 block">Sudah terdaftar</span>
              </div>
            </div>

            {/* Warning Checkbox if warning exists */}
            {previewSummary.warningCount > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-900">
                      Terdapat {previewSummary.warningCount} siswa dengan status kesiswaan bukan ACTIVE
                    </h4>
                    <p className="mt-1 text-xs text-amber-800">
                      Secara default, promosi kesiswaan diperuntukkan bagi siswa berstatus aktif. Anda dapat mencentang opsi di bawah jika ingin tetap menaikkan kelas siswa berstatus nonaktif.
                    </p>
                    <label className="mt-3 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowWarnings}
                        onChange={(e) => setAllowWarnings(e.target.checked)}
                        className="h-4 w-4 rounded-xs border-amber-300 text-teal-800 focus:ring-teal-700"
                      />
                      <span className="text-xs font-semibold text-amber-950">
                        Izinkan Kenaikan Kelas untuk Siswa Berstatus Peringatan (Warning)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner if errors exist */}
            {previewSummary.errorCount > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-rose-900">
                      {previewSummary.errorCount} siswa mengalami konflik dan akan otomatis dilewati saat eksekusi
                    </h4>
                    <p className="mt-1 text-xs text-rose-800">
                      Siswa dengan status Error telah terdaftar pada tahun ajaran target atau rombel target tidak valid. Transaksi promosi hanya akan memproses siswa yang memenuhi syarat.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Table Card */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">Rincian Siswa Calon Kenaikan Kelas</h3>
                  <p className="text-xs text-stone-500">
                    Dari: <strong>{previewSummary.sourceAcademicYear.name}</strong> &rarr; Ke:{" "}
                    <strong>{previewSummary.targetAcademicYear.name}</strong>
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("ALL")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      previewFilter === "ALL"
                        ? "bg-stone-800 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    Semua ({previewSummary.totalStudents})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter("READY")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      previewFilter === "READY"
                        ? "bg-teal-800 text-white"
                        : "bg-teal-50 text-teal-800 hover:bg-teal-100"
                    }`}
                  >
                    Siap ({previewSummary.readyCount})
                  </button>
                  {previewSummary.warningCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("WARNING")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        previewFilter === "WARNING"
                          ? "bg-amber-800 text-white"
                          : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      Warning ({previewSummary.warningCount})
                    </button>
                  )}
                  {previewSummary.errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("ERROR")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        previewFilter === "ERROR"
                          ? "bg-rose-800 text-white"
                          : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                      }`}
                    >
                      Error ({previewSummary.errorCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-stone-200 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-600">
                    <tr>
                      <th className="py-3 px-4">Siswa</th>
                      <th className="py-3 px-4">Rombel Asal</th>
                      <th className="py-3 px-4">Rombel Tujuan</th>
                      <th className="py-3 px-4">Status Promosi</th>
                      <th className="py-3 px-4">Catatan Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {filteredPreviewRows.map((r) => (
                      <tr key={r.studentId} className="hover:bg-stone-50/50">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-stone-900 block">{r.studentName}</span>
                          <span className="font-mono text-stone-500 text-[11px]">NIS: {r.nis}</span>
                        </td>
                        <td className="py-3 px-4 text-stone-700">{r.sourceClassroomName}</td>
                        <td className="py-3 px-4 font-semibold text-teal-800">{r.targetClassroomName}</td>
                        <td className="py-3 px-4">
                          {r.status === "READY" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-semibold text-teal-800">
                              <CheckCircle2 className="h-3 w-3" />
                              READY
                            </span>
                          )}
                          {r.status === "WARNING" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              <AlertTriangle className="h-3 w-3" />
                              WARNING
                            </span>
                          )}
                          {r.status === "ERROR" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-800">
                              <AlertCircle className="h-3 w-3" />
                              ERROR
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-600">
                          {r.message || <span className="text-stone-400">Siap dipromosikan</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Kembali ke Pemilihan Siswa</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmDialogOpen(true)}
                  disabled={previewSummary.readyCount === 0 && (!allowWarnings || previewSummary.warningCount === 0)}
                  className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Konfirmasi Kenaikan Kelas</span>
                </button>
              </div>
            </div>

            {/* Confirmation Dialog Modal */}
            <Dialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)}>
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-stone-200 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900">Konfirmasi Kenaikan Kelas</h3>
                    <p className="text-xs text-stone-500">Operasi administratif data kesiswaan</p>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Tahun Ajaran Asal:</span>
                    <strong className="text-stone-900">{previewSummary.sourceAcademicYear.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Tahun Ajaran Sasaran:</span>
                    <strong className="text-teal-800">{previewSummary.targetAcademicYear.name}</strong>
                  </div>
                  <div className="flex justify-between border-t border-stone-200 pt-2">
                    <span className="text-stone-500">Jumlah Siswa Dipromosikan:</span>
                    <strong className="text-base font-bold font-mono text-stone-900">
                      {previewSummary.readyCount + (allowWarnings ? previewSummary.warningCount : 0)} Siswa
                    </strong>
                  </div>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  Operasi ini akan membuat catatan enrollment baru pada tahun ajaran target. Seluruh riwayat penempatan kelas tahun sebelumnya <strong>tetap tersimpan secara permanen</strong> pada Buku Induk Siswa.
                </p>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setIsConfirmDialogOpen(false)}
                    disabled={isPending}
                    className="touch-target rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePromotion}
                    disabled={isPending}
                    className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Mengeksekusi...</span>
                      </>
                    ) : (
                      <>
                        <span>Ya, Jalankan Kenaikan Kelas</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Dialog>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 4: EXECUTION RESULT */}
        {/* ------------------------------------------------------------- */}
        {step === 4 && executionResult && (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-xs">
              <SuccessCheck size="lg" className="mx-auto mb-4" />
              <h2 className="text-xl font-bold text-stone-900 sm:text-2xl">
                Kenaikan Kelas Berhasil Dijalankan!
              </h2>
              <p className="mt-2 text-sm text-stone-600 max-w-md mx-auto">
                Sebanyak <strong>{executionResult.totalPromoted} siswa</strong> telah berhasil dipromosikan ke tahun ajaran baru dengan integritas riwayat historis terjamin.
              </p>

              <div className="mx-auto mt-6 max-w-lg rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Tahun Ajaran Asal:</span>
                  <span className="font-semibold text-stone-900">{sourceYearObj?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Tahun Ajaran Sasaran:</span>
                  <span className="font-semibold text-teal-800">{targetYearObj?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Siswa Terpromosi:</span>
                  <span className="font-bold font-mono text-teal-900">{executionResult.totalPromoted} Siswa</span>
                </div>
                <div className="flex justify-between border-t border-teal-200 pt-2 text-stone-500">
                  <span>ID Jejak Audit:</span>
                  <span className="font-mono text-[11px] text-stone-700">{executionResult.auditLogId}</span>
                </div>
              </div>

              {/* Action Links */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/students"
                  className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 w-full sm:w-auto justify-center"
                >
                  <Users className="h-4 w-4" />
                  <span>Lihat Buku Induk Siswa</span>
                </Link>

                <Link
                  href="/classrooms"
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 w-full sm:w-auto justify-center"
                >
                  <School className="h-4 w-4" />
                  <span>Lihat Daftar Rombel</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setPreviewSummary(null);
                    setExecutionResult(null);
                    setSelectedStudentIds(new Set());
                  }}
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 w-full sm:w-auto justify-center"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Promosi Lainnya</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
