"use client";

/**
 * Fallback error boundary global (Phase 12.2 — Error Boundary & Recovery UI).
 *
 * Dikompilasi Next.js sebagai boundary untuk segmen di bawah root layout.
 * Tugas: menahan crash render (runtime error) dan menawarkan jalan pulang
 * yang manusiawi, bukan layar kosong / stack trace.
 *
 * Catatan keamanan: pesan error teknis TIDAK ditampilkan ke pengguna
 * (hanya log ke console di sisi klien). Kegagalan sesi berakhir sudah
 * ditangani `rethrowIfSessionExpired` → redirect `/login?expired=1`
 * sehingga tidak akan pernah sampai ke boundary ini.
 */

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({
  error,
  reset,
}: ErrorPageProps) {
  useEffect(() => {
    // Log untuk observability (klien) — jangan tampilkan ke pengguna.
    console.error("[app] render error:", error?.message, error?.digest);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-2xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        <h1 className="mt-4 text-base font-bold text-stone-900">
          Terjadi gangguan tak terduga
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Halaman ini gagal dimuat. Data Anda aman — coba muat ulang, atau
          kembali ke dasbor.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Coba Lagi
          </button>
          <a
            href="/dashboard"
            className="min-h-[44px] rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            Ke Dasbor
          </a>
        </div>

        {error?.digest ? (
          <p className="mt-4 text-[11px] text-stone-400">
            Kode gangguan: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
