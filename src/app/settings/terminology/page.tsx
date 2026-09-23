"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Languages,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Eye,
} from "lucide-react";
import {
  getInstitutionSettingsAction,
  updateInstitutionTerminologyAction,
} from "../../../actions/settings";
import {
  getTerminologyPresets,
  resolveInstitutionTerminology,
} from "../../../lib/settings/terminology";
import type { TerminologyDictionary } from "../../../lib/settings/types";

export default function TerminologySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [institutionType, setInstitutionType] = useState("SEKOLAH");
  const [terms, setTerms] = useState<TerminologyDictionary>({
    student: "Siswa",
    studentPlural: "Siswa",
    guardian: "Wali Murid",
    classroom: "Kelas",
    academicYear: "Tahun Ajaran",
    fee: "SPP",
    teacher: "Guru",
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const presets = getTerminologyPresets();

  const loadTerminology = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await getInstitutionSettingsAction();
    if (res.success && res.data) {
      setInstitutionType(res.data.profile.type);
      setTerms(res.data.terminology);
    } else {
      setErrorMsg(res.error || "Gagal memuat kamus terminologi.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTerminology();
  }, []);

  const handleApplyPreset = (presetKey: string) => {
    const selected = presets[presetKey];
    if (selected) {
      setTerms({ ...selected.terms });
      setSuccessMsg(`Preset [${selected.label}] berhasil diterapkan ke formulir. Klik simpan untuk mengonfirmasi.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateInstitutionTerminologyAction(terms);
      if (res.success && res.data) {
        setTerms(res.data);
        setSuccessMsg("Kamus istilah terminologi lembaga berhasil disimpan.");
      } else {
        setErrorMsg(res.error || "Gagal menyimpan terminologi.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat kamus istilah...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preset Selector */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-teal-700" />
          <h3 className="text-sm font-bold text-stone-900">Preset Cepat Berdasarkan Kultur</h3>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Pilih salah satu preset di bawah ini untuk mengisi istilah secara otomatis sesuai jenis lembaga Anda:
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleApplyPreset(key)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 transition"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-6">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-bold text-stone-900">Kustomisasi Kamus Istilah Antarmuka</h2>
          <p className="text-xs text-stone-500 mt-1">
            Istilah ini digunakan di seluruh label tombol, judul tabel, pesan WhatsApp, dan kwitansi resmi.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Siswa / Santri */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Peserta Didik (Tunggal) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.student}
              onChange={(e) => setTerms({ ...terms, student: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Santri / Siswa / Peserta Didik"
            />
          </div>

          {/* Jamak */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Peserta Didik (Jamak)
            </label>
            <input
              type="text"
              value={terms.studentPlural}
              onChange={(e) => setTerms({ ...terms, studentPlural: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Santri-santriwati / Siswa"
            />
          </div>

          {/* Guru / Ustadz */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Pendidik / Pengajar <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.teacher}
              onChange={(e) => setTerms({ ...terms, teacher: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Ustadz / Guru / Pendidik"
            />
          </div>

          {/* Wali Murid / Wali Santri */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Orang Tua / Wali <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.guardian}
              onChange={(e) => setTerms({ ...terms, guardian: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Wali Santri / Wali Murid / Orang Tua"
            />
          </div>

          {/* Rombel / Kelas */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Rombongan Belajar <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.classroom}
              onChange={(e) => setTerms({ ...terms, classroom: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Halaqah / Kelas / Rombel"
            />
          </div>

          {/* Biaya / SPP */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Iuran / Biaya Berkala <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.fee}
              onChange={(e) => setTerms({ ...terms, fee: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Syahriah / SPP / Iuran Bulanan"
            />
          </div>

          {/* Tahun Ajaran */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Istilah Periode Kalender Akademik <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={terms.academicYear}
              onChange={(e) => setTerms({ ...terms, academicYear: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Tahun Ajaran / Semester Akademik"
            />
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
          <div className="flex items-center gap-2 mb-2 text-teal-900 font-semibold text-xs">
            <Eye className="h-4 w-4" />
            <span>Pratinjau Penggunaan Istilah dalam Sistem:</span>
          </div>
          <div className="rounded-lg bg-white p-3 border border-teal-200/60 text-xs leading-relaxed text-stone-700 space-y-1.5 font-sans">
            <p>
              1. &ldquo;<strong>{terms.teacher}</strong> Ahmad telah mencatat kehadiran untuk 28{" "}
              <strong>{terms.student}</strong> di <strong>{terms.classroom}</strong> 7A.&rdquo;
            </p>
            <p>
              2. &ldquo;Pesan notifikasi kwitansi resmi pembayaran <strong>{terms.fee}</strong> telah
              dikirimkan via WhatsApp ke nomor <strong>{terms.guardian}</strong>.&rdquo;
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end border-t border-stone-100 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs transition hover:bg-teal-700 disabled:opacity-50"
          >
            {isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Simpan Kamus Terminologi</span>
          </button>
        </div>
      </form>
    </div>
  );
}
