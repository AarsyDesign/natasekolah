"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Building2, 
  FileSpreadsheet, 
  FileText, 
  MessageSquare, 
  CreditCard, 
  History, 
  UserCheck, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  School,
  GraduationCap
} from "lucide-react";

interface PainPoint {
  id: number;
  title: string;
  problem: string;
  solution: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PAIN_POINTS: PainPoint[] = [
  {
    id: 1,
    title: "Excel yang Tersebar",
    problem: "File nilai, biodata, dan pembayaran tersimpan di komputer staf yang berbeda-beda dan rawan hilang.",
    solution: "Tersentralisasi dalam satu sistem cloud terpadu dengan hak akses terisolasi per lembaga.",
    icon: FileSpreadsheet,
  },
  {
    id: 2,
    title: "Dokumen Kertas Menumpuk",
    problem: "Buku induk fisik, formulir pendaftaran, dan arsip usang memakan ruang serta sulit dicari saat dibutuhkan.",
    solution: "Arsip digital permanen yang terstruktur rapi, dapat dicari dalam hitungan detik, dan aman dari kerusakan fisik.",
    icon: FileText,
  },
  {
    id: 3,
    title: "WhatsApp Manual Satu per Satu",
    problem: "Staf tata usaha mengirim pesan tagihan dan kabar presensi satu per satu secara manual hingga larut malam.",
    solution: "Sistem komunikasi terstruktur yang siap mengirimkan rekap presensi dan kwitansi resmi langsung ke ponsel wali murid.",
    icon: MessageSquare,
  },
  {
    id: 4,
    title: "Pencatatan Pembayaran Terpisah",
    problem: "Buku kas bendahara tidak sinkron dengan catatan wali kelas, memicu perselisihan status bayar santri.",
    solution: "Pencatatan keuangan bertingkat yang transparan dengan bukti kwitansi unik dan riwayat pembayaran yang jelas.",
    icon: CreditCard,
  },
  {
    id: 5,
    title: "Data Siswa Tanpa Histori",
    problem: "Saat siswa naik kelas atau lulus, rekam jejak kelas lama tertimpa dan sulit dilacak kembali.",
    solution: "Prinsip data historis terjaga (Sacred History) di mana data kelas dan raport tiap semester tersimpan abadi.",
    icon: History,
  },
  {
    id: 6,
    title: "Administrasi Guru yang Berulang",
    problem: "Guru menghabiskan waktu menyalin nama siswa ke berbagai lembar format penilaian yang sama berulang kali.",
    solution: "Satu identitas siswa digunakan bersama untuk seluruh keperluan akademik, kepesantrenan, dan absensi.",
    icon: UserCheck,
  },
  {
    id: 7,
    title: "Pembuatan Raport & Dokumen Manual",
    problem: "Masa akhir semester menjadi beban berat karena perumusan nilai dan pencetakan raport dilakukan secara manual.",
    solution: "Format dokumen terstandarisasi yang siap cetak rapi dan dapat dibekukan (frozen snapshot) saat diterbitkan.",
    icon: BookOpen,
  },
];

const INSTITUTION_TYPES = [
  {
    name: "Sekolah Formal",
    scope: "SD, SMP, SMA, SMK",
    focus: "Kurikulum Nasional, Absensi Harian, E-Raport Resmi, Administrasi SPP.",
  },
  {
    name: "Pondok Pesantren",
    scope: "Pesantren Salaf & Modern",
    focus: "Kegiatan Asrama, Pengajian Kitab, Izin Santri (Tasrih), Shalat Berjamaah.",
  },
  {
    name: "Pesantren Terpadu",
    scope: "Sekolah Plus Pondok",
    focus: "Satu identitas santri untuk KBM pagi, kepondokan sore, dan asrama malam.",
  },
  {
    name: "Rumah Tahfidz",
    scope: "Halaqah Al-Qur'an",
    focus: "Setoran Hafalan (Ziyadah), Pengulangan (Muraja'ah), Penilaian Tajwid.",
  },
  {
    name: "PKBM",
    scope: "Paket A, B, C & Kesetaraan",
    focus: "Fleksibilitas Warga Belajar, Ujian Modul, Administrasi Terjadwal.",
  },
];

export default function VisionPage() {
  const [activeTab, setActiveTab] = useState<number>(1);
  const selectedPoint = PAIN_POINTS.find((p) => p.id === activeTab) || PAIN_POINTS[0];

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#18181b] flex flex-col">
      {/* Top Bar / Header Navigasi Resmi */}
      <header className="bg-white border-b border-[#e5e5e0] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0f766e] text-white flex items-center justify-center font-bold text-lg shadow-xs">
              N
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#18181b] block leading-tight">
                NataSekolah
              </span>
              <span className="text-xs text-[#52525b] block">
                Unified Education Management Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="touch-target rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
            >
              Dashboard Operasional
            </Link>
            <Link
              href="/students"
              className="touch-target rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Buku Induk
            </Link>
            <Link
              href="/classrooms"
              className="touch-target hidden rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:inline-flex"
            >
              Rombel
            </Link>
            <Link
              href="/subjects"
              className="touch-target hidden rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 md:inline-flex"
            >
              Mapel
            </Link>
            <Link
              href="/teachers"
              className="touch-target hidden rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 md:inline-flex"
            >
              Guru
            </Link>
            <Link
              href="/teacher-assignments"
              className="touch-target hidden rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 lg:inline-flex"
            >
              Penugasan
            </Link>
          </div>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        
        {/* Banner Tagline & Visi Utama */}
        <section className="text-center sm:text-left border-b border-[#e5e5e0] pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-stone-100 border border-[#e5e5e0] text-[#52525b] text-xs font-medium mb-4">
            <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
            <span>Dokumen Spesifikasi Produk (PRD 1.1)</span>
          </div>
          
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#18181b] leading-snug sm:leading-tight">
            Menata Pendidikan, Merapikan Masa Depan.
          </h1>
          
          <p className="mt-2 text-base sm:text-lg text-[#52525b]">
            Tinggalkan Cara Manual, Saatnya Lembaga Anda Tertata Rapi.
          </p>

          <div className="mt-6 p-5 sm:p-6 rounded-xl bg-white border border-[#e5e5e0] shadow-xs">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ecfdf5] text-[#0f766e] flex-shrink-0 flex items-center justify-center mt-1">
                <School className="w-6 h-6" />
              </div>
              <div className="space-y-2 text-left">
                <h2 className="text-lg font-bold text-[#18181b]">
                  1.1 Visi NataSekolah
                </h2>
                <p className="text-sm sm:text-base text-[#18181b] leading-relaxed">
                  NataSekolah adalah platform SaaS multi-tenant yang menjadi <strong className="font-semibold text-[#0f766e]">pusat data dan operasional lembaga pendidikan</strong> Indonesia.
                </p>
                <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed">
                  NataSekolah tidak sekadar menggantikan buku dan Excel. Tujuan utamanya adalah menciptakan satu rujukan tunggal data (<span className="italic font-medium text-[#18181b]">Single Source of Truth</span>) untuk seluruh aktivitas administratif dan pembelajaran di lembaga Anda.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7 Masalah Operasional Manual yang Diselesaikan */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#18181b]">
                7 Kendala Manual yang Ditata Rapi
              </h2>
              <p className="text-sm text-[#52525b]">
                Kenyataan lapangan yang saat ini membebani guru, ustadz, dan staf tata usaha:
              </p>
            </div>
            <span className="text-xs text-[#52525b]">
              Pilih kendala untuk melihat solusinya
            </span>
          </div>

          {/* Navigasi Pill / Tab Berdimensi Sentuh Nyaman (min 44px) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {PAIN_POINTS.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  type="button"
                  className={`touch-target p-2 rounded-lg border text-left flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] ${
                    isActive
                      ? "bg-[#0f766e] text-white border-[#0f766e] shadow-xs"
                      : "bg-white text-[#18181b] border-[#e5e5e0] hover:bg-stone-50"
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <IconComponent className={`w-4 h-4 ${isActive ? "text-white" : "text-[#0f766e]"}`} />
                    <span className={`text-[10px] font-bold ${isActive ? "text-teal-200" : "text-[#52525b]"}`}>
                      0{item.id}
                    </span>
                  </div>
                  <span className="text-xs font-semibold line-clamp-1">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kartu Fokus Detail Transformasi */}
          <div className="bg-white rounded-xl border border-[#e5e5e0] p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Sisi Kondisi Manual */}
              <div className="flex-1 space-y-2 border-b md:border-b-0 md:border-r border-[#e5e5e0] pb-4 md:pb-0 md:pr-6">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
                    Kondisi Manual Saat Ini
                  </span>
                  <span className="text-xs text-[#52525b]">Kendala #{selectedPoint.id}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#18181b]">
                  {selectedPoint.title}
                </h3>
                <p className="text-sm text-[#52525b] leading-relaxed">
                  {selectedPoint.problem}
                </p>
              </div>

              {/* Panah Transisi */}
              <div className="hidden md:flex items-center justify-center w-8 text-[#0f766e]">
                <ArrowRight className="w-6 h-6" />
              </div>

              {/* Sisi Transformasi NataSekolah */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#ecfdf5] text-[#16a34a] border border-[#a7f3d0]">
                    Solusi NataSekolah (1.1)
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-[#0f766e]">
                  Tertata Otomatis & Terpusat
                </h4>
                <p className="text-sm text-[#18181b] leading-relaxed font-medium">
                  {selectedPoint.solution}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sasaran Lembaga Pendidikan */}
        <section className="space-y-6 border-t border-[#e5e5e0] pt-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#18181b]">
              Dirancang untuk Karakter Lembaga Indonesia
            </h2>
            <p className="text-sm text-[#52525b]">
              Satu arsitektur terpadu yang fleksibel melayani berbagai model pendidikan di tanah air:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {INSTITUTION_TYPES.map((inst, idx) => (
              <div 
                key={idx}
                className="bg-white p-5 rounded-xl border border-[#e5e5e0] shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base text-[#18181b]">
                      {inst.name}
                    </h3>
                    <GraduationCap className="w-4 h-4 text-[#0f766e]" />
                  </div>
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-stone-100 text-[#52525b] mb-3">
                    {inst.scope}
                  </span>
                  <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed">
                    {inst.focus}
                  </p>
                </div>
              </div>
            ))}

            {/* Kotak Pernyataan Single Source of Truth */}
            <div className="bg-[#0f766e] text-white p-5 rounded-xl shadow-xs flex flex-col justify-between sm:col-span-2 md:col-span-1">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-teal-200 block mb-1">
                  Tujuan Utama 1.1
                </span>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                  Single Source of Truth
                </h3>
                <p className="text-xs sm:text-sm text-teal-50 leading-relaxed">
                  Menghilangkan duplikasi identitas siswa. Satu peserta didik, satu identitas terpadu, dan riwayat yang terlindungi abadi.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-teal-600/60 flex items-center justify-between text-xs text-teal-100 font-medium">
                <span>Pusat Data & Operasional</span>
                <CheckCircle2 className="w-4 h-4 text-teal-200" />
              </div>
            </div>
          </div>
        </section>

        {/* Ringkasan Status & Komitmen Lingkup Terbatas */}
        <section className="bg-white rounded-xl border border-[#e5e5e0] p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#18181b]">
              Status Eksekusi Batasan Kerja (PRD 1.1)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed">
            Pengerjaan ini secara ketat hanya mencakup **Bagian 1.1 Visi Produk**. Seluruh modul operasional selanjutnya (seperti Kesiswaan, Presensi, Keuangan, E-Raport) tidak dikerjakan mendahului urutan, sesuai instruksi pembatasan ketat (*tidak boleh lebih*) dan aturan *Development Order* PRD v5.0.
          </p>
        </section>

      </main>

      {/* Footer Bersahaja */}
      <footer className="bg-white border-t border-[#e5e5e0] py-6 text-center text-xs text-[#52525b]">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NataSekolah (PRD v5.0 : Modul 1.1 Visi Produk)</span>
          <span>Menata Pendidikan, Merapikan Masa Depan</span>
        </div>
      </footer>
    </div>
  );
}
