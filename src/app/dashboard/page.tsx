"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "../../components/nav-header";
import { getOperationalDashboardAction } from "../../actions/operations";
import type {
  OperationalDashboardData,
  OperationalAttentionItem,
  QuickActionItem,
} from "../../lib/operations/types";
import {
  LayoutDashboard,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  BookMarked,
  Home,
  MessageSquare,
  Search,
  RefreshCw,
  School,
  Receipt,
  UserPlus,
  ShieldCheck,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { GlobalSearchDialog } from "../../components/global-search-dialog";

export default function OperationalDashboardPage() {
  const [data, setData] = useState<OperationalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const res = await getOperationalDashboardAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Gagal memuat data operasional.");
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const todayFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const renderQuickActionIcon = (iconName: string) => {
    switch (iconName) {
      case "UserPlus":
        return <UserPlus className="h-5 w-5 text-teal-700" />;
      case "School":
        return <School className="h-5 w-5 text-indigo-700" />;
      case "ClipboardCheck":
        return <ClipboardCheck className="h-5 w-5 text-emerald-700" />;
      case "FileCheck2":
        return <FileCheck2 className="h-5 w-5 text-sky-700" />;
      case "Receipt":
        return <Receipt className="h-5 w-5 text-amber-700" />;
      case "CreditCard":
        return <CreditCard className="h-5 w-5 text-emerald-700" />;
      case "Users":
        return <Users className="h-5 w-5 text-teal-700" />;
      case "BookMarked":
        return <BookMarked className="h-5 w-5 text-cyan-700" />;
      case "Home":
        return <Home className="h-5 w-5 text-rose-700" />;
      case "GraduationCap":
        return <GraduationCap className="h-5 w-5 text-teal-700" />;
      default:
        return <ArrowRight className="h-5 w-5 text-stone-700" />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16 font-sans text-stone-900">
      <NavHeader subtitle="Pusat Komando Operasional" />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Loading State */}
        {loading && !data && (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
            <p className="text-sm font-medium text-stone-600">
              Menyinkronkan data operasional harian...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900 shadow-xs">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-600" />
            <h3 className="mt-2 text-base font-semibold">Gagal Memuat Dasbor</h3>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800"
            >
              <RefreshCw className="h-4 w-4" /> Coba Lagi
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* Header: Greeting, Date, Quick Search & Refresh */}
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {data.institution.name}
                  </span>
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {data.institution.type}
                  </span>
                </div>
                <h1 className="mt-1.5 text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
                  Komando Operasional Hari Ini
                </h1>
                <p className="text-xs text-stone-500 sm:text-sm">
                  {todayFormatted} • Masuk sebagai{" "}
                  <strong className="text-stone-700">{data.user.name}</strong> (
                  {data.user.roles.join(", ")})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
                >
                  <Search className="h-4 w-4 text-stone-500" />
                  <span>Pencarian Cepat</span>
                  <kbd className="hidden sm:inline-block rounded-xs bg-white px-1.5 py-0.5 text-[10px] text-stone-500 border border-stone-200">
                    Ctrl+K
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={fetchDashboardData}
                  disabled={isPending}
                  className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 disabled:opacity-50"
                  aria-label="Segarkan data operasional"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isPending ? "animate-spin text-teal-700" : ""}`}
                  />
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </section>

            {/* SECTION 1: PERLU PERHATIAN (OPERATIONAL ATTENTION) */}
            <section aria-labelledby="attention-heading">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h2 id="attention-heading" className="text-base font-bold text-stone-900">
                    Perlu Perhatian Operasional
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      data.attentionItems.length > 0
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {data.attentionItems.length}
                  </span>
                </div>
              </div>

              {data.attentionItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-sm">
                    <strong>Kondisi Operasional Normal:</strong> Tidak ada sesi gantung, pesan
                    gagal, atau tagihan mendesak yang memerlukan tindakan saat ini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.attentionItems.map((item) => {
                    const isCritical = item.severity === "CRITICAL";
                    const isWarning = item.severity === "WARNING";

                    const badgeClass = isCritical
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : isWarning
                      ? "bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-stone-100 text-stone-800 border-stone-200";

                    const borderClass = isCritical
                      ? "border-rose-200 hover:border-rose-300"
                      : isWarning
                      ? "border-amber-200 hover:border-amber-300"
                      : "border-stone-200 hover:border-stone-300";

                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-2xs transition ${borderClass}`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                            >
                              {item.category} • {item.count} Item
                            </span>
                            <span className="text-[11px] font-medium text-stone-400">
                              {item.severity}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm font-bold text-stone-900">{item.title}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-stone-600">
                            {item.description}
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-stone-100">
                          <Link
                            href={item.actionHref}
                            className="touch-target inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-800"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECTION 2: HARI INI (TODAY'S OPERATIONAL PULSE) */}
            <section aria-labelledby="today-heading">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-teal-700" />
                  <h2 id="today-heading" className="text-base font-bold text-stone-900">
                    Aktivitas & Metrik Hari Ini
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Siswa Aktif */}
                {data.stats.students && (
                  <Link
                    href="/students"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Buku Induk
                      </span>
                      <Users className="h-4 w-4 text-teal-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-stone-900">
                        {data.stats.students.totalActive}
                      </span>
                      <span className="text-xs text-stone-500">Siswa Aktif</span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-700 group-hover:underline">
                      Lihat direktori siswa <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>
                )}

                {/* 2. Presensi Hari Ini */}
                {data.stats.attendance && (
                  <Link
                    href="/attendance"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Presensi Harian
                      </span>
                      <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-stone-900">
                        {data.stats.attendance.todaySessionsTotal}
                      </span>
                      <span className="text-xs text-stone-500">Sesi Hari Ini</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-600">
                      <span className="text-emerald-700 font-medium">
                        {data.stats.attendance.closedSessionsCount} Ditutup
                      </span>
                      <span>•</span>
                      <span
                        className={
                          data.stats.attendance.openSessionsCount > 0
                            ? "text-amber-700 font-semibold"
                            : "text-stone-500"
                        }
                      >
                        {data.stats.attendance.openSessionsCount} Terbuka
                      </span>
                    </div>
                  </Link>
                )}

                {/* 3. Keuangan Hari Ini */}
                {data.stats.finance && (
                  <Link
                    href="/finance"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Arus Kas & SPP
                      </span>
                      <CreditCard className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-bold tracking-tight text-stone-900">
                        Rp {data.stats.finance.todayPaymentsSum.toLocaleString("id-ID")}
                      </span>
                      <p className="text-[11px] text-stone-500">
                        {data.stats.finance.todayPaymentsCount} Pembayaran Masuk
                      </p>
                    </div>
                    <div className="mt-2 text-[11px] text-stone-600">
                      {data.stats.finance.overdueChargesCount > 0 ? (
                        <span className="font-semibold text-rose-700">
                          {data.stats.finance.overdueChargesCount} Tagihan Menunggak
                        </span>
                      ) : (
                        <span className="text-stone-500">Semua tagihan terkendali</span>
                      )}
                    </div>
                  </Link>
                )}

                {/* 4. Akademik / Penilaian (jika FORMAL_ACADEMIC aktif) */}
                {data.stats.academic && (
                  <Link
                    href="/assessments"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Penilaian & Raport
                      </span>
                      <FileCheck2 className="h-4 w-4 text-sky-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-stone-900">
                        {data.stats.academic.totalAssessments}
                      </span>
                      <span className="text-xs text-stone-500">Total Penilaian</span>
                    </div>
                    <div className="mt-2 text-[11px] text-stone-600">
                      <span>{data.stats.academic.draftAssessmentsCount} Asesmen Draf</span>
                      <span> • </span>
                      <span>{data.stats.academic.draftReportsCount} Raport Draf</span>
                    </div>
                  </Link>
                )}

                {/* 5. Tahfidz (jika TAHFIDZ aktif) */}
                {data.stats.tahfidz && (
                  <Link
                    href="/tahfidz"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Tahfidz Qur&apos;an
                      </span>
                      <BookMarked className="h-4 w-4 text-cyan-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-stone-900">
                        {data.stats.tahfidz.todayRecordsCount}
                      </span>
                      <span className="text-xs text-stone-500">Setoran Hari Ini</span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-cyan-700 group-hover:underline">
                      Buka mutaba&apos;ah tahfidz <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>
                )}

                {/* 6. Living / Asrama (jika PESANTREN_LIVING aktif) */}
                {data.stats.living && (
                  <Link
                    href="/dormitories"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Asrama & Kobong
                      </span>
                      <Home className="h-4 w-4 text-rose-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-stone-900">
                        {data.stats.living.activeResidentsCount}
                      </span>
                      <span className="text-xs text-stone-500">Santri Mukim</span>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-500">
                      {data.stats.living.todayDormSessionsCount} Sesi Presensi Malam
                    </p>
                  </Link>
                )}

                {/* 7. Outbox Notifikasi WA */}
                {data.stats.notifications && (
                  <Link
                    href="/notifications"
                    className="group rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                        Outbox WhatsApp
                      </span>
                      <MessageSquare className="h-4 w-4 text-teal-700" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-bold tracking-tight ${
                          data.stats.notifications.failedCount > 0
                            ? "text-rose-700"
                            : "text-stone-900"
                        }`}
                      >
                        {data.stats.notifications.failedCount}
                      </span>
                      <span className="text-xs text-stone-500">Pesan Gagal</span>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-500">
                      {data.stats.notifications.pendingCount} Pesan dalam antrean
                    </p>
                  </Link>
                )}
              </div>
            </section>

            {/* SECTION 3: AKSI CEPAT (QUICK ACTIONS SESUAI RBAC) */}
            <section aria-labelledby="quick-actions-heading">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-teal-700" />
                  <h2 id="quick-actions-heading" className="text-base font-bold text-stone-900">
                    Aksi Cepat Operasional
                  </h2>
                </div>
                <span className="text-xs text-stone-500">
                  Disesuaikan dengan hak akses ({data.quickActions.length} tersedia)
                </span>
              </div>

              {data.quickActions.length === 0 ? (
                <div className="rounded-xl border border-stone-200 bg-white p-6 text-center text-stone-500">
                  <p className="text-sm">Tidak ada aksi cepat khusus untuk peran akun Anda.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {data.quickActions.map((action) => (
                    <Link
                      key={action.id}
                      href={action.href}
                      className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-2xs transition hover:border-teal-400 hover:shadow-xs min-h-[96px]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 group-hover:bg-teal-50">
                          {renderQuickActionIcon(action.iconName)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-stone-900 group-hover:text-teal-900">
                            {action.label}
                          </h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-stone-500 line-clamp-2">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end text-xs font-medium text-teal-700 group-hover:translate-x-0.5 transition-transform">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 4: TRANSPARANSI PLUGIN AKTIF */}
            <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    Modul & Plugin Aktif Lembaga
                  </h3>
                  <p className="text-xs text-stone-500">
                    Fitur domain yang diaktifkan untuk {data.institution.name} ({data.institution.slug})
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                    Core Platform (Wajib)
                  </span>
                  {data.institution.enabledPlugins.map((plugin) => (
                    <span
                      key={plugin}
                      className="rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-semibold text-teal-800"
                    >
                      {plugin}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Global Search Dialog Modal */}
      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
