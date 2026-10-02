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
import {
  createAIGenerationJobAction,
  executeAIGenerationAction,
  reviewAIGenerationJobAction,
  listAIGenerationJobsAction,
  getAIGenerationJobDetailAction,
  getAIGenerationQuotaAction,
  getAIGenerationUsageHistoryAction,
} from "@/actions/ai-generation";
import { AIGenerationJobResult, AIGenerationQuotaResult, AIGenerationUsageHistoryEntry, aiQuestionId } from "@/lib/ai-generation/types";
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

/** Status job generate AI — dipakai riwayat fair-use Blok 2b (Phase 8.4). */
type AIJobStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "SAVED"
  | "DISCARDED"
  | "FAILED";

interface AIJobSummary {
  id: string;
  subjectId: string;
  provider: string;
  model: string;
  status: AIJobStatus;
  createdAt: string | Date;
  errorMessage?: string | null;
}

const AI_JOB_STATUS_META: Record<
  AIJobStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" | "primary" }
> = {
  DRAFT: { label: "Draf", variant: "neutral" },
  READY_FOR_REVIEW: { label: "Siap Direview", variant: "info" },
  SAVED: { label: "Tersimpan", variant: "success" },
  DISCARDED: { label: "Dibuang", variant: "warning" },
  FAILED: { label: "Gagal", variant: "danger" },
};

function formatAiJobDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // AI Generate Modal state
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiGenerateStep, setAiGenerateStep] = useState<"form" | "generating" | "review">("form");
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIGenerationJobResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<{
    subjectId: string;
    type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    count: number;
    topic: string;
    additionalInstructions: string;
  }>({
    subjectId: "",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    count: 5,
    topic: "",
    additionalInstructions: "",
  });
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Fair-use UI state
  const [quota, setQuota] = useState<AIGenerationQuotaResult | null>(null);
  const [usageHistory, setUsageHistory] = useState<AIGenerationUsageHistoryEntry[]>([]);
  const [aiJobs, setAiJobs] = useState<AIJobSummary[]>([]);

  // Muat data fair-use (quota, riwayat pemakaian, riwayat job) — dipanggil saat
  // mount dan setelah review job (Phase 8.4)
  const loadFairUse = async () => {
    try {
      const [quotaRes, historyRes, jobsRes] = await Promise.all([
        getAIGenerationQuotaAction(),
        getAIGenerationUsageHistoryAction(),
        listAIGenerationJobsAction(),
      ]);
      if (quotaRes.success) setQuota(quotaRes.data);
      if (historyRes.success) setUsageHistory(historyRes.data);
      if (jobsRes.success) setAiJobs(jobsRes.data);
    } catch {
      // bagian UI ini opsional — kegagalan diamkan agar halaman tetap utuh
    }
  };

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

  // Load quota, usage history & job history on mount (Phase 8.4)
  useEffect(() => {
    void loadFairUse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => setReloadKey((prev) => prev + 1);
  const reloadMeta = () => setMetaKey((prev) => prev + 1);

  const openCreateDialog = () => {
    setForm(createEmptyQuestionForm());
    setFormError(null);
    setCreateOpen(true);
  };

  const openAiGenerateDialog = () => {
    setAiForm({ ...aiForm, subjectId: subjects[0]?.id || "" });
    setAiGenerateStep("form");
    setAiJobId(null);
    setAiResult(null);
    setAiError(null);
    setSelectedQuestionIds([]);
    setAiGenerateOpen(true);
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

  // AI Generate handlers
  const handleAiGenerateStart = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiGenerateStep("generating");

    try {
      const promptParams = {
        subjectId: aiForm.subjectId,
        type: aiForm.type,
        difficulty: aiForm.difficulty,
        count: aiForm.count,
        topic: aiForm.topic,
        additionalInstructions: aiForm.additionalInstructions,
      };

      const createRes = await createAIGenerationJobAction({ 
        subjectId: promptParams.subjectId,
        prompt: JSON.stringify(promptParams), 
        provider: "openai", 
        model: "gpt-4o-mini",
        promptParams 
      });
      if (!createRes.success) throw new Error(createRes.error);

      const jobId = createRes.data.id;
      setAiJobId(jobId);

      const execRes = await executeAIGenerationAction(jobId);
      if (!execRes.success) throw new Error(execRes.error);

      setAiResult(execRes.data);
      setAiGenerateStep("review");
      // Select all by default (ID berbasis index — lihat aiQuestionId)
      setSelectedQuestionIds(execRes.data.questions.map((_, i) => aiQuestionId(i)));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Gagal generate soal AI");
      setAiGenerateStep("form");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiReviewSubmit = async (action: "save" | "discard") => {
    if (!aiJobId) return;
    setAiLoading(true);

    try {
      const reviewRes = await reviewAIGenerationJobAction({
        jobId: aiJobId,
        action,
        selectedQuestionIds: action === "save" ? selectedQuestionIds : [],
      });

      if (!reviewRes.success) throw new Error(reviewRes.error);

      setMessage({
        text: action === "save" ? `${reviewRes.data.saved} soal disimpan ke Bank Soal.` : "Hasil generate dibuang.",
        type: "success",
      });

      setAiGenerateOpen(false);
      reload();
      reloadMeta();
      void loadFairUse();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Gagal review hasil generate");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
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
          <Button
            variant="secondary"
            onClick={openAiGenerateDialog}
            className="w-full sm:w-auto"
            disabled={!subjects.length}
          >
            <BookOpen className="h-4 w-4" />
            <span>Generate AI</span>
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
            {/* AI Quota Badge */}
            {quota && (
              <MetricCard
                label="Sisa Generate AI"
                value={Math.max(0, quota.limit - quota.currentCount)}
                caption={quota.allowed
                  ? `${quota.currentCount}/${quota.limit} hari ini`
                  : quota.cooldownRemaining
                  ? `Cooldown: ${quota.cooldownRemaining}s`
                  : `Limit harian tercapai (reset besok)`}
                icon={
                  <span
                    className={`h-4 w-4 rounded-full ${
                      quota.allowed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {quota.allowed ? "✓" : "⏱"}
                  </span>
                }
              />
            )}
          </>
        ) : null}
        </section>
      )}

      {/* Blok 2b: Riwayat Generate AI — fair-use (Phase 8.4) */}
      {(aiJobs.length > 0 || usageHistory.length > 0) && (
        <section
          aria-label="Riwayat generate AI"
          className="mt-4 rounded-lg border border-stone-200 bg-white p-4 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-700">
              Riwayat Generate AI
            </h2>
            <span className="text-xs text-stone-500">
              {usageHistory.reduce((sum, entry) => sum + entry.count, 0)} generate
              30 hari terakhir
            </span>
          </div>

          {aiJobs.length === 0 ? (
            <p className="mt-2 text-xs text-stone-500">
              Belum ada job generate AI.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {aiJobs.slice(0, 5).map((job) => (
                <li
                  key={job.id}
                  className="rounded-md border border-stone-100 bg-stone-50 p-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={AI_JOB_STATUS_META[job.status]?.variant ?? "neutral"}>
                      {AI_JOB_STATUS_META[job.status]?.label ?? job.status}
                    </Badge>
                    <span className="text-stone-600">
                      {subjects.find((s) => s.id === job.subjectId)?.name ??
                        "Mata pelajaran"}
                    </span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-500">{formatAiJobDate(job.createdAt)}</span>
                    <span className="ml-auto text-stone-400">
                      {job.provider}/{job.model}
                    </span>
                  </div>
                  {job.errorMessage && (
                    <p className="mt-1 break-words text-xs text-rose-600">
                      {job.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
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

      {/* Dialog Generate AI */}
      <Dialog
        isOpen={aiGenerateOpen}
        onClose={() => setAiGenerateOpen(false)}
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>Generate Soal dengan AI</DialogTitle>
          <DialogDescription>
            AI akan membuat soal berdasarkan parameter yang Anda tentukan. Hasil generate
            perlu ditinjau dan dipilih sebelum disimpan ke Bank Soal.
          </DialogDescription>
        </DialogHeader>

        {aiError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <span>{aiError}</span>
          </div>
        )}

        {aiGenerateStep === "form" && (
          <form onSubmit={(e) => { e.preventDefault(); handleAiGenerateStart(); }}>
            <div className="grid gap-4 py-4">
              {/* Quota indicator in form */}
              {quota && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                    quota.allowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  <span className="font-medium">
                    {quota.allowed
                      ? `✓ Sisa: ${quota.limit - quota.currentCount}/${quota.limit} hari ini`
                      : quota.cooldownRemaining
                      ? `⏳ Cooldown: ${quota.cooldownRemaining}s`
                      : `✗ Limit harian tercapai — coba besok`}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-subject" className="block text-sm font-medium text-stone-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="ai-subject"
                    value={aiForm.subjectId}
                    onChange={(e) => setAiForm(prev => ({ ...prev, subjectId: e.target.value }))}
                    className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none"
                    required
                  >
                    <option value="">Pilih mata pelajaran</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code ? `${subject.name} (${subject.code})` : subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ai-type" className="block text-sm font-medium text-stone-700 mb-1">
                    Tipe Soal <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="ai-type"
                    value={aiForm.type}
                    onChange={(e) => setAiForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none"
                  >
                    <option value="MULTIPLE_CHOICE">Pilihan Ganda (PG)</option>
                    <option value="SHORT_ANSWER">Jawaban Singkat</option>
                    <option value="ESSAY">Essay</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ai-difficulty" className="block text-sm font-medium text-stone-700 mb-1">
                    Tingkat Kesulitan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="ai-difficulty"
                    value={aiForm.difficulty}
                    onChange={(e) => setAiForm(prev => ({ ...prev, difficulty: e.target.value as any }))}
                    className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none"
                  >
                    <option value="EASY">Mudah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HARD">Sulit</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ai-count" className="block text-sm font-medium text-stone-700 mb-1">
                    Jumlah Soal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ai-count"
                    type="number"
                    min="1"
                    max="10"
                    value={aiForm.count}
                    onChange={(e) => setAiForm(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                    className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ai-topic" className="block text-sm font-medium text-stone-700 mb-1">
                  Topik (opsional)
                </label>
                <input
                  id="ai-topic"
                  type="text"
                  value={aiForm.topic}
                  onChange={(e) => setAiForm(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="Contoh: Hukum Newton, Fotosintesis, Tenses, dll"
                  className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="ai-instructions" className="block text-sm font-medium text-stone-700 mb-1">
                  Instruksi Tambahan (opsional)
                </label>
                <textarea
                  id="ai-instructions"
                  value={aiForm.additionalInstructions}
                  onChange={(e) => setAiForm(prev => ({ ...prev, additionalInstructions: e.target.value }))}
                  placeholder="Contoh: Fokus pada konsep dasar, gunakan konteks kehidupan sehari-hari, hindari soal terlalu teoritis..."
                  rows={3}
                  className="min-h-[44px] w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiGenerateOpen(false)}
                disabled={aiLoading}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={aiLoading}>
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Generate Soal
                </span>
              </Button>
            </DialogFooter>
          </form>
        )}

        {aiGenerateStep === "generating" && (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 animate-spin items-center justify-center rounded-full bg-teal-100">
              <BookOpen className="h-7 w-7 text-teal-700" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-stone-800">AI sedang membuat soal...</h3>
            <p className="mt-1 text-sm text-stone-500">Mohon tunggu, ini mungkin memakan waktu beberapa saat.</p>
          </div>
        )}

        {aiGenerateStep === "review" && aiResult && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-stone-700">
                {aiResult.questions.length} soal dihasilkan — pilih yang ingin disimpan
              </h3>
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={selectedQuestionIds.length === aiResult.questions.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedQuestionIds(aiResult.questions.map((_, i) => aiQuestionId(i)));
                    } else {
                      setSelectedQuestionIds([]);
                    }
                  }}
                />
                Pilih semua
              </label>
            </div>

            <div className="space-y-3">
              {aiResult.questions.map((q, idx) => {
                const questionId = aiQuestionId(idx);
                const isSelected = selectedQuestionIds.includes(questionId);
                return (
                  <div
                    key={questionId}
                    className={`border rounded-lg p-3 transition-colors ${
                      isSelected ? "border-teal-300 bg-teal-50" : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuestionSelection(questionId)}
                        className="mt-1 h-4 w-4 text-teal-600 border-stone-300 rounded focus:ring-teal-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant={q.type === "MULTIPLE_CHOICE" ? "primary" : q.type === "SHORT_ANSWER" ? "primary" : "neutral"}>
                            {q.type === "MULTIPLE_CHOICE" ? "PG" : q.type === "SHORT_ANSWER" ? "Short" : "Essay"}
                          </Badge>
                          <Badge variant={
                            q.difficulty === "EASY" ? "success" :
                            q.difficulty === "MEDIUM" ? "warning" : "danger"
                          }>
                            {q.difficulty === "EASY" ? "Mudah" : q.difficulty === "MEDIUM" ? "Sedang" : "Sulit"}
                          </Badge>
                          {q.topic && (
                            <Badge variant="neutral">
                              {q.topic}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-stone-900">{q.stem}</p>
                        {q.type === "MULTIPLE_CHOICE" && q.options && (
                          <div className="mt-2 space-y-1 text-xs text-stone-600">
                            {q.options.map((opt) => (
                              <div key={opt.label} className={`flex items-center gap-1 ${opt.isCorrect ? "text-emerald-700 font-medium" : ""}`}>
                                <span className="w-5 text-center">{opt.label}.</span>
                                <span>{opt.content}</span>
                                {opt.isCorrect && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded">kunci</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === "SHORT_ANSWER" && q.shortAnswerKey && (
                          <p className="mt-2 text-xs text-stone-600">
                            <span className="font-medium">Kunci: </span>{q.shortAnswerKey}
                          </p>
                        )}
                        {q.type === "ESSAY" && q.explanation && (
                          <p className="mt-2 text-xs text-stone-600">
                            <span className="font-medium">Pedoman: </span>{q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedQuestionIds.length === 0 && (
              <div className="mt-4 text-center text-sm text-rose-600">
                Pilih minimal 1 soal untuk disimpan.
              </div>
            )}

            <DialogFooter className="mt-4 border-t border-stone-100 pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleAiReviewSubmit("discard")}
                disabled={aiLoading}
              >
                Buang Semua
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleAiReviewSubmit("save")}
                disabled={aiLoading || selectedQuestionIds.length === 0}
              >
                Simpan Terpilih ({selectedQuestionIds.length})
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>
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
