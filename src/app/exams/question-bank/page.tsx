"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  LibraryBig,
  Plus,
  Search,
  Upload,
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  PenLine,
  BookOpen,
  Eye,
} from "lucide-react";
import {
  getQuestionsAction,
  getQuestionBankSummaryAction,
  createQuestionAction,
  exportQuestionsCsvAction,
} from "@/actions/question-bank";
import { getSubjectsAction } from "@/actions/teaching";
import { downloadCSV } from "@/lib/finance/export-utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DataTableView,
  type ColumnDef,
} from "@/components/data-dense/data-table-view";
import { TableSkeleton } from "@/components/loading/skeletons";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { QuestionImportModal } from "@/components/importer/question-import-modal";
import { QuestionFormFields } from "@/components/question-bank/question-form-fields";
import {
  QUESTION_TYPE_OPTIONS,
  QUESTION_DIFFICULTY_OPTIONS,
  QUESTION_STATUS_OPTIONS,
  QUESTION_STATUS_BADGE,
  QUESTION_TYPE_BADGE,
  createEmptyQuestionForm,
  buildCreateQuestionPayload,
  validateQuestionForm,
  questionTypeLabel,
  questionDifficultyLabel,
  questionStatusLabel,
  type QuestionItem,
  type QuestionBankSummary,
  type QuestionFormValue,
  type SubjectOption,
} from "@/components/question-bank/question-bank-ui";

const PAGE_SIZE = 20;

interface FilterState {
  search: string;
  subjectId: string;
  type: string;
  difficulty: string;
  status: string;
}

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
}

/**
 * Rute /exams/question-bank: daftar soal 4-blok (DESIGN.md §21) dengan
 * metric bar, filter, tabel padat desktop / ResourceList mobile.
 */
