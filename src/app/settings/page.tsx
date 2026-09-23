"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Boxes,
  Languages,
  Sliders,
  Users2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { getInstitutionSettingsAction } from "../../actions/settings";
import type { InstitutionProfileData, TerminologyDictionary, OperationalSettings } from "../../lib/settings/types";

export default function SettingsHubPage() {
  const [data, setData] = useState<{
    profile: InstitutionProfileData;
    terminology: TerminologyDictionary;
    operational: OperationalSettings;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchSettings = () => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const res = await getInstitutionSettingsAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat konfigurasi lembaga.");
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat konfigurasi lembaga...</p>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900 shadow-xs">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
        <h3 className="mt-2 text-base font-semibold">Gagal Memuat Pengaturan</h3>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
        <button
          onClick={fetchSettings}
          className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
        >
          <RefreshCw className="h-4 w-4" /> Coba Lagi
        </button>
      </div>
    );
  }

  const profile = data?.profile;
  const terminology = data?.terminology;
  const operational = data?.operational;

  return (
    <div className="space-y-6">
      {/* Overview Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Profil Lembaga */}
        <Link
          href="/settings/institution"
          className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {profile?.type}
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-stone-900 group-hover:text-teal-900">
              Profil & Identitas
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              {profile?.name} • Slug: <code className="text-stone-700">{profile?.slug}</code>
            </p>
            <p className="mt-0.5 text-xs text-stone-500 truncate">
              {profile?.address || "Alamat belum diatur"} • {profile?.phone || "No telp belum diatur"}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-teal-700">
            <span>Ubah Profil</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 2: Modul & Plugin */}
        <Link
          href="/settings/plugins"
          className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-800">
                <Boxes className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                {profile?.enabledPlugins.length} Aktif
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-stone-900 group-hover:text-teal-900">
              Modul & Domain Plugin
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Aktifkan kurikulum formal, mutaba&apos;ah tahfidz, asrama santri, atau PKBM.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {profile?.enabledPlugins.map((p) => (
                <span key={p} className="rounded-xs bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-700">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-teal-700">
            <span>Kelola Plugin</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 3: Terminologi & Bahasa */}
        <Link
          href="/settings/terminology"
          className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <Languages className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Kamus Aktif
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-stone-900 group-hover:text-teal-900">
              Terminologi & Kamus Istilah
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Kustomisasi sebutan santri/siswa, ustadz/guru, syahriah/SPP sesuai kultur lembaga.
            </p>
            <div className="mt-2 text-xs text-stone-600">
              <span className="font-semibold text-teal-900">{terminology?.student}</span> •{" "}
              <span>{terminology?.teacher}</span> • <span>{terminology?.fee}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-teal-700">
            <span>Atur Istilah</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 4: Aturan Operasional */}
        <Link
          href="/settings/operations"
          className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <Sliders className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                Toleransi & SPP
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-stone-900 group-hover:text-teal-900">
              Aturan Operasional
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Toleransi keterlambatan, nomor kwitansi keuangan, dan pengaturan pesan notifikasi.
            </p>
            <p className="mt-2 text-xs text-stone-600">
              Batas telat: {operational?.attendance.lateThresholdMinutes} menit • Prefix: {operational?.finance.receiptNumberPrefix}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-teal-700">
            <span>Ubah Aturan</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 5: Pengguna & Hak Akses */}
        <Link
          href="/settings/users"
          className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                <Users2 className="h-5 w-5" />
              </span>
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                RBAC Internal
              </span>
            </div>
            <h2 className="mt-3 text-base font-bold text-stone-900 group-hover:text-teal-900">
              Pengguna & Hak Akses Staf
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Kelola status keaktifan akun guru/staf dan penugasan peran resmi internal lembaga.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-semibold text-teal-700">
            <span>Kelola Staf</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>

      {/* Security Principle Banner */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              Prinsip Tata Kelola Multi-Tenancy NataSekolah
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Seluruh konfigurasi terisolasi 100% pada tingkat institusi aktif Anda. Perubahan pengaturan hanya dapat
              dilakukan oleh akun yang memiliki izin otorisasi yang sah (<code className="text-stone-800 font-semibold">institution:manage</code> atau <code className="text-stone-800 font-semibold">staff:manage</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
