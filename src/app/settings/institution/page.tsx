"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Building2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  getInstitutionSettingsAction,
  updateInstitutionProfileAction,
} from "../../../actions/settings";
import type { InstitutionProfileData } from "../../../lib/settings/types";

export default function InstitutionProfilePage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    type: "SEKOLAH",
    address: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
  });

  const loadProfile = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await getInstitutionSettingsAction();
    if (res.success && res.data) {
      const p = res.data.profile;
      setFormData({
        name: p.name || "",
        slug: p.slug || "",
        type: p.type || "SEKOLAH",
        address: p.address || "",
        phone: p.phone || "",
        email: p.email || "",
        website: p.website || "",
        logoUrl: p.logoUrl || "",
      });
    } else {
      setErrorMsg(res.error || "Gagal memuat profil lembaga.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateInstitutionProfileAction({
        name: formData.name,
        type: formData.type,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        logoUrl: formData.logoUrl || null,
      });

      if (res.success && res.data) {
        setSuccessMsg("Profil lembaga berhasil diperbarui secara permanen.");
      } else {
        setErrorMsg(res.error || "Gagal menyimpan perubahan profil.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat profil lembaga...</p>
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

      <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-6 shadow-2xs space-y-6">
        <div className="border-b border-stone-100 pb-4">
          <h2 className="text-base font-bold text-stone-900">Identitas & Informasi Lembaga</h2>
          <p className="text-xs text-stone-500 mt-1">
            Data ini digunakan sebagai kepala dokumen raport, bukti kwitansi resmi, dan outbox komunikasi.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Nama Lembaga */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nama Resmi Lembaga <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Contoh: Pondok Pesantren Al-Falah Modern"
            />
          </div>

          {/* Jenis Institusi */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Jenis Entitas Lembaga
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
            >
              <option value="SEKOLAH">Sekolah Formal (SD/SMP/SMA/SMK)</option>
              <option value="PESANTREN">Pondok Pesantren Salaf / Modern</option>
              <option value="PESANTREN_TERPADU">Pesantren Terpadu (Sekolah Plus Pondok)</option>
              <option value="RUMAH_TAHFIDZ">Rumah Tahfidz & Halaqah Quran</option>
              <option value="PKBM">Pendidikan Kesetaraan (PKBM)</option>
            </select>
          </div>

          {/* Slug (Read Only) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Slug Domain (Identifier Unik)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                disabled
                value={formData.slug}
                className="w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-500 cursor-not-allowed pr-8 font-mono"
              />
              <Lock className="absolute right-2.5 h-4 w-4 text-stone-400" />
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              Slug adalah batas isolasi tenant unik dan tidak dapat diubah bebas.
            </p>
          </div>

          {/* Nomor Telepon */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nomor Telepon / WhatsApp Resmi
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Contoh: 081234567890 atau 031-123456"
            />
          </div>

          {/* Email Lembaga */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Email Korespondensi
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="admin@pesantren-alfalah.sch.id"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Website Resmi
            </label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="https://pesantren-alfalah.sch.id"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              URL Logo Lembaga
            </label>
            <input
              type="text"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="https://cdn.lembaga.id/logo.png"
            />
          </div>

          {/* Alamat Lengkap */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Alamat Lengkap Lembaga
            </label>
            <textarea
              rows={3}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-600 focus:outline-hidden"
              placeholder="Jalan Pesantren No. 1, Desa Sukamaju, Kecamatan Cipanas, Kabupaten Cianjur"
            />
          </div>
        </div>

        {/* Action Button */}
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
            <span>Simpan Profil Lembaga</span>
          </button>
        </div>
      </form>
    </div>
  );
}
