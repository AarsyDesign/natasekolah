"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  ArrowRight,
  LibraryBig,
} from "lucide-react";
import {
  previewQuestionImportAction,
  executeQuestionImportAction,
  getQuestionImportTemplateAction,
} from "../../actions/question-bank";
import { Badge } from "../ui/badge";
import type {
  QuestionImportPreview,
  QuestionImportResult,
} from "../question-bank/question-bank-ui";
import {
  questionTypeLabel,
  truncateText,
} from "../question-bank/question-bank-ui";

interface QuestionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = "UPLOAD" | "PREVIEW" | "EXECUTING" | "RESULT";

/**
 * Dialog impor massal soal (xlsx / csv), mengikuti pola
 * student-import-modal.tsx: unggah -> pratinjau -> eksekusi -> hasil.
 */
export function QuestionImportModal({
  isOpen,
  onClose,
  onSuccess,
}: QuestionImportModalProps) {
  const [step, setStep] = useState<ImportStep>("UPLOAD");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] =
    useState<QuestionImportPreview | null>(null);
  const [executionResult, setExecutionResult] =
    useState<QuestionImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "ERROR">("ALL");
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    if (step === "EXECUTING") return;
    setStep("UPLOAD");
    setSelectedFile(null);
    setPreviewResult(null);
    setExecutionResult(null);
    setErrorMessage(null);
    setActiveTab("ALL");
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await getQuestionImportTemplateAction();
      if (res.success && res.data) {
        const link = document.createElement("a");
        link.href = `data:${res.data.contentType};base64,${res.data.base64}`;
        link.download = res.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setErrorMessage(res.error || "Gagal mengunduh template impor soal.");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan saat mengunduh template impor soal.");
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      try {
        const res = await previewQuestionImportAction(formData);
        if (res.success && res.data) {
          setPreviewResult(res.data);
          setStep("PREVIEW");
        } else {
          setErrorMessage(res.error || "Gagal memproses file soal.");
        }
      } catch {
        setErrorMessage("Koneksi terputus saat membaca file. Coba lagi.");
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleConfirmImport = () => {
    if (!previewResult) return;

    const validRows = previewResult.rows.filter((row) => row.status === "VALID");
    if (validRows.length === 0) {
      setErrorMessage("Tidak ada baris valid yang dapat diimpor.");
      return;
    }

    setStep("EXECUTING");
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await executeQuestionImportAction(validRows);
        if (res.success && res.data) {
          setExecutionResult(res.data);
          setStep("RESULT");
          onSuccess();
        } else {
          setErrorMessage(res.error || "Gagal mengeksekusi impor soal.");
          setStep("PREVIEW");
        }
      } catch {
        setErrorMessage("Koneksi terputus saat menyimpan soal. Coba lagi.");
        setStep("PREVIEW");
      }
    });
  };

  if (!isOpen) return null;

  const filteredRows =
    previewResult?.rows.filter((row) => {
      if (activeTab === "VALID") return row.status === "VALID";
      if (activeTab === "ERROR") return row.status === "ERROR";
      return true;
    }) || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Impor soal dari spreadsheet"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-stone-200 bg-white text-stone-900 shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-stone-900 sm:text-lg">
                Impor Soal (Excel / CSV)
              </h2>
              <p className="truncate text-xs text-stone-500">
                {step === "UPLOAD" &&
                  "Unggah file spreadsheet soal untuk pratinjau dan validasi otomatis"}
                {step === "PREVIEW" &&
                  "Tinjau baris valid dan catatan kesalahan sebelum disimpan"}
                {step === "EXECUTING" &&
                  "Sedang menyimpan soal beserta opsi jawabannya..."}
                {step === "RESULT" && "Hasil eksekusi impor soal"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={step === "EXECUTING"}
            className="touch-target rounded-md p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
            aria-label="Tutup dialog impor soal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UNGGAH */}
          {step === "UPLOAD" && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-6 text-center transition hover:border-teal-700 hover:bg-stone-50 sm:p-8"
              >
                <input
                  type="file"
                  id="question-file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={isPending}
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100/60 text-teal-800">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-stone-800">
                  Pilih file soal atau tarik &amp; lepas di sini
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Mendukung format .XLSX, .XLS, atau .CSV (maksimal 5MB, 1.000
                  baris)
                </p>

                {selectedFile && (
                  <p className="mt-3 text-xs font-semibold text-teal-800">
                    {selectedFile.name}
                  </p>
                )}

                {isPending && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-teal-800">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Membaca dan memvalidasi file...</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-800">
                    Belum memiliki format data?
                  </h4>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Unduh template resmi lengkap dengan kolom standar bank soal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="touch-target inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-xs transition hover:bg-stone-50"
                >
                  <Download className="h-4 w-4 text-stone-600" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <h4 className="text-xs font-bold text-stone-800">
                  Ketentuan kolom spreadsheet soal:
                </h4>
                <ul className="mt-2 grid grid-cols-1 gap-2 text-xs text-stone-600 sm:grid-cols-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span>Mata pelajaran dicocokkan dengan kode atau nama</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span>Pilihan ganda wajib 4 opsi dan 1 kunci (A sampai D)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span>Jawaban singkat wajib mengisi kolom kunci teks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span>Soal baru tersimpan sebagai Draf sampai Anda mengaktifkannya</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PRATINJAU */}
          {step === "PREVIEW" && previewResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div className="text-xs text-stone-500">Total Baris</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-stone-900">
                    {previewResult.summary.totalRows}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-800">Siap Diimpor</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                    {previewResult.summary.validRows}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-xs text-rose-800">Ditolak</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-rose-700">
                    {previewResult.summary.errorRows}
                  </div>
                </div>
              </div>

              <div className="flex overflow-x-auto border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={`touch-target shrink-0 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "ALL"
                      ? "border-teal-800 text-teal-800"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Semua ({previewResult.rows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("VALID")}
                  className={`touch-target shrink-0 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "VALID"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Valid ({previewResult.summary.validRows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ERROR")}
                  className={`touch-target shrink-0 px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "ERROR"
                      ? "border-rose-600 text-rose-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Ditolak ({previewResult.summary.errorRows})
                </button>
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-stone-200 bg-white">
                <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
                  <thead className="sticky top-0 bg-stone-50 font-semibold text-stone-600">
                    <tr>
                      <th className="px-3 py-2.5">Baris</th>
                      <th className="px-3 py-2.5">Mapel</th>
                      <th className="px-3 py-2.5">Tipe</th>
                      <th className="px-3 py-2.5">Naskah</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`transition hover:bg-stone-50/80 ${
                          row.status === "ERROR" ? "bg-rose-50/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-stone-500">
                          #{row.rowNumber}
                        </td>
                        <td className="px-3 py-2 font-medium text-stone-800">
                          {row.raw.subject || (
                            <span className="italic text-rose-600">Kosong</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-700">
                          {row.raw.type
                            ? questionTypeLabel(row.raw.type)
                            : "-"}
                        </td>
                        <td className="max-w-[16rem] px-3 py-2 text-stone-700">
                          <span className="line-clamp-2 break-words">
                            {truncateText(row.raw.stem || "", 120) || (
                              <span className="italic text-rose-600">Kosong</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {row.status === "VALID" ? (
                            <Badge variant="success">Siap Impor</Badge>
                          ) : (
                            <Badge variant="danger">Ditolak</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-600">
                          {row.errors.length > 0 && (
                            <div className="space-y-0.5 text-rose-600">
                              {row.errors.map((err, i) => (
                                <div key={`err-${i}`} className="flex items-start gap-1">
                                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span>{err.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.warnings.length > 0 && (
                            <div className="space-y-0.5 text-amber-700">
                              {row.warnings.map((warn, i) => (
                                <div key={`warn-${i}`} className="flex items-start gap-1">
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span>{warn.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.errors.length === 0 &&
                            row.warnings.length === 0 && (
                              <span className="font-medium text-emerald-700">
                                Baris valid
                              </span>
                            )}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-stone-500"
                        >
                          Tidak ada baris pada kategori ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-stone-500">
                Berkas: {previewResult.fileName}. Baris ditolak tidak ikut
                disimpan; perbaiki lalu unggah ulang bila perlu.
              </p>
            </div>
          )}

          {/* STEP 3: PROSES */}
          {step === "EXECUTING" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-9 w-9 animate-spin text-teal-800" />
              <h3 className="mt-4 text-base font-bold text-stone-900">
                Menyimpan Soal...
              </h3>
              <p className="mt-1 max-w-sm text-xs text-stone-500">
                Sistem memvalidasi ulang tiap baris, memeriksa izin lembaga, dan
                mencatat log audit impor.
              </p>
            </div>
          )}

          {/* STEP 4: HASIL */}
          {step === "RESULT" && executionResult && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-stone-900">
                  Impor Soal Selesai
                </h3>
                <p className="text-xs text-stone-500">
                  Soal hasil impor tersimpan sebagai Draf dan siap ditinjau.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Diproses</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-stone-800">
                    {executionResult.totalProcessed}
                  </div>
                </div>
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center">
                  <div className="text-xs text-teal-800">Soal Dibuat</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-teal-800">
                    {executionResult.createdQuestions}
                  </div>
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Dilewati</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-stone-700">
                    {executionResult.skippedRows}
                  </div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
                  <div className="text-xs text-rose-800">Gagal</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">
                    {executionResult.failedRows}
                  </div>
                </div>
              </div>

              {executionResult.details.some((detail) => detail.message) && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-600">
                  {executionResult.details
                    .filter((detail) => detail.message)
                    .map((detail) => (
                      <div
                        key={`${detail.rowNumber}-${detail.status}`}
                        className="flex items-start gap-2 py-0.5"
                      >
                        <LibraryBig className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                        <span>
                          Baris #{detail.rowNumber}: {detail.message}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/60 px-4 py-4 sm:px-6">
          {step === "UPLOAD" && (
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="touch-target rounded-md border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                Tutup
              </button>
            </div>
          )}

          {step === "PREVIEW" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("UPLOAD");
                  setPreviewResult(null);
                  setSelectedFile(null);
                }}
                className="touch-target rounded-md border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                Ganti File
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="touch-target rounded-md border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!previewResult?.canProceed || isPending}
                  className="touch-target inline-flex items-center gap-2 rounded-md bg-teal-800 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-40"
                >
                  <span>
                    Konfirmasi Impor ({previewResult?.summary.validRows || 0} Soal)
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {step === "RESULT" && (
            <div className="flex w-full justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="touch-target rounded-md bg-teal-800 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700"
              >
                Selesai
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
