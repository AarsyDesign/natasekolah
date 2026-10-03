"use client";

/**
 * Phase 12.3 — Halaman Jejak Audit (`/audit-log`).
 *
 * Hanya untuk pemegang `institution:view` (SUPER_ADMIN / FOUNDATION_HEAD /
 * PRINCIPAL / ADMIN): guard ada di service, di sini hanya menampilkan
 * keadaan kosong/error dengan bahasa manusiawi.
 *
 * Filter: aksi, entitas, pelaku, rentang tanggal, paginasi.
 * Tampilan mobile-first: tabel layar lebar → kartu di layar kecil.
 */

import { useCallback, useEffect, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listAuditLogAction,
  getAuditLogFacetsAction,
} from "@/actions/audit";
import {
  ScrollText,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

interface AuditPageData {
  items: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  UPDATE: "bg-sky-50 text-sky-800 border-sky-200",
  DELETE: "bg-rose-50 text-rose-800 border-rose-200",
  SOFT_DELETE: "bg-rose-50 text-rose-800 border-rose-200",
  ARCHIVE: "bg-stone-100 text-stone-700 border-stone-300",
  VOID: "bg-amber-50 text-amber-800 border-amber-200",
  LOGIN: "bg-teal-50 text-teal-800 border-teal-200",
};

function actionBadge(action: string): string {
  if (ACTION_BADGE[action]) return ACTION_BADGE[action];
  if (action.startsWith("CREATE")) return ACTION_BADGE.CREATE;
  if (action.startsWith("UPDATE")) return ACTION_BADGE.UPDATE;
  if (action.startsWith("DELETE")) return ACTION_BADGE.DELETE;
  return "bg-stone-100 text-stone-700 border-stone-300";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(d);
}

function summarizeDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  try {
    const text = JSON.stringify(details);
    return text.length > 140 ? `${text.slice(0, 137)}...` : text;
  } catch {
    return "";
  }
}

