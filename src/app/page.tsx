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
  GraduationCap,
  Users,
  CalendarCheck,
  Wallet,
  ClipboardList,
  BedDouble,
  HeartHandshake,
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

interface Module {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MODULES: Module[] = [
  {
    title: "Kesiswaan & Buku Induk",
    description: "Biodata, rombongan belajar, kenaikan kelas, dan riwayat akademik tiap siswa dalam satu tempat.",
    icon: Users,
  },
  {
    title: "Presensi & Izin Santri",
    description: "Absensi harian, riwayat kehadiran, dan izin keluar yang tercatat lengkap dengan alasannya.",
    icon: CalendarCheck,
  },
  {
    title: "Keuangan & SPP",
    description: "Tagihan, kas harian, pembayaran per wali murid, sampai laporan keuangan yang bisa diaudit.",
    icon: Wallet,
  },
  {
    title: "Nilai, Ujian & Raport",
    description: "Bank soal, naskah ujian siap cetak, penilaian, hingga raport yang dibekukan saat diterbitkan.",
    icon: ClipboardList,
  },
  {
    title: "Asrama & Tahfidz",
    description: "Kamar asrama, kegiatan harian, halaqah, setoran hafalan, dan muroja'ah santri.",
    icon: BedDouble,
  },
  {
    title: "Portal Wali Murid",
    description: "Wali dapat melihat nilai, presensi, keuangan, dan tagihan lembaga lewat akunnya sendiri.",
    icon: HeartHandshake,
  },
];

const HIGHLIGHTS = [
  {
    title: "Satu sumber data",
    description: "Nilai, presensi, dan pembayaran disimpan sekali lalu dipakai bersama di seluruh modul.",
    icon: ShieldCheck,
  },
  {
    title: "Riwayat tidak tertimpa",
    description: "Data semester lalu tetap tersimpan utuh saat siswa naik kelas atau lulus.",
    icon: History,
  },
  {
    title: "Hak akses per peran",
    description: "Guru, wali kelas, bendahara, dan admin lembaga melihat bagian yang berbeda.",
    icon: UserCheck,
  },
];

interface InstitutionType {
  name: string;
  scope: string;
  focus: string;
}

const INSTITUTION_TYPES: InstitutionType[] = [
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

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<number>(1);
  const selectedPoint = PAIN_POINTS.find((p) => p.id === activeTab) || PAIN_POINTS[0];

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#18181b] flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-[#e5e5e0] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 touch-target rounded-lg" aria-label="NataSekolah, kembali ke beranda">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-lg shadow-xs">
              N
            </div>
            <div className="text-left">
              <span className="text-lg font-bold tracking-tight text-[#18181b] block leading-tight">
                NataSekolah
              </span>
              <span className="text-xs text-[#52525b] block leading-tight">
                Manajemen Lembaga Pendidikan
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#52525b]" aria-label="Navigasi utama">
            <a href="#fitur" className="hover:text-[#0f766e] transition-colors">Fitur</a>
            <a href="#kendala" className="hover:text-[#0f766e] transition-colors">Kendala Manual</a>
            <a href="#lembaga" className="hover:text-[#0f766e] transition-colors">Jenis Lembaga</a>
          </nav>

          <Link
            href="/login"
            className="touch-target rounded-lg bg-teal-800 px-5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700"
          >
            Masuk
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-[#e5e5e0] bg-gradient-to-b from-white to-[#fbfbfa]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e5e5e0] text-[#52525b] text-xs font-medium shadow-xs mb-6">
              <Building2 className="w-4 h-4 text-[#0f766e]" />
              <span>Satu sistem untuk sekolah &amp; pesantren di Indonesia</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#18181b] leading-[1.15] max-w-3xl mx-auto">
              Menata Pendidikan, Merapikan Masa Depan.
            </h1>

            <p className="mt-5 text-base sm:text-xl text-[#52525b] max-w-2xl mx-auto leading-relaxed">
              Tinggalkan Excel yang tersebar dan arsip kertas yang menumpuk. NataSekolah merapikan kesiswaan,
              presensi, keuangan, sampai raport dalam satu sistem.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="touch-target w-full sm:w-auto rounded-lg bg-teal-800 px-7 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700"
              >
                Masuk ke NataSekolah
              </Link>
              <a
                href="#kendala"
                className="touch-target w-full sm:w-auto rounded-lg border border-stone-300 bg-white px-7 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Lihat 7 Kendala Manual
              </a>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
              {HIGHLIGHTS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div key={item.title} className="bg-white rounded-xl border border-[#e5e5e0] p-4 shadow-xs">
                    <IconComponent className="w-5 h-5 text-[#0f766e] mb-2" />
                    <h2 className="text-sm font-bold text-[#18181b] mb-1">{item.title}</h2>
                    <p className="text-xs text-[#52525b] leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Modul Fitur */}
        <section id="fitur" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0f766e]">Modul</span>
            <h2 className="text-2xl font-bold tracking-tight text-[#18181b] mt-1">
              Apa saja yang bisa dikelola
            </h2>
            <p className="text-sm text-[#52525b] mt-1">
              Satu akun lembaga mengakses seluruh modul di bawah ini, tanpa perangkat lunak tambahan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="bg-white rounded-xl border border-[#e5e5e0] p-5 shadow-xs hover:border-teal-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#f0fdfa] text-[#0f766e] flex items-center justify-center mb-3">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-[#18181b] mb-1">{mod.title}</h3>
                  <p className="text-sm text-[#52525b] leading-relaxed">{mod.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 7 Kendala Manual */}
        <section id="kendala" className="border-y border-[#e5e5e0] bg-white scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0f766e]">Kendala</span>
                <h2 className="text-2xl font-bold tracking-tight text-[#18181b] mt-1">
                  7 Kendala Manual yang Ditata Rapi
                </h2>
                <p className="text-sm text-[#52525b]">
                  Kenyataan lapangan yang saat ini membebani guru, ustadz, dan staf tata usaha:
                </p>
              </div>
              <span className="text-xs text-[#52525b]">Pilih kendala untuk melihat solusinya</span>
            </div>

            {/* Tab pill berdimensi sentuh (min 44px) */}
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
                    <span className="text-xs font-semibold line-clamp-1">{item.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Kartu fokus: kondisi manual -> solusi */}
            <div className="mt-4 bg-[#fbfbfa] rounded-xl border border-[#e5e5e0] p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1 space-y-2 border-b md:border-b-0 md:border-r border-[#e5e5e0] pb-4 md:pb-0 md:pr-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
                      Kondisi Manual Saat Ini
                    </span>
                    <span className="text-xs text-[#52525b]">Kendala #{selectedPoint.id}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#18181b]">{selectedPoint.title}</h3>
                  <p className="text-sm text-[#52525b] leading-relaxed">{selectedPoint.problem}</p>
                </div>

                <div className="hidden md:flex items-center justify-center w-8 text-[#0f766e]">
                  <ArrowRight className="w-6 h-6" />
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#ecfdf5] text-[#16a34a] border border-[#a7f3d0]">
                      Solusi NataSekolah
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-[#0f766e]">Tertata Otomatis &amp; Terpusat</h4>
                  <p className="text-sm text-[#18181b] leading-relaxed font-medium">{selectedPoint.solution}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Jenis Lembaga */}
        <section id="lembaga" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 scroll-mt-20">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0f766e]">Cakupan</span>
            <h2 className="text-2xl font-bold tracking-tight text-[#18181b] mt-1">
              Dirancang untuk Karakter Lembaga Indonesia
            </h2>
            <p className="text-sm text-[#52525b]">
              Satu sistem yang menyesuaikan istilah dan alur kerja tiap model pendidikan di tanah air.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INSTITUTION_TYPES.map((inst) => (
              <div key={inst.name} className="bg-white p-5 rounded-xl border border-[#e5e5e0] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-base text-[#18181b]">{inst.name}</h3>
                  <GraduationCap className="w-4 h-4 text-[#0f766e]" />
                </div>
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-stone-100 text-[#52525b] mb-3">
                  {inst.scope}
                </span>
                <p className="text-xs sm:text-sm text-[#52525b] leading-relaxed">{inst.focus}</p>
              </div>
            ))}

            <div className="bg-teal-800 text-white p-5 rounded-xl shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-teal-200 block mb-1">
                  Prinsip Utama
                </span>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">Single Source of Truth</h3>
                <p className="text-xs sm:text-sm text-teal-50 leading-relaxed">
                  Satu peserta didik, satu identitas terpadu. Data nilai dan riwayat kelas tetap tersimpan abadi,
                  bukan saling menimpa antar file.
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-teal-600/60 flex items-center justify-between text-xs text-teal-100 font-medium">
                <span>Pusat Data &amp; Operasional Lembaga</span>
                <CheckCircle2 className="w-4 h-4 text-teal-200" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA Penutup */}
        <section className="bg-white border-t border-[#e5e5e0]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
            <School className="w-8 h-8 text-[#0f766e] mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181b]">
              Siap merapikan lembaga Anda?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#52525b] max-w-xl mx-auto">
              Masuk dengan akun yang diberikan admin lembaga, lalu kelola siswa, kelas, keuangan, dan raport
              dari satu tempat.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="touch-target w-full sm:w-auto rounded-lg bg-teal-800 px-7 py-3.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700"
              >
                Masuk ke Akun Lembaga
              </Link>
              <Link
                href="/wali/aktivasi"
                className="touch-target w-full sm:w-auto rounded-lg border border-stone-300 px-7 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Aktivasi Akun Wali
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e5e5e0] py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#52525b]">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-[#0f766e]" />
            <span>NataSekolah — Menata Pendidikan, Merapikan Masa Depan</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#fitur" className="hover:text-[#0f766e] transition-colors">Fitur</a>
            <a href="#lembaga" className="hover:text-[#0f766e] transition-colors">Jenis Lembaga</a>
            <Link href="/login" className="hover:text-[#0f766e] transition-colors">
              Masuk
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
