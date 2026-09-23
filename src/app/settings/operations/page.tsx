"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Sliders,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  MessageSquare,
  FileCheck2,
} from "lucide-react";
import {
  getInstitutionSettingsAction,
  updateInstitutionOperationalSettingsAction,
} from "../../../actions/settings";
import type { OperationalSettings } from "../../../lib/settings/types";

export default function OperationalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState<OperationalSettings>({
    attendance: {
      lateThresholdMinutes: 15,
      requireAttendanceNotes: false,
    },
    finance: {
      receiptNumberPrefix: "KW",
      invoiceDueDays: 10,
      receiptFooterNote: "Kwitansi pembayaran sah diterbitkan secara digital oleh sistem.",
    },
    communication: {
      enableWhatsAppNotifications: true,
      whatsappProvider: "deeplink",
    },
    academic: {
      passingGradeDefault: 75,
      reportCardHeader: "Laporan Capaian Kompetensi Peserta Didik",
    },
  });

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await getInstitutionSettingsAction();
    if (res.success && res.data) {
      setFormData(res.data.operational);
    } else {
      setErrorMsg(res.error || "Gagal memuat aturan operasional.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateInstitutionOperationalSettingsAction(formData);
      if (res.success && res.data) {
        setFormData(res.data);
        setSuccessMsg("Aturan operasional lembaga berhasil diperbarui.");
      } else {
        setErrorMsg(res.error || "Gagal menyimpan aturan operasional.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat aturan operasional...</p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Presensi & Kehadiran */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
            <ClipboardCheck className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-base font-bold text-stone-900">Aturan Presensi Harian</h2>
              <p className="text-xs text-stone-500">
                Konfigurasi batas waktu keterlambatan dan catatan presensi santri/siswa.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Toleransi Keterlambatan (Menit)
              </label>
              <input
                type="number"
                min={0}
                max={240}
                value={formData.attendance.lateThresholdMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attendance: {
                      ...formData.attendance,
                      lateThresholdMinutes: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Keterlambatan di atas menit ini akan ditandai terlambat pada laporan kehadiran.
              </p>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.attendance.requireAttendanceNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      attendance: {
                        ...formData.attendance,
                        requireAttendanceNotes: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded-xs border-stone-300 text-teal-700 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-stone-700">
                  Wajibkan guru menyertakan keterangan untuk status Sakit atau Izin
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Keuangan & Kwitansi */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
            <CreditCard className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-base font-bold text-stone-900">Aturan Keuangan & Kwitansi SPP</h2>
              <p className="text-xs text-stone-500">
                Pengaturan nomor bukti pembayaran resmi dan tenggat jatuh tempo tagihan.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Prefix Nomor Kwitansi Pembayaran
              </label>
              <input
                type="text"
                maxLength={10}
                value={formData.finance.receiptNumberPrefix}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    finance: {
                      ...formData.finance,
                      receiptNumberPrefix: e.target.value.toUpperCase().trim(),
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden font-mono uppercase"
                placeholder="KW"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Contoh format hasil: <code>{formData.finance.receiptNumberPrefix || "KW"}-202609-000001</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tenggat Jatuh Tempo Tagihan (Hari)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={formData.finance.invoiceDueDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    finance: {
                      ...formData.finance,
                      invoiceDueDays: parseInt(e.target.value) || 10,
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Jumlah hari sejak tagihan terbit sebelum dinyatakan jatuh tempo (overdue).
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Catatan Kaki Resmi Kwitansi Digital
              </label>
              <input
                type="text"
                value={formData.finance.receiptFooterNote}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    finance: {
                      ...formData.finance,
                      receiptFooterNote: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
                placeholder="Kwitansi pembayaran sah diterbitkan secara digital oleh sistem."
              />
            </div>
          </div>
        </div>

        {/* Section 3: Komunikasi & WhatsApp */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
            <MessageSquare className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-base font-bold text-stone-900">Saluran Komunikasi WhatsApp</h2>
              <p className="text-xs text-stone-500">
                Pengaturan pengiriman kwitansi bayar dan pemberitahuan presensi ke nomor wali murid.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Metode / Provider Notifikasi WhatsApp
              </label>
              <select
                value={formData.communication.whatsappProvider}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    communication: {
                      ...formData.communication,
                      whatsappProvider: e.target.value as "fonnte" | "waha" | "deeplink",
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              >
                <option value="deeplink">WhatsApp Direct Web / App Link (Gratis & Mandiri)</option>
                <option value="fonnte">Fonnte API Gateway</option>
                <option value="waha">WAHA (WhatsApp HTTP API)</option>
              </select>
              <p className="text-[11px] text-stone-500 mt-1">
                Kredensial gateway dikelola di tingkat infrastruktur aman (.env) tanpa disimpan di UI.
              </p>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.communication.enableWhatsAppNotifications}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      communication: {
                        ...formData.communication,
                        enableWhatsAppNotifications: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 rounded-xs border-stone-300 text-teal-700 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-stone-700">
                  Aktifkan antrean Outbox WhatsApp untuk kwitansi pembayaran dan undangan wali
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: Akademik & Raport */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
            <FileCheck2 className="h-5 w-5 text-indigo-700" />
            <div>
              <h2 className="text-base font-bold text-stone-900">Standar Nilai & Cetak Raport</h2>
              <p className="text-xs text-stone-500">
                Nilai ketuntasan minimum acuan dan judul header dokumen cetak raport.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Kriteria Ketuntasan Minimum Acuan (KKM)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.academic.passingGradeDefault}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    academic: {
                      ...formData.academic,
                      passingGradeDefault: parseFloat(e.target.value) || 75,
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Judul Header Dokumen Buku Raport
              </label>
              <input
                type="text"
                value={formData.academic.reportCardHeader}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    academic: {
                      ...formData.academic,
                      reportCardHeader: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end pt-2">
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
            <span>Simpan Aturan Operasional</span>
          </button>
        </div>
      </form>
    </div>
  );
}
