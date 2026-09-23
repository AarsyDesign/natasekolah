"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Home,
  BookMarked,
  GraduationCap,
} from "lucide-react";
import {
  getInstitutionPluginsAction,
  updateInstitutionPluginsAction,
} from "../../../actions/settings";
import type { PluginId, PluginMetadata } from "../../../lib/plugins/registry";

export default function PluginsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [enabledPlugins, setEnabledPlugins] = useState<PluginId[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadPlugins = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await getInstitutionPluginsAction();
    if (res.success && res.data) {
      setEnabledPlugins(res.data.enabledPlugins);
      setAvailablePlugins(res.data.availablePlugins);
    } else {
      setErrorMsg(res.error || "Gagal memuat konfigurasi plugin.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleToggle = (id: PluginId) => {
    setEnabledPlugins((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setShowConfirm(false);

    startTransition(async () => {
      const res = await updateInstitutionPluginsAction({
        plugins: enabledPlugins,
      });

      if (res.success && res.data) {
        setEnabledPlugins(res.data);
        setSuccessMsg("Konfigurasi plugin domain lembaga berhasil diperbarui.");
      } else {
        setErrorMsg(res.error || "Gagal memperbarui konfigurasi plugin.");
      }
    });
  };

  const getPluginIcon = (id: string) => {
    switch (id) {
      case "FORMAL_ACADEMIC":
        return <BookOpen className="h-5 w-5 text-indigo-700" />;
      case "PESANTREN_LIVING":
        return <Home className="h-5 w-5 text-rose-700" />;
      case "TAHFIDZ":
        return <BookMarked className="h-5 w-5 text-cyan-700" />;
      case "PKBM":
        return <GraduationCap className="h-5 w-5 text-amber-700" />;
      default:
        return <Boxes className="h-5 w-5 text-teal-700" />;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat konfigurasi plugin domain...</p>
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

      {/* Principle Banner */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-stone-900">Integritas Data Historis Terjaga</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Menonaktifkan plugin akan menyembunyikan menu terkait dari navigasi staf dan menegakkan batasan keamanan di tingkat server. Seluruh data historis yang sudah ada (nilai raport, riwayat setoran tahfidz, kamar asrama) <strong>tetap aman dan tidak akan dihapus</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Core Platform Banner */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xs bg-teal-800 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                Core Platform
              </span>
              <h3 className="text-sm font-bold text-teal-950">Fitur Wajib Lembaga</h3>
            </div>
            <p className="text-xs text-teal-800 mt-1">
              Buku Induk Siswa, Rombel, Tahun Ajaran, Presensi Kelas, Keuangan & SPP, Direktori Guru, dan Notifikasi WA selalu aktif untuk seluruh lembaga.
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-teal-900">Selalu Aktif</span>
        </div>
      </div>

      {/* Available Plugins List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-stone-900">Plugin Domain Opsional</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {availablePlugins.map((plugin) => {
            const isEnabled = enabledPlugins.includes(plugin.id);
            return (
              <div
                key={plugin.id}
                onClick={() => handleToggle(plugin.id)}
                className={`cursor-pointer rounded-xl border p-4 shadow-2xs transition flex flex-col justify-between select-none ${
                  isEnabled
                    ? "border-teal-400 bg-white ring-1 ring-teal-400/20"
                    : "border-stone-200 bg-stone-50/60 opacity-80 hover:bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100">
                        {getPluginIcon(plugin.id)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          {plugin.category}
                        </span>
                        <h4 className="text-sm font-bold text-stone-900 leading-tight">
                          {plugin.name}
                        </h4>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(plugin.id)}
                      className="h-4 w-4 rounded-xs border-stone-300 text-teal-700 focus:ring-teal-500 cursor-pointer"
                    />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-600">
                    {plugin.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Kode: {plugin.id}</span>
                  <span
                    className={`font-semibold ${
                      isEnabled ? "text-teal-700" : "text-stone-500"
                    }`}
                  >
                    {isEnabled ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Action */}
      <div className="flex items-center justify-end pt-4">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs transition hover:bg-teal-700 disabled:opacity-50"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Terapkan Perubahan Plugin</span>
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <h3 className="text-base font-bold text-stone-900">
                Konfirmasi Konfigurasi Plugin
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-stone-600">
              Apakah Anda yakin ingin menerapkan perubahan konfigurasi modul domain? Fitur yang dinonaktifkan akan segera disembunyikan dari antarmuka staf internal. Data lama Anda tetap tersimpan dengan aman di basis data.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Ya, Terapkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
