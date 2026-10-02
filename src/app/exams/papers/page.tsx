"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { listExamsAction, createExamAction } from "@/actions/exam-paper";
import { getSubjectsAction } from "@/actions/teaching";
import { getAcademicYearsAction } from "@/actions/academic";
import { NavHeader } from "@/components/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  EXAM_TYPE_OPTIONS,
  EXAM_STATUS_OPTIONS,
  EXAM_STATUS_BADGE,
  EXAM_TRANSITION_ACTION_LABEL,
  examTypeLabel,
  examStatusLabel,
  examLayoutLabel,
  formatExamDate,
  type ExamListItem,
} from "@/components/exam-paper/exam-paper-ui";

const PAGE_SIZE = 20;

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
}

interface ExamFilterState {
  search: string;
  status: string;
  subjectId: string;
  examType: string;
}

/**
 * Rute /exams/papers: daftar naskah ujian (Phase 10.2) dengan filter,
 * pagination, dan modal buat naskah. Mobile-first 430px.
 */
export default function ExamPapersPage() {
  const router = useRouter();

  const [items, setItems] = useState<ExamListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canManage, setCanManage] = useState(false);

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const [filters, setFilters] = useState<ExamFilterState>({
    search: "",
    status: "",
    subjectId: "",
    examType: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Modal buat naskah
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subjectId: "",
    academicYearId: "",
    examType: "DAILY",
    instructions: "",
    columnLayout: "ONE",
    showAnswers: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Pencarian debounce 350ms
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = filters.search.trim();
      setDebouncedSearch((prev) => (prev === next ? prev : next));
    }, 350);
    return () => clearTimeout(handle);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, filters.subjectId, filters.examType]);

  // Meta (mapel + tahun ajaran) hanya perlu sekali
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [subjectRes, yearRes] = await Promise.all([
          getSubjectsAction({ page: 1, pageSize: 100 }),
          getAcademicYearsAction(),
        ]);
        if (!active) return;
        if (subjectRes.success && subjectRes.data?.items) {
          setSubjects(subjectRes.data.items);
        }
        if (yearRes.success && Array.isArray(yearRes.data)) {
          setAcademicYears(yearRes.data);
        }
      } catch {
        // bagian meta opsional — kegagalan diamkan
      } finally {
        if (active) setMetaLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Muat daftar naskah
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await listExamsAction({
          page,
          pageSize: PAGE_SIZE,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
          ...(filters.examType ? { examType: filters.examType } : {}),
        });
        if (!active) return;
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotal(res.data.total);
          setTotalPages(res.data.totalPages);
          setCanManage(res.data.canManage);
        } else if (!res.success) {
          setError(res.error || "Gagal memuat daftar naskah ujian.");
        }
      } catch {
        if (active) {
          setError(
            "Koneksi terputus saat mengambil daftar naskah. Silakan periksa jaringan Anda lalu coba lagi."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, debouncedSearch, filters.status, filters.subjectId, filters.examType, reloadKey]);

  const updateFilter = (key: keyof ExamFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setMessage(null);
    setFormError(null);
    const activeYear = academicYears.find((y: any) => y.isActive);
    setForm({
      title: "",
      subjectId: "",
      academicYearId: activeYear?.id ?? academicYears[0]?.id ?? "",
      examType: "DAILY",
      instructions: "",
      columnLayout: "ONE",
      showAnswers: false,
    });
    setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.title.trim().length < 3) {
      setFormError("Judul naskah minimal 3 karakter.");
      return;
    }
    if (!form.subjectId) {
      setFormError("Pilih mata pelajaran terlebih dahulu.");
      return;
    }
    if (!form.academicYearId) {
      setFormError("Pilih tahun ajaran terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const res = await createExamAction({
        title: form.title.trim(),
        subjectId: form.subjectId,
        academicYearId: form.academicYearId,
        examType: form.examType,
        instructions: form.instructions.trim() ? form.instructions.trim() : null,
        columnLayout: form.columnLayout,
        showAnswers: form.showAnswers,
      });

      if (!res.success) {
        setFormError(res.error || "Gagal membuat naskah ujian.");
      } else {
        setCreateOpen(false);
        setMessage({ text: "Naskah ujian berhasil dibuat. Lanjutkan menyusun soal.", type: "success" });
        router.push(`/exams/papers/${res.data.id}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Akademik" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <FileText className="h-4 w-4" />
              <span>Exam Paper Engine</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Naskah Ujian
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Susun naskah ujian jadi cetak dari Bank Soal — atur komposisi, poin,
              dan urutan sebelum diekspor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white p-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50"
              title="Segarkan data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {canManage && (
              <Button onClick={openCreate} size="sm" className="h-9 px-3">
                <Plus className="h-4 w-4" />
                <span>Buat Naskah</span>
              </Button>
            )}
          </div>
        </div>

        {/* Feedback banner */}
        {message && (
          <div
            className={`mb-6 rounded-xl p-4 text-xs font-medium ${
              message.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="touch-target rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Cari judul naskah..."
              aria-label="Cari judul naskah"
              className="touch-target w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 shadow-2xs placeholder:text-stone-400"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            aria-label="Filter status"
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua status</option>
            {EXAM_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.subjectId}
            onChange={(e) => updateFilter("subjectId", e.target.value)}
            aria-label="Filter mata pelajaran"
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua mata pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filters.examType}
            onChange={(e) => updateFilter("examType", e.target.value)}
            aria-label="Filter jenis ujian"
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua jenis ujian</option>
            {EXAM_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <FileText className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-700">
              Belum ada naskah ujian
            </p>
            <p className="mt-1 max-w-sm text-xs text-stone-500">
              {canManage
                ? 'Klik "Buat Naskah" untuk menyusun naskah ujian baru dari Bank Soal.'
                : "Belum ada naskah pada filter ini. Coba ubah filter pencarian."}
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((exam) => (
                <li
                  key={exam.id}
                  className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs transition hover:border-teal-200"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-stone-900">
                          {exam.title}
                        </span>
                        <Badge variant={EXAM_STATUS_BADGE[exam.status] || "neutral"}>
                          {examStatusLabel(exam.status)}
                        </Badge>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          {examTypeLabel(exam.examType)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600">
                        {exam.subject?.name || "-"}
                        {exam.academicYear ? ` · ${exam.academicYear.name}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        {exam._count?.questions ?? 0} butir soal · {examLayoutLabel(exam.columnLayout)} ·{" "}
                        Dibuat {formatExamDate(exam.createdAt)}
                        {exam.createdBy ? ` · ${exam.createdBy.name}` : ""}
                      </p>
                    </div>

                    <Link
                      href={`/exams/papers/${exam.id}`}
                      className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
                    >
                      <span>Buka</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              className="mt-4"
            />
          </>
        )}
      </main>

      {/* Modal Buat Naskah */}
      <Dialog isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogHeader>
          <DialogTitle>Buat Naskah Ujian</DialogTitle>
          <DialogDescription>
            Isi identitas naskah. Komposisi soal disusun di halaman detail setelah naskah dibuat.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="exam-title" className="mb-1 block text-xs font-medium text-stone-700">
              Judul naskah
            </label>
            <input
              id="exam-title"
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="mis. UTS Ganjil Matematika Kelas 8"
              className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exam-subject" className="mb-1 block text-xs font-medium text-stone-700">
                Mata pelajaran
              </label>
              <select
                id="exam-subject"
                required
                value={form.subjectId}
                onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              >
                <option value="">— Pilih mapel —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exam-year" className="mb-1 block text-xs font-medium text-stone-700">
                Tahun ajaran
              </label>
              <select
                id="exam-year"
                required
                value={form.academicYearId}
                onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              >
                <option value="">— Pilih tahun ajaran —</option>
                {academicYears.map((y: any) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.isActive ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exam-type" className="mb-1 block text-xs font-medium text-stone-700">
                Jenis ujian
              </label>
              <select
                id="exam-type"
                value={form.examType}
                onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value }))}
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              >
                {EXAM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exam-layout" className="mb-1 block text-xs font-medium text-stone-700">
                Layout kolom cetak
              </label>
              <select
                id="exam-layout"
                value={form.columnLayout}
                onChange={(e) => setForm((f) => ({ ...f, columnLayout: e.target.value }))}
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              >
                <option value="ONE">1 Kolom</option>
                <option value="TWO">2 Kolom</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="exam-instructions" className="mb-1 block text-xs font-medium text-stone-700">
              Petunjuk pengerjaan (opsional)
            </label>
            <textarea
              id="exam-instructions"
              rows={3}
              maxLength={2000}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="mis. Kerjakan dengan jujur. Gunakan alat tulis hitam."
              className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-700">
            <input
              type="checkbox"
              checked={form.showAnswers}
              onChange={(e) => setForm((f) => ({ ...f, showAnswers: e.target.checked }))}
              className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-700"
            />
            <span>Tampilkan kunci jawaban saat preview naskah</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" isLoading={isPending} disabled={!metaLoaded}>
              {isPending ? "Membuat..." : "Buat Naskah"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
