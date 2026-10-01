"use client";

import React, { useEffect, useState, useTransition, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Archive,
  LibraryBig,
} from "lucide-react";
import {
  getQuestionByIdAction,
  updateQuestionAction,
  updateQuestionStatusAction,
  archiveQuestionAction,
} from "@/actions/question-bank";
import { getSubjectsAction } from "@/actions/teaching";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuestionFormFields } from "@/components/question-bank/question-form-fields";
import {
  QUESTION_STATUS_BADGE,
  QUESTION_TYPE_BADGE,
  QUESTION_STATUS_TRANSITIONS,
  buildUpdateQuestionPayload,
  formatLongDate,
  questionFormFromItem,
  questionTypeLabel,
  questionDifficultyLabel,
  questionStatusLabel,
  validateQuestionForm,
  type QuestionItem,
  type QuestionFormValue,
  type SubjectOption,
} from "@/components/question-bank/question-bank-ui";

interface FeedbackMessage {
  text: string;
  type: "success" | "error";
}

/**
 * Rute /exams/question-bank/[id]: detail soal + mode ubah + pergantian
 * siklus status (Draf -> Aktif -> Arsip).
 */
export default function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [question, setQuestion] = useState<QuestionItem | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<QuestionFormValue>({
    subjectId: "",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    topic: "",
    stem: "",
    explanation: "",
    shortAnswerKey: "",
    options: [],
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Konfirmasi arsip
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [detailRes, subjectRes] = await Promise.all([
          getQuestionByIdAction(id),
          getSubjectsAction({ page: 1, pageSize: 100 }),
        ]);
        if (!active) return;

        if (detailRes.success && detailRes.data) {
          setQuestion(detailRes.data);
          setForm(questionFormFromItem(detailRes.data));
        } else {
          setError(detailRes.error || "Gagal memuat detail soal.");
        }

        if (subjectRes.success && subjectRes.data) {
          setSubjects(subjectRes.data.items);
        }
      } catch {
        if (active) {
          setError(
            "Koneksi terputus saat mengambil detail soal. Silakan periksa jaringan Anda lalu klik Muat Ulang."
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
  }, [id, reloadKey]);

  const reload = () => setReloadKey((prev) => prev + 1);

  const handleStartEdit = () => {
    if (!question) return;
    setForm(questionFormFromItem(question));
    setFormError(null);
    setMessage(null);
    setEditing(true);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError = validateQuestionForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateQuestionAction(
          id,
          buildUpdateQuestionPayload(form)
        );
        if (res.success && res.data) {
          setQuestion(res.data);
          setEditing(false);
          setMessage({ text: "Perubahan soal berhasil disimpan.", type: "success" });
        } else {
          setFormError(res.error || "Gagal menyimpan perubahan soal.");
        }
      } catch {
        setFormError("Koneksi terputus saat menyimpan perubahan. Coba lagi.");
      }
    });
  };

  const handleChangeStatus = (nextStatus: string) => {
    if (!question) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await updateQuestionStatusAction(id, { status: nextStatus });
        if (res.success && res.data) {
          setQuestion(res.data);
          setMessage({
            text: `Status soal berhasil diubah menjadi ${questionStatusLabel(
              nextStatus
            )}.`,
            type: "success",
          });
        } else {
          setMessage({
            text: res.error || "Gagal mengubah status soal.",
            type: "error",
          });
        }
      } catch {
        setMessage({
          text: "Koneksi terputus saat mengubah status soal. Coba lagi.",
          type: "error",
        });
      }
    });
  };

  const handleConfirmArchive = () => {
    setConfirmArchive(false);
    startTransition(async () => {
      try {
        const res = await archiveQuestionAction(id);
        if (res.success && res.data) {
          setQuestion(res.data);
          setMessage({
            text: "Soal berhasil diarsipkan dan tidak dapat diubah lagi.",
            type: "success",
          });
        } else {
          setMessage({
            text: res.error || "Gagal mengarsipkan soal.",
            type: "error",
          });
        }
      } catch {
        setMessage({
          text: "Koneksi terputus saat mengarsipkan soal. Coba lagi.",
          type: "error",
        });
      }
    });
  };

  const backLink = (
    <Link
      href="/exams/question-bank"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 hover:text-stone-900"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>Kembali</span>
    </Link>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-7 w-72" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-2xs lg:col-span-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-5 shadow-2xs">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-rose-900">
                Soal tidak dapat dimuat
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-rose-800">
                {error ||
                  "Soal yang Anda cari tidak ditemukan pada lembaga ini."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={reload}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Muat Ulang Data</span>
                </Button>
                <Link
                  href="/exams/question-bank"
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Kembali ke Bank Soal</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isArchived = question.status === "ARCHIVED";
  const transitions = QUESTION_STATUS_TRANSITIONS[question.status] ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Ujian" },
              { label: "Bank Soal", href: "/exams/question-bank" },
              { label: "Detail Soal" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Detail Soal
            </h1>
            <Badge variant={QUESTION_STATUS_BADGE[question.status] ?? "neutral"}>
              {questionStatusLabel(question.status)}
            </Badge>
            <Badge variant={QUESTION_TYPE_BADGE[question.type] ?? "neutral"}>
              {questionTypeLabel(question.type)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Periksa naskah, opsi jawaban, dan kunci soal sebelum dipakai pada
            naskah ujian.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {backLink}
          {!editing && (
            <Button
              variant="outline"
              onClick={handleStartEdit}
              disabled={isArchived || isPending}
              className="w-full sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              <span>Ubah Isi Soal</span>
            </Button>
          )}
        </div>
      </header>

      {/* Umpan balik */}
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Kolom utama */}
        <div className="space-y-4 lg:col-span-2">
          {editing ? (
            <form
              onSubmit={handleSave}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
            >
              <h2 className="text-base font-semibold text-stone-900">
                Ubah Isi Soal
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Perubahan wajib disimpan. Soal berstatus Arsip tidak dapat
                diubah.
              </p>

              {formError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="mt-4">
                <QuestionFormFields
                  value={form}
                  onChange={setForm}
                  subjects={subjects}
                  idPrefix="edit-question"
                />
              </div>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setFormError(null);
                  }}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" isLoading={isPending}>
                  <Save className="h-4 w-4" />
                  <span>Simpan Perubahan</span>
                </Button>
              </div>
            </form>
          ) : (
            <>
              <section
                aria-label="Naskah soal"
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
              >
                <h2 className="text-base font-semibold text-stone-900">
                  Naskah Soal
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
                  {question.stem}
                </p>
                {question.topic && (
                  <p className="mt-3 text-xs text-stone-500">
                    Topik / Bab: {question.topic}
                  </p>
                )}
              </section>

              <section
                aria-label="Opsi jawaban"
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
              >
                <h2 className="text-base font-semibold text-stone-900">
                  {question.type === "MULTIPLE_CHOICE"
                    ? "Opsi Jawaban"
                    : "Kunci Jawaban"}
                </h2>

                {question.type === "MULTIPLE_CHOICE" && (
                  <ul className="mt-3 space-y-2">
                    {question.options.map((option) => (
                      <li
                        key={option.id ?? option.label}
                        className={`flex items-start gap-3 rounded-md border p-3 ${
                          option.isCorrect
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-stone-200 bg-stone-50"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                            option.isCorrect
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : "border-stone-200 bg-white text-stone-700"
                          }`}
                        >
                          {option.label}
                        </span>
                        <span className="min-w-0 break-words text-sm text-stone-800">
                          {option.content}
                        </span>
                        {option.isCorrect && (
                          <Badge variant="success" className="ml-auto shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Kunci
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {question.type === "SHORT_ANSWER" && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-medium text-emerald-800">
                      Kunci Jawaban
                    </div>
                    <div className="mt-1 break-words text-sm text-stone-800">
                      {question.shortAnswerKey || "-"}
                    </div>
                  </div>
                )}

                {question.type === "ESSAY" && (
                  <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                    Soal esai dinilai berdasarkan pedoman penskoran pada bagian
                    Pembahasan.
                  </p>
                )}
              </section>

              {question.explanation && (
                <section
                  aria-label="Pembahasan"
                  className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
                >
                  <h2 className="text-base font-semibold text-stone-900">
                    {question.type === "ESSAY"
                      ? "Pedoman Penskoran"
                      : "Pembahasan"}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">
                    {question.explanation}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Kolom samping */}
        <div className="space-y-4">
          <section
            aria-label="Metadata soal"
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
          >
            <h2 className="text-base font-semibold text-stone-900">Metadata</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <MetaRow
                label="Mata Pelajaran"
                value={
                  question.subject
                    ? question.subject.code
                      ? `${question.subject.name} (${question.subject.code})`
                      : question.subject.name
                    : "-"
                }
              />
              <MetaRow label="Topik / Bab" value={question.topic || "-"} />
              <MetaRow label="Tipe Soal" value={questionTypeLabel(question.type)} />
              <MetaRow
                label="Tingkat Kesulitan"
                value={questionDifficultyLabel(question.difficulty)}
              />
              <MetaRow
                label="Status"
                value={questionStatusLabel(question.status)}
              />
              <MetaRow
                label="Pembuat"
                value={question.createdBy?.name || "-"}
              />
              <MetaRow
                label="Dibuat"
                value={formatLongDate(question.createdAt)}
              />
              <MetaRow
                label="Diperbarui"
                value={formatLongDate(question.updatedAt)}
              />
            </dl>
          </section>

          <section
            aria-label="Ubah status soal"
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-2xs"
          >
            <h2 className="text-base font-semibold text-stone-900">
              Status Soal
            </h2>

            {isArchived ? (
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                Soal berstatus Arsip bersifat tetap. Buat soal baru bila naskah
                perlu diperbarui.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                Soal aktif baru dapat dipakai pada naskah ujian. Pengarsipan
                bersifat tetap dan tidak dapat dibatalkan.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {transitions.map((target) =>
                target === "ARCHIVED" ? (
                  <Button
                    key={target}
                    variant="outline"
                    onClick={() => setConfirmArchive(true)}
                    disabled={isPending}
                    className="w-full justify-start"
                  >
                    <Archive className="h-4 w-4" />
                    <span>Arsipkan Soal</span>
                  </Button>
                ) : (
                  <Button
                    key={target}
                    variant="outline"
                    onClick={() => handleChangeStatus(target)}
                    disabled={isPending}
                    className="w-full justify-start"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      {target === "ACTIVE"
                        ? "Aktifkan Soal"
                        : "Kembalikan ke Draf"}
                    </span>
                  </Button>
                )
              )}

              {isArchived && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <LibraryBig className="h-3.5 w-3.5" />
                    <span>Status arsip</span>
                  </div>
                  <p className="mt-1">
                    Soal ini tidak dapat diubah atau diaktifkan kembali.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Konfirmasi arsip */}
      <Dialog
        isOpen={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Arsipkan Soal Ini?</DialogTitle>
          <DialogDescription>
            Soal dipindahkan ke status Arsip dan tidak dapat diubah lagi.
            Riwayat soal tetap tersimpan pada lembaga Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="line-clamp-3 break-words text-sm text-stone-700">
            {question.stem}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmArchive(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmArchive}
            isLoading={isPending}
          >
            <Archive className="h-4 w-4" />
            <span>Ya, Arsipkan</span>
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0">
      <dt className="shrink-0 text-xs font-medium text-stone-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-stone-800">
        {value}
      </dd>
    </div>
  );
}
