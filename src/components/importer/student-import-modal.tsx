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
  UserCheck,
  Users,
} from "lucide-react";
import {
  previewStudentImportAction,
  executeStudentImportAction,
  getStudentImportTemplateAction,
} from "../../actions/importer";
import type {
  ImportPreviewResult,
  ImportExecutionResult,
  PreviewRow,
} from "../../lib/importer/types";

interface StudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = "UPLOAD" | "PREVIEW" | "EXECUTING" | "RESULT";

export function StudentImportModal({
  isOpen,
  onClose,
  onSuccess,
}: StudentImportModalProps) {
  const [step, setStep] = useState<ImportStep>("UPLOAD");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(
    null
  );
  const [executionResult, setExecutionResult] =
    useState<ImportExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "WARNING" | "ERROR">("ALL");

  const [isPending, startTransition] = useTransition();

  // Reset state when closing or opening
  const handleClose = () => {
    if (step === "EXECUTING") return; // Jangan tutup saat proses impor aktif
    setStep("UPLOAD");
    setSelectedFile(null);
    setPreviewResult(null);
    setExecutionResult(null);
    setErrorMessage(null);
    setActiveTab("ALL");
    onClose();
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const res = await getStudentImportTemplateAction();
      if (res.success && res.data) {
        const link = document.createElement("a");
        link.href = `data:${res.data.contentType};base64,${res.data.base64}`;
        link.download = res.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setErrorMessage(res.error || "Gagal mengunduh template.");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan saat mengunduh template.");
    }
  };

  // File selection & upload preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await previewStudentImportAction(formData);
      if (res.success && res.data) {
        setPreviewResult(res.data);
        setStep("PREVIEW");
      } else {
        setErrorMessage(res.error || "Gagal memproses file.");
      }
    });
  };

  // Execute import
  const handleConfirmImport = () => {
    if (!previewResult) return;

    // Filter baris yang siap diimpor (aksi CREATE)
    const validItems = previewResult.rows
      .filter((r) => r.action === "CREATE")
      .map((r) => r.sanitized);

    if (validItems.length === 0) {
      setErrorMessage("Tidak ada data valid yang dapat diimpor.");
      return;
    }

    setStep("EXECUTING");
    setErrorMessage(null);

    startTransition(async () => {
      const res = await executeStudentImportAction(validItems);
      if (res.success && res.data) {
        setExecutionResult(res.data);
        setStep("RESULT");
        onSuccess();
      } else {
        setErrorMessage(res.error || "Gagal mengeksekusi impor data.");
        setStep("PREVIEW");
      }
    });
  };

  if (!isOpen) return null;

  // Filtered rows for preview table
  const filteredRows =
    previewResult?.rows.filter((r) => {
      if (activeTab === "VALID") return r.status === "VALID";
      if (activeTab === "WARNING") return r.status === "WARNING";
      if (activeTab === "ERROR") return r.status === "ERROR";
      return true;
    }) || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-stone-200 bg-white text-stone-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Impor Data Siswa (Excel / CSV)
              </h2>
              <p className="text-xs text-stone-500">
                {step === "UPLOAD" && "Unggah file spreadsheet untuk prapinjau dan sanitasi otomatis"}
                {step === "PREVIEW" && "Tinjau data hasil sanitasi dan deteksi duplikasi sebelum disimpan"}
                {step === "EXECUTING" && "Sedang memproses penyimpanan data ke database..."}
                {step === "RESULT" && "Hasil eksekusi impor data siswa"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={step === "EXECUTING"}
            className="touch-target rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === "UPLOAD" && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-8 text-center transition hover:border-teal-700 hover:bg-stone-50"
              >
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  disabled={isPending}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100/60 text-teal-800">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-stone-800">
                  Pilih file spreadsheet atau tarik & lepas di sini
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Mendukung format .XLSX, .XLS, atau .CSV (maksimal 5MB)
                </p>

                {isPending && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-teal-800">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Membaca dan memvalidasi file...</span>
                  </div>
                )}
              </div>

              {/* Template & Guidelines */}
              <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-xs font-bold text-stone-800">
                    Belum memiliki format data?
                  </h4>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Unduh template Excel resmi lengkap dengan format kolom standar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-xs transition hover:bg-stone-50"
                >
                  <Download className="h-4 w-4 text-stone-600" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              {/* Sanitizer Info Notes */}
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <h4 className="text-xs font-bold text-stone-800">
                  Fitur Sanitasi Otomatis NataSekolah:
                </h4>
                <ul className="mt-2 grid grid-cols-1 gap-2 text-xs text-stone-600 sm:grid-cols-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                    <span>Normalisasi nomor HP (08xx / 628xx)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                    <span>Deteksi tanggal serial Excel & string</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                    <span>Pembersihan spasi & format angka float</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                    <span>Pencegahan duplikasi NIS dan NISN</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === "PREVIEW" && previewResult && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <div className="text-xs text-stone-500">Total Baris</div>
                  <div className="mt-1 text-xl font-bold text-stone-900">
                    {previewResult.summary.totalRows}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="text-xs text-emerald-800">Siswa Baru</div>
                  <div className="mt-1 text-xl font-bold text-emerald-700">
                    {previewResult.summary.newRecords}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="text-xs text-amber-800">Peringatan</div>
                  <div className="mt-1 text-xl font-bold text-amber-700">
                    {previewResult.summary.warningRows}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-100 p-3">
                  <div className="text-xs text-stone-600">Duplikat (Lewati)</div>
                  <div className="mt-1 text-xl font-bold text-stone-700">
                    {previewResult.summary.exactDuplicates}
                  </div>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                  <div className="text-xs text-red-800">Error (Ditolak)</div>
                  <div className="mt-1 text-xl font-bold text-red-700">
                    {previewResult.summary.errorRows}
                  </div>
                </div>
              </div>

              {/* Tabs Filter */}
              <div className="flex border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("ALL")}
                  className={`touch-target px-4 py-2 text-xs font-semibold border-b-2 transition ${
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
                  className={`touch-target px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "VALID"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Valid ({previewResult.summary.validRows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("WARNING")}
                  className={`touch-target px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "WARNING"
                      ? "border-amber-600 text-amber-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Peringatan / Duplikat ({previewResult.summary.warningRows})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ERROR")}
                  className={`touch-target px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === "ERROR"
                      ? "border-red-600 text-red-700"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Error ({previewResult.summary.errorRows})
                </button>
              </div>

              {/* Preview Table */}
              <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white">
                <table className="min-w-full divide-y divide-stone-200 text-left text-xs">
                  <thead className="bg-stone-50 font-semibold text-stone-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Baris</th>
                      <th className="px-3 py-2.5">NIS</th>
                      <th className="px-3 py-2.5">Nama Lengkap</th>
                      <th className="px-3 py-2.5">JK</th>
                      <th className="px-3 py-2.5">Status & Rencana Aksi</th>
                      <th className="px-3 py-2.5">Catatan / Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`transition hover:bg-stone-50/80 ${
                          row.status === "ERROR"
                            ? "bg-red-50/30"
                            : row.action === "SKIP_DUPLICATE"
                            ? "bg-stone-50/50"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-stone-400">
                          #{row.rowNumber}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-stone-800">
                          {row.sanitized.nis || (
                            <span className="italic text-red-500">Kosong</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-stone-900">
                          {row.sanitized.fullName || (
                            <span className="italic text-red-500">Kosong</span>
                          )}
                          {row.sanitized.classroomName && (
                            <span className="ml-1.5 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                              {row.sanitized.classroomName}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.sanitized.gender === "L" ? "Laki-laki" : "Perempuan"}
                        </td>
                        <td className="px-3 py-2">
                          {row.action === "CREATE" && (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {row.duplicateType === "POTENTIAL"
                                ? "Impor (Potensi Duplikat)"
                                : "Impor Baru"}
                            </span>
                          )}
                          {row.action === "SKIP_DUPLICATE" && (
                            <span className="inline-flex rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                              Lewati (Duplikat)
                            </span>
                          )}
                          {row.action === "REJECT" && (
                            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              Ditolak (Error)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-600">
                          {row.errors.length > 0 && (
                            <div className="space-y-0.5 text-red-600">
                              {row.errors.map((err, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" />
                                  <span>{err.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.warnings.length > 0 && (
                            <div className="space-y-0.5 text-amber-700">
                              {row.warnings.map((warn, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span>{warn.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className="text-emerald-700 font-medium">
                              Data valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTING */}
          {step === "EXECUTING" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-10 w-10 animate-spin text-teal-800" />
              <h3 className="mt-4 text-base font-bold text-stone-900">
                Menyimpan Data Siswa...
              </h3>
              <p className="mt-1 text-xs text-stone-500 max-w-sm">
                Sistem sedang memverifikasi batasan tenant, mencatat riwayat enrollment, dan membuat log audit.
              </p>
            </div>
          )}

          {/* STEP 4: RESULT */}
          {step === "RESULT" && executionResult && (
            <div className="space-y-6 py-4">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-stone-900">
                  Impor Data Selesai
                </h3>
                <p className="text-xs text-stone-500">
                  Proses impor master data peserta didik telah berhasil dieksekusi.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Siswa Dibuat</div>
                  <div className="mt-1 text-2xl font-bold text-teal-800">
                    {executionResult.createdStudents}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Wali Terhubung</div>
                  <div className="mt-1 text-2xl font-bold text-stone-800">
                    {executionResult.createdGuardians}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Penempatan Kelas</div>
                  <div className="mt-1 text-2xl font-bold text-stone-800">
                    {executionResult.linkedEnrollments}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <div className="text-xs text-stone-500">Duplikat Dilewati</div>
                  <div className="mt-1 text-2xl font-bold text-stone-500">
                    {executionResult.skippedDuplicates}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50/50 px-6 py-4">
          {step === "UPLOAD" && (
            <div className="flex w-full items-center justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
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
                className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                Ganti File
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!previewResult?.canProceed || isPending}
                  className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-40"
                >
                  <span>
                    Konfirmasi Impor ({previewResult?.summary.newRecords || 0} Siswa)
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {step === "RESULT" && (
            <div className="flex w-full items-center justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="touch-target rounded-lg bg-teal-800 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700"
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
