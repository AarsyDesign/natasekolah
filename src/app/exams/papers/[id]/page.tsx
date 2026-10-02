"use client";

import React, { useEffect, useState, useTransition, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Plus,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Archive,
} from "lucide-react";
import {
  getExamDetailAction,
  addExamQuestionsAction,
  setExamQuestionPointsAction,
  reorderExamQuestionsAction,
  transitionExamStatusAction,
  archiveExamAction,
} from "@/actions/exam-paper";
import { getQuestionsAction } from "@/actions/question-bank";
import { NavHeader } from "@/components/nav-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  EXAM_STATUS_BADGE,
  EXAM_STATUS_TRANSITIONS,
  EXAM_TRANSITION_ACTION_LABEL,
  EXAM_MAX_QUESTIONS,
  EXAM_MIN_POINTS,
  EXAM_MAX_POINTS,
  examTypeLabel,
  examStatusLabel,
  examLayoutLabel,
  formatExamDate,
  truncateExamText,
  sumExamPoints,
  type ExamDetailItem,
  type ExamPaperQuestionItem,
} from "@/components/exam-paper/exam-paper-ui";
import {
  QUESTION_TYPE_OPTIONS,
  QUESTION_DIFFICULTY_OPTIONS,
  questionTypeLabel,
  questionDifficultyLabel,
  type QuestionItem,
} from "@/components/question-bank/question-bank-ui";

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
}

/**
 * Rute /exams/papers/[id]: detail naskah — komposisi soal (urutan + poin),
 * tarik soal dari Bank Soal, preview bernomor + toggle kunci, dan siklus
 * status. Mobile-first 430px (Phase 10.2).
 */
