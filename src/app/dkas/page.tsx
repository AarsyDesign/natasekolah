"use client";

/**
 * Phase 12.7 — Halaman Asisten Data DKAS (`/dkas`).
 *
 * Halaman ini murni kontainer: seluruh logika percakapan ada di
 * `@/components/dkas-chat`. Guard `dkas:query` + rate limit ada di server
 * action; di sini hanya menampilkan keadaan awal.
 */

import { NavHeader } from "@/components/nav-header";
import { DkasChat } from "@/components/dkas-chat";

export default function DkasPage() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <NavHeader subtitle="Asisten Data" />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            Asisten Data (DKAS Bot)
          </h1>
          <p className="text-sm text-stone-500">
            Tanya data santri, presensi, nilai, dan izin dalam bahasa
            sehari-hari — server menerjemahannya menjadi query ber-whitelist.
          </p>
        </div>

        <DkasChat />
      </main>
    </div>
  );
}