export default function QuestionBankPage() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<QuestionBankSummary | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    subjectId: "",
    type: "",
    difficulty: "",
    status: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [metaKey, setMetaKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Dialog tambah soal & dialog impor
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState<QuestionFormValue>(createEmptyQuestionForm());
  const [formError, setFormError] = useState<string | null>(null);

  // Pencarian debounce 350ms (DESIGN.md §19 & §23)
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = filters.search.trim();
      setDebouncedSearch((prev) => (prev === next ? prev : next));
    }, 350);
    return () => clearTimeout(handle);
  }, [filters.search]);

  // Reset halaman saat filter berubah
  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const hasFilter =
    Boolean(debouncedSearch) ||
    Boolean(filters.subjectId) ||
    Boolean(filters.type) ||
    Boolean(filters.difficulty) ||
    Boolean(filters.status);

  const buildQuery = () => ({
    search: debouncedSearch || undefined,
    subjectId: filters.subjectId || undefined,
    type: filters.type || undefined,
    difficulty: filters.difficulty || undefined,
    status: filters.status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  // Blok 4: muat daftar soal
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await getQuestionsAction(buildQuery());
        if (!active) return;
        if (res.success && res.data) {
          setItems(res.data.data);
          setTotal(res.data.total);
          setTotalPages(res.data.totalPages);
          setPage(res.data.page);
        } else {
          setError(res.error || "Gagal memuat daftar soal.");
        }
      } catch {
        if (active) {
          setError(
            "Koneksi terputus saat mengambil daftar soal. Silakan periksa jaringan Anda lalu klik Muat Ulang."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    filters.subjectId,
    filters.type,
    filters.difficulty,
    filters.status,
    page,
    reloadKey,
  ]);

  // Blok 2 & 3: ringkasan metrik + daftar mata pelajaran
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [summaryRes, subjectRes] = await Promise.all([
          getQuestionBankSummaryAction(),
          getSubjectsAction({ page: 1, pageSize: 100 }),
        ]);
        if (!active) return;
        if (summaryRes.success && summaryRes.data) {
          setSummary(summaryRes.data);
        } else {
          setSummary(null);
        }
        if (subjectRes.success && subjectRes.data) {
          setSubjects(subjectRes.data.items);
        }
      } catch {
        if (active) setSummary(null);
      } finally {
        if (active) setMetaLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [metaKey]);

  const reload = () => setReloadKey((prev) => prev + 1);
  const reloadMeta = () => setMetaKey((prev) => prev + 1);

  const openCreateDialog = () => {
    setForm(createEmptyQuestionForm());
    setFormError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError = validateQuestionForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    startTransition(async () => {
      try {
        const res = await createQuestionAction(buildCreateQuestionPayload(form));
        if (res.success && res.data) {
          setCreateOpen(false);
          setMessage({
            text: "Soal baru berhasil disimpan sebagai Draf.",
            type: "success",
          });
          reload();
          reloadMeta();
        } else {
          setFormError(res.error || "Gagal menyimpan soal.");
        }
      } catch {
        setFormError("Koneksi terputus saat menyimpan soal. Coba lagi.");
      }
    });
  };

  const handleExport = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await exportQuestionsCsvAction({
          search: debouncedSearch || undefined,
          subjectId: filters.subjectId || undefined,
          type: filters.type || undefined,
          difficulty: filters.difficulty || undefined,
          status: filters.status || undefined,
        });
        if (res.success && res.data) {
          downloadCSV(res.data.fileName, res.data.csv);
          setMessage({
            text: `Berkas CSV berisi ${res.data.total} soal berhasil diunduh.`,
            type: "success",
          });
        } else {
          setMessage({
            text: res.error || "Gagal mengekspor data soal.",
            type: "error",
          });
        }
      } catch {
        setMessage({
          text: "Koneksi terputus saat mengekspor data soal. Coba lagi.",
          type: "error",
        });
      }
    });
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      subjectId: "",
      type: "",
      difficulty: "",
      status: "",
    });
    setDebouncedSearch("");
    setPage(1);
  };

  const columns: ColumnDef<QuestionItem>[] = [
    {
      header: "Naskah Soal",
      align: "left",
      cell: (item) => (
        <Link
          href={`/exams/question-bank/${item.id}`}
          className="group block min-w-0"
        >
          <span className="line-clamp-2 break-words text-sm font-semibold text-stone-900 transition-colors group-hover:text-teal-700">
            {item.stem}
          </span>
          {item.topic && (
            <span className="mt-0.5 block text-xs text-stone-500">
              Topik: {item.topic}
            </span>
          )}
        </Link>
      ),
    },
    {
      header: "Mata Pelajaran",
      align: "left",
      cell: (item) => (
        <span className="break-words text-sm text-stone-700">
          {item.subject?.name ?? "-"}
        </span>
      ),
    },
    {
      header: "Tipe",
      align: "left",
      cell: (item) => (
        <Badge variant={QUESTION_TYPE_BADGE[item.type] ?? "neutral"}>
          {questionTypeLabel(item.type)}
        </Badge>
      ),
    },
    {
      header: "Kesulitan",
      align: "left",
      cell: (item) => (
        <span className="text-xs font-medium text-stone-600">
          {questionDifficultyLabel(item.difficulty)}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (item) => (
        <Badge variant={QUESTION_STATUS_BADGE[item.status] ?? "neutral"}>
          {questionStatusLabel(item.status)}
        </Badge>
      ),
    },
    {
      header: "Aksi",
      align: "right",
      cell: (item) => (
        <Link
          href={`/exams/question-bank/${item.id}`}
          className="inline-flex h-8 min-h-[32px] items-center gap-1 rounded-md border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-stone-900"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Lihat</span>
        </Link>
      ),
    },
  ];

  const renderMobileCard = (item: QuestionItem) => (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 min-w-0 break-words text-sm font-semibold text-stone-900">
          {item.stem}
        </p>
        <Badge
          variant={QUESTION_STATUS_BADGE[item.status] ?? "neutral"}
          className="shrink-0"
        >
          {questionStatusLabel(item.status)}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600">
        <span className="break-words">{item.subject?.name ?? "Tanpa mapel"}</span>
        <span aria-hidden="true">|</span>
        <span>{questionTypeLabel(item.type)}</span>
        <span aria-hidden="true">|</span>
        <span>{questionDifficultyLabel(item.difficulty)}</span>
        {item.topic && (
          <>
            <span aria-hidden="true">|</span>
            <span className="break-words">Topik: {item.topic}</span>
          </>
        )}
      </div>

      <Link
        href={`/exams/question-bank/${item.id}`}
        className="touch-target flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
      >
        <Eye className="h-4 w-4" />
        <span>Lihat Detail</span>
      </Link>
    </div>
  );

  const emptyState = (
    <div className="py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <LibraryBig className="h-8 w-8" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-stone-800">
        {hasFilter ? "Tidak Ada Soal yang Sesuai" : "Belum Ada Soal"}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
        {hasFilter
          ? "Ubah kata kunci pencarian atau hapus filter untuk melihat soal lainnya."
          : "Belum ada soal. Mulai dengan menambahkan soal pertama."}
      </p>
      <div className="mt-4 flex justify-center">
        {hasFilter ? (
          <Button variant="outline" onClick={clearFilters}>
            Hapus Filter
          </Button>
        ) : (
          <Button variant="primary" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            <span>Tambah Soal</span>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Blok 1: Header Section */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Ujian" },
              { label: "Bank Soal" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Bank Soal
            </h1>
            <Badge variant="primary">Akademik Formal</Badge>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Kumpulan soal terpusat per lembaga untuk menyusun naskah ujian,
            mengimpor massal, dan mengekspor data soal.
          </p>
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Button
            variant="primary"
            onClick={openCreateDialog}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Soal</span>
          </Button>
        </div>
      </header>

      {/* Blok 2: Metric Summary Bar (opsional, sembunyikan bila gagal dimuat) */}
      {(summary || !metaLoaded) && (
        <section
          aria-label="Ringkasan bank soal"
          className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
        {!metaLoaded ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`metric-skeleton-${index}`}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-md" />
              </div>
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))
        ) : summary ? (
          <>
            <MetricCard
              label="Total Soal"
              value={summary.total}
              caption={`${summary.topicCount} topik tersimpan`}
              icon={<LibraryBig className="h-4 w-4 text-teal-700" />}
            />
            <MetricCard
              label="Draf"
              value={summary.byStatus.DRAFT}
              caption="Menunggu ditinjau"
              icon={<PenLine className="h-4 w-4 text-stone-500" />}
            />
            <MetricCard
              label="Aktif"
              value={summary.byStatus.ACTIVE}
              caption="Siap dipakai ujian"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            />
            <MetricCard
              label="Mata Pelajaran"
              value={summary.subjectCount}
              caption={`${summary.byStatus.ARCHIVED} soal diarsipkan`}
              icon={<BookOpen className="h-4 w-4 text-teal-700" />}
            />
          </>
        ) : null}
        </section>
      )}

      {/* Blok 3: Control & Filter Bar */}
      <section
        aria-label="Filter soal"
        className="mt-6 rounded-lg border border-stone-200 bg-white p-4 shadow-2xs"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <label htmlFor="question-search" className="sr-only">
              Cari naskah soal atau topik
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              id="question-search"
              type="search"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Cari naskah soal atau topik..."
              className="min-h-[44px] w-full rounded-md border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>

          <Select
            id="question-filter-subject"
            label="Mata Pelajaran"
            value={filters.subjectId}
            onChange={(e) => updateFilter("subjectId", e.target.value)}
          >
            <option value="">Semua mata pelajaran</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code ? `${subject.name} (${subject.code})` : subject.name}
              </option>
            ))}
          </Select>

          <Select
            id="question-filter-type"
            label="Tipe Soal"
            value={filters.type}
            onChange={(e) => updateFilter("type", e.target.value)}
          >
            <option value="">Semua tipe</option>
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            id="question-filter-difficulty"
            label="Tingkat Kesulitan"
            value={filters.difficulty}
            onChange={(e) => updateFilter("difficulty", e.target.value)}
          >
            <option value="">Semua tingkat</option>
            {QUESTION_DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            id="question-filter-status"
            label="Status"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">Semua status</option>
            {QUESTION_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              <span>Ekspor CSV</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              <span>Impor Soal</span>
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="text-xs text-stone-500">
              {loading ? "Memuat data..." : `${total} soal ditemukan`}
            </span>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Hapus Filter
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Umpan balik aksi */}
      {message && (
        <div
          role="alert"
          className={`mt-4 flex items-start justify-between gap-3 rounded-lg border p-3.5 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-start gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="shrink-0 text-xs font-semibold underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Blok 4: Content Area */}
      <section aria-label="Daftar soal" className="mt-6">
        {error && !loading && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-rose-900">
                  Data soal gagal dimuat
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-rose-800">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reload}
                  className="mt-3"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Muat Ulang Data</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : (
          <>
            <DataTableView
              data={items}
              columns={columns}
              keyExtractor={(item) => item.id}
              mobileCardRenderer={renderMobileCard}
              emptyState={emptyState}
            />

            {total > 0 && (
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Dialog Tambah Soal */}
      <Dialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        className="max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Tambah Soal Baru</DialogTitle>
          <DialogDescription>
            Isi naskah soal beserta pilihan jawabannya. Soal baru disimpan
            sebagai Draf sampai Anda mengaktifkannya.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateSubmit}>
          <QuestionFormFields
            value={form}
            onChange={setForm}
            subjects={subjects}
            idPrefix="create-question"
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={isPending}>
              Simpan Soal
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Impor Soal */}
      <QuestionImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          reload();
          reloadMeta();
          setMessage({
            text: "Impor soal selesai. Soal baru tersimpan sebagai Draf.",
            type: "success",
          });
        }}
      />
    </div>
  );
}

/** Kartu metrik ringkas Blok 2 (angka dari query agregat, bukan placeholder). */
function MetricCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: number;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-stone-900">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-stone-500">{caption}</div>
    </div>
  );
}