export default function ExamPaperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [exam, setExam] = useState<ExamDetailItem | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Preview mode
  const [previewMode, setPreviewMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  // Modal tarik soal dari Bank Soal
  const [pullOpen, setPullOpen] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullItems, setPullItems] = useState<QuestionItem[]>([]);
  const [pullTotal, setPullTotal] = useState(0);
  const [pullPage, setPullPage] = useState(1);
  const [pullTotalPages, setPullTotalPages] = useState(1);
  const [pullFilters, setPullFilters] = useState({ type: "", difficulty: "", count: 10 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const composedIds = new Set((exam?.questions ?? []).map((q) => q.questionId));
  const locked = exam ? exam.status === "ISSUED" || exam.status === "ARCHIVED" : false;
  const compositionWritable = Boolean(exam) && !locked && canManage;
  const remainingSlots = Math.max(0, EXAM_MAX_QUESTIONS - (exam?.questions?.length ?? 0));

  // Muat detail naskah
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await getExamDetailAction(id);
        if (!active) return;
        if (res.success && res.data) {
          setExam(res.data.exam);
          setCanManage(res.data.canManage);
          setShowAnswers(Boolean(res.data.exam.showAnswers));
        } else if (!res.success) {
          setError(res.error || "Gagal memuat detail naskah ujian.");
        }
      } catch {
        if (active) {
          setError(
            "Koneksi terputus saat mengambil detail naskah. Silakan periksa jaringan Anda lalu coba lagi."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  // Muat daftar soal bank (modal tarik)
  const loadBankQuestions = async () => {
    setPullLoading(true);
    setPullError(null);
    try {
      const res = await getQuestionsAction({
        page: pullPage,
        pageSize: 25,
        ...(exam?.subjectId ? { subjectId: exam.subjectId } : {}),
        ...(pullFilters.type ? { type: pullFilters.type } : {}),
        ...(pullFilters.difficulty ? { difficulty: pullFilters.difficulty } : {}),
      });
      if (res.success && res.data) {
        setPullItems(res.data.items);
        setPullTotal(res.data.total);
        setPullTotalPages(res.data.totalPages);
      } else if (!res.success) {
        setPullError(res.error || "Gagal memuat daftar soal bank.");
      }
    } catch {
      setPullError("Koneksi terputus saat mengambil soal bank. Coba lagi.");
    } finally {
      setPullLoading(false);
    }
  };

  useEffect(() => {
    if (pullOpen) {
      loadBankQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullOpen, pullPage, pullFilters.type, pullFilters.difficulty]);

  const openPull = () => {
    setSelectedIds([]);
    setPullPage(1);
    setPullError(null);
    setPullOpen(true);
  };

  const toggleSelect = (questionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(questionId)) return prev.filter((x) => x !== questionId);
      if (prev.length >= pullFilters.count) return prev; // batas jumlah ditarik
      return [...prev, questionId];
    });
  };

  const handlePull = async () => {
    if (selectedIds.length === 0) {
      setPullError("Pilih minimal 1 soal untuk ditarik ke naskah.");
      return;
    }
    startTransition(async () => {
      const res = await addExamQuestionsAction(id, { questionIds: selectedIds });
      if (!res.success) {
        setPullError(res.error || "Gagal menambahkan soal ke naskah.");
      } else {
        setPullOpen(false);
        setMessage({
          text: `${res.data.added} soal ditambahkan${
            res.data.skipped > 0 ? ` (${res.data.skipped} dilewati karena sudah ada)` : ""
          }. Total ${res.data.total} butir.`,
          type: "success",
        });
        setReloadKey((k) => k + 1);
      }
    });
  };

  // Atur poin per soal (blur / Enter)
  const handlePoints = (questionId: string, value: string) => {
    const points = Number(value);
    if (!Number.isFinite(points)) return;
    if (points < EXAM_MIN_POINTS || points > EXAM_MAX_POINTS) {
      setMessage({
        text: `Poin harus antara ${EXAM_MIN_POINTS} sampai ${EXAM_MAX_POINTS}.`,
        type: "error",
      });
      return;
    }
    startTransition(async () => {
      const res = await setExamQuestionPointsAction(id, { questionId, points });
      if (!res.success) {
        setMessage({ text: res.error || "Gagal mengatur poin soal.", type: "error" });
      } else {
        setMessage({ text: `Poin soal disimpan (${points}).`, type: "success" });
        setReloadKey((k) => k + 1);
      }
    });
  };

  // Naik/turunkan urutan
  const moveQuestion = (index: number, direction: -1 | 1) => {
    const questions = exam?.questions ?? [];
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const order = questions.map((q) => q.questionId);
    [order[index], order[target]] = [order[target], order[index]];
    startTransition(async () => {
      const res = await reorderExamQuestionsAction(id, { questionIds: order });
      if (!res.success) {
        setMessage({ text: res.error || "Gagal mengatur urutan soal.", type: "error" });
      } else {
        setReloadKey((k) => k + 1);
      }
    });
  };

  // Transisi status / arsip
  const runTransition = (target: string) => {
    const doRun = async () => {
      setMessage(null);
      const res =
        target === "ARCHIVED"
          ? await archiveExamAction(id)
          : await transitionExamStatusAction(id, { status: target });
      if (!res.success) {
        setMessage({ text: res.error || "Gagal mengubah status naskah.", type: "error" });
      } else {
        setMessage({
          text: `Status naskah kini "${examStatusLabel(target)}".`,
          type: "success",
        });
        setReloadKey((k) => k + 1);
      }
    };

    if (target === "ARCHIVED") {
      if (
        !confirm(
          "Arsipkan naskah ini? Naskah yang diarsipkan bersifat terminal dan tidak dapat diubah lagi (pengganti hapus permanen)."
        )
      ) {
        return;
      }
    }
    startTransition(doRun);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100/60 pb-16">
        <NavHeader subtitle="Akademik" />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-40 w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </main>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-stone-100/60 pb-16">
        <NavHeader subtitle="Akademik" />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/exams/papers"
            className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Naskah Ujian</span>
          </Link>
          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs font-medium text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{error || "Naskah ujian tidak ditemukan."}</div>
          </div>
        </main>
      </div>
    );
  }

  const questions = exam.questions ?? [];
  const totalPoints = sumExamPoints(questions);
  const allowedTransitions = EXAM_STATUS_TRANSITIONS[exam.status] ?? [];

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Akademik" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/exams/papers"
              className="touch-target inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Semua Naskah</span>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-teal-700" />
              <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
                {exam.title}
              </h1>
              <Badge variant={EXAM_STATUS_BADGE[exam.status] || "neutral"}>
                {examStatusLabel(exam.status)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              {exam.subject?.name || "-"}
              {exam.academicYear ? ` · ${exam.academicYear.name}` : ""} ·{" "}
              {examTypeLabel(exam.examType)} · {examLayoutLabel(exam.columnLayout)}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              {questions.length} butir soal · Total {totalPoints} poin · Dibuat{" "}
              {formatExamDate(exam.createdAt)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="touch-target inline-flex items-center rounded-lg border border-stone-300 bg-white p-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50"
              title="Segarkan data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                setPreviewMode((p) => !p);
              }}
            >
              {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{previewMode ? "Tutup Preview" : "Preview"}</span>
            </Button>
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

        {/* Petunjuk naskah */}
        {exam.instructions && (
          <div className="mb-6 rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-700 shadow-2xs">
            <span className="font-semibold text-stone-900">Petunjuk: </span>
            {exam.instructions}
          </div>
        )}

        {/* Aksi siklus status */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {canManage &&
            allowedTransitions.map((target) => (
              <button
                key={target}
                onClick={() => runTransition(target)}
                disabled={isPending}
                className={`touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs disabled:opacity-50 ${
                  target === "ARCHIVED"
                    ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                    : target === "ISSUED"
                      ? "bg-teal-800 text-white hover:bg-teal-700"
                      : "bg-stone-800 text-white hover:bg-stone-700"
                }`}
              >
                {target === "ARCHIVED" && <Archive className="h-3.5 w-3.5" />}
                <span>{EXAM_TRANSITION_ACTION_LABEL[target] || target}</span>
              </button>
            ))}
          {exam.status === "ARCHIVED" && (
            <span className="text-xs font-medium text-stone-500">
              Naskah diarsipkan — bersifat terminal, tidak dapat diubah lagi.
            </span>
          )}
          {locked && exam.status === "ISSUED" && (
            <span className="text-xs font-medium text-stone-500">
              Naskah diterbitkan — komposisi terkunci.
            </span>
          )}
        </div>

        {/* Banner preview */}
        {previewMode && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
              <Eye className="h-4 w-4" />
              <span>Mode Preview Naskah (pembacaan cetak)</span>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-teal-900">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="h-4 w-4 rounded border-teal-300 text-teal-700 focus:ring-teal-700"
              />
              <span>Tampilkan kunci jawaban</span>
            </label>
          </div>
        )}

        {/* Komposisi soal */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Komposisi Soal</h2>
            <p className="text-[11px] text-stone-500">
              {questions.length} butir · total {totalPoints} poin
              {remainingSlots > 0 ? ` · sisa slot ${remainingSlots}/${EXAM_MAX_QUESTIONS}` : " · penuh"}
            </p>
          </div>
          {compositionWritable && remainingSlots > 0 && (
            <Button size="sm" className="h-9" onClick={openPull}>
              <Plus className="h-4 w-4" />
              <span>Tarik Soal dari Bank</span>
            </Button>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
            <FileText className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-700">
              Naskah belum berisi soal
            </p>
            <p className="mt-1 max-w-sm text-xs text-stone-500">
              {compositionWritable
                ? 'Klik "Tarik Soal dari Bank" untuk memilih soal dari Bank Soal se-mapel.'
                : "Komposisi hanya dapat diubah saat naskah berstatus Draf atau Siap."}
            </p>
          </div>
        ) : previewMode ? (
          /* ---------------- Preview bernomor ---------------- */
          <ol className="space-y-4">
            {questions.map((row, index) => (
              <li
                key={row.id}
                className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-stone-900">
                    <span className="mr-2 font-bold text-teal-700">{index + 1}.</span>
                    {row.question.stem}
                  </p>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                    {row.points} poin
                  </span>
                </div>

                {row.question.type === "MULTIPLE_CHOICE" && row.question.options.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-6">
                    {row.question.options.map((opt, oi) => {
                      const correct = showAnswers && opt.isCorrect;
                      return (
                        <li
                          key={opt.id ?? oi}
                          className={`text-xs ${
                            correct
                              ? "font-semibold text-emerald-700"
                              : "text-stone-700"
                          }`}
                        >
                          {String.fromCharCode(65 + oi)}. {opt.content}
                          {correct && " ✓"}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {row.question.type === "SHORT_ANSWER" && (
                  <div className="mt-2 pl-6 text-xs text-stone-500">
                    Jawaban: <span className="italic">_____________________</span>
                    {showAnswers && row.question.shortAnswerKey && (
                      <div className="mt-1 font-semibold text-emerald-700">
                        Kunci: {row.question.shortAnswerKey}
                      </div>
                    )}
                  </div>
                )}

                {row.question.type === "ESSAY" && (
                  <div className="mt-2 pl-6 text-xs text-stone-500">
                    <div className="italic">
                      Jawaban: ______________________________________________________________________
                    </div>
                    {showAnswers && row.question.explanation && (
                      <div className="mt-1 font-semibold text-emerald-700">
                        Pedoman penskoran: {row.question.explanation}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          /* ---------------- Daftar urut + poin ---------------- */
          <ul className="space-y-3">
            {questions.map((row: ExamPaperQuestionItem, index: number) => (
              <li
                key={row.id}
                className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-800">
                        {truncateExamText(row.question.stem, 220)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                          {questionTypeLabel(row.question.type)}
                        </span>
                        {row.question.difficulty && (
                          <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                            {questionDifficultyLabel(row.question.difficulty)}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-400">
                          {row.question.options.length} opsi
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Poin */}
                    <label className="flex items-center gap-1 text-[11px] text-stone-500">
                      <span>Poin</span>
                      <input
                        type="number"
                        min={EXAM_MIN_POINTS}
                        max={EXAM_MAX_POINTS}
                        defaultValue={row.points}
                        key={`${row.id}-${row.points}`}
                        disabled={!compositionWritable || isPending}
                        onBlur={(e) => {
                          if (Number(e.target.value) !== row.points) {
                            handlePoints(row.questionId, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="touch-target w-16 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-semibold text-stone-800 disabled:bg-stone-50 disabled:text-stone-400"
                        aria-label={`Poin soal nomor ${index + 1}`}
                      />
                    </label>

                    {/* Urutan */}
                    {compositionWritable && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveQuestion(index, -1)}
                          disabled={index === 0 || isPending}
                          className="touch-target rounded-lg border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                          aria-label={`Naikkan soal nomor ${index + 1}`}
                          title="Naikkan"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === questions.length - 1 || isPending}
                          className="touch-target rounded-lg border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                          aria-label={`Turunkan soal nomor ${index + 1}`}
                          title="Turunkan"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Modal Tarik Soal dari Bank Soal */}
      <Dialog isOpen={pullOpen} onClose={() => setPullOpen(false)}>
        <DialogHeader>
          <DialogTitle>Tarik Soal dari Bank Soal</DialogTitle>
          <DialogDescription>
            Hanya soal se-mapel dengan naskah ini yang dapat ditarik. Maksimal{" "}
            {remainingSlots} soal tersisa.
          </DialogDescription>
        </DialogHeader>

        {/* Filter */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <select
            value={pullFilters.type}
            onChange={(e) => {
              setPullPage(1);
              setPullFilters((f) => ({ ...f, type: e.target.value }));
            }}
            aria-label="Filter tipe soal"
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua tipe</option>
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={pullFilters.difficulty}
            onChange={(e) => {
              setPullPage(1);
              setPullFilters((f) => ({ ...f, difficulty: e.target.value }));
            }}
            aria-label="Filter kesulitan"
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua kesulitan</option>
            {QUESTION_DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-stone-600">
            <span>Jumlah</span>
            <input
              type="number"
              min={1}
              max={Math.min(remainingSlots, EXAM_MAX_QUESTIONS)}
              value={pullFilters.count}
              onChange={(e) =>
                setPullFilters((f) => ({
                  ...f,
                  count: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="touch-target w-20 rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-semibold text-stone-800"
              aria-label="Jumlah soal yang akan ditarik"
            />
          </label>
        </div>

        {pullError && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            {pullError}
          </div>
        )}

        {/* Daftar soal */}
        <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-stone-200">
          {pullLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-teal-700" />
            </div>
          ) : pullItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-stone-500">
              Tidak ada soal pada filter ini.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {pullItems.map((q) => {
                const already = composedIds.has(q.id);
                const selected = selectedIds.includes(q.id);
                const countFull = selectedIds.length >= pullFilters.count && !selected;
                return (
                  <li key={q.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 p-3 text-xs hover:bg-stone-50 ${
                        already || countFull ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={already || countFull}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-700"
                        aria-label={`Pilih soal: ${truncateExamText(q.stem, 60)}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-stone-800">
                          {truncateExamText(q.stem, 140)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-stone-500">
                          {questionTypeLabel(q.type)} · {questionDifficultyLabel(q.difficulty)}
                          {already ? " · sudah ada di naskah" : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {pullTotalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-stone-500">
            <span>
              Halaman {pullPage}/{pullTotalPages} · {pullTotal} soal
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPullPage((p) => Math.max(1, p - 1))}
                disabled={pullPage <= 1 || pullLoading}
                className="touch-target rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-600 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPullPage((p) => Math.min(pullTotalPages, p + 1))}
                disabled={pullPage >= pullTotalPages || pullLoading}
                className="touch-target rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-600 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPullOpen(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePull}
            isLoading={isPending}
            disabled={selectedIds.length === 0}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Tarik {selectedIds.length} Soal</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