const EMPTY_FILTER = {
  action: "",
  entityType: "",
  userId: "",
  from: "",
  to: "",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPageData | null>(null);
  const [facets, setFacets] = useState<{ actions: string[]; entityTypes: string[] }>(
    { actions: [], entityTypes: [] }
  );
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [applied, setApplied] = useState(EMPTY_FILTER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const load = useCallback(
    async (targetPage: number, targetFilter: typeof EMPTY_FILTER) => {
      setLoading(true);
      setError(null);
      const res = await listAuditLogAction({
        page: targetPage,
        pageSize: 20,
        ...(targetFilter.action ? { action: targetFilter.action } : {}),
        ...(targetFilter.entityType ? { entityType: targetFilter.entityType } : {}),
        ...(targetFilter.userId ? { userId: targetFilter.userId } : {}),
        ...(targetFilter.from ? { from: targetFilter.from } : {}),
        ...(targetFilter.to ? { to: targetFilter.to } : {}),
      });
      if (res.success && res.data) {
        // `createdAt` datang sebagai string dari server action (JSON wire).
        setData(res.data as unknown as AuditPageData);
      } else {
        setError(
          (res as { error?: string }).error || "Gagal memuat jejak audit."
        );
        setData(null);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    void load(page, applied);
  }, [page, applied, load]);

  useEffect(() => {
    void (async () => {
      const res = await getAuditLogFacetsAction();
      if (res.success && res.data) setFacets(res.data);
    })();
  }, []);

  const applyFilter = () => {
    setPage(1);
    setApplied(filter);
  };

  const resetFilter = () => {
    setFilter(EMPTY_FILTER);
    setPage(1);
    setApplied(EMPTY_FILTER);
  };

  const activeFilterCount = Object.values(applied).filter(Boolean).length;

  return (
    <div className="min-h-dvh bg-stone-50">
      <NavHeader subtitle="Jejak Audit" />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Jejak Audit</h1>
            <p className="text-sm text-stone-500">
              Riwayat tindakan pada lembaga ini — siapa, apa, kapan.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFilter((v) => !v)}
              className="touch-target inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-2xs transition hover:bg-stone-50"
              aria-expanded={showFilter}
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="rounded-xs bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => void load(page, applied)}
              className="touch-target inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-2xs transition hover:bg-stone-50"
              aria-label="Muat ulang"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Muat Ulang
            </button>
          </div>
        </div>

        {/* Panel filter */}
        {showFilter && (
          <section className="mt-4 rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Aksi</span>
                <select
                  value={filter.action}
                  onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">Semua aksi</option>
                  {facets.actions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  Entitas
                </span>
                <select
                  value={filter.entityType}
                  onChange={(e) =>
                    setFilter({ ...filter, entityType: e.target.value })
                  }
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                >
                  <option value="">Semua entitas</option>
                  {facets.entityTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  ID Pelaku (opsional)
                </span>
                <input
                  type="text"
                  value={filter.userId}
                  onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
                  placeholder="user_..."
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  Dari tanggal
                </span>
                <input
                  type="date"
                  value={filter.from}
                  onChange={(e) => setFilter({ ...filter, from: e.target.value })}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  Sampai tanggal
                </span>
                <input
                  type="date"
                  value={filter.to}
                  onChange={(e) => setFilter({ ...filter, to: e.target.value })}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={applyFilter}
                className="touch-target rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={resetFilter}
                className="touch-target rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Atur Ulang
              </button>
            </div>
          </section>
        )}

        {/* Konten */}
        <section className="mt-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-rose-500" />
              <p className="mt-2 text-sm font-medium text-rose-800">
                {error.includes("izin") || error.includes("izinkan")
                  ? "Anda tidak memiliki akses ke jejak audit lembaga ini."
                  : error}
              </p>
              <button
                type="button"
                onClick={() => void load(page, applied)}
                className="touch-target mt-4 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-800"
              >
                Coba Lagi
              </button>
            </div>
          ) : loading && !data ? (
            <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-teal-700" />
              <span className="ml-2 text-sm text-stone-500">
                Memuat jejak audit...
              </span>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white py-16 text-center">
              <ScrollText className="mx-auto h-9 w-9 text-stone-300" />
              <p className="mt-3 text-sm font-medium text-stone-700">
                Belum ada jejak audit
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {activeFilterCount > 0
                  ? "Tidak ada catatan yang cocok dengan filter ini."
                  : "Setiap tindakan pada lembaga akan tercatat di sini."}
              </p>
            </div>
          ) : data ? (
            <>
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xs">
                {/* Tabel layar lebar */}
                <table className="hidden w-full text-left text-sm md:table">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Waktu</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                      <th className="px-4 py-3 font-medium">Entitas</th>
                      <th className="px-4 py-3 font-medium">Pelaku</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.items.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-600">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-xs border px-2 py-0.5 text-[11px] font-medium ${actionBadge(row.action)}`}
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-800">
                          {row.entityType}
                          {row.entityId ? (
                            <span className="block truncate text-xs text-stone-400">
                              {row.entityId}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {row.actor ? row.actor.name : (
                            <span className="text-stone-400">Sistem</span>
                          )}
                        </td>
                        <td className="max-w-[24ch] truncate px-4 py-3 text-xs text-stone-500">
                          {summarizeDetails(row.details) || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Kartu layar kecil */}
                <ul className="divide-y divide-stone-100 md:hidden">
                  {data.items.map((row) => (
                    <li key={row.id} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-block rounded-xs border px-2 py-0.5 text-[11px] font-medium ${actionBadge(row.action)}`}
                        >
                          {row.action}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {formatDate(row.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-stone-900">
                        {row.entityType}
                        {row.entityId ? (
                          <span className="block truncate text-xs font-normal text-stone-400">
                            {row.entityId}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        Pelaku: {row.actor ? row.actor.name : "Sistem"}
                      </p>
                      {row.details ? (
                        <p className="mt-1 break-all text-xs text-stone-500">
                          {summarizeDetails(row.details)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Paginasi */}
              <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                <span>
                  Total {data.total} catatan · Halaman {data.page} dari{" "}
                  {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="touch-target inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="touch-target inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
