"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { activateGuardianAction } from "../../../actions/guardian";
import { ShieldCheck, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function AktivasiForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken.trim());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Silakan masukkan token atau tautan undangan aktivasi Anda.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await activateGuardianAction({ token: token.trim() });
      if (res.success) {
        router.push(res.redirect);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Terjadi kesalahan saat memproses aktivasi. Silakan coba sesaat lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-md">
            <ShieldCheck className="h-8 w-8" />
          </div>
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-zinc-900">
          Aktivasi Akun Wali Murid
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-600">
          Masukkan token undangan resmi dari sekolah/pesantren untuk membuka akses ke Portal Wali.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-5 sm:px-10 shadow-sm border border-stone-200 rounded-2xl">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <span className="font-semibold block mb-0.5">Aktivasi Belum Berhasil</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="token" className="block text-xs font-semibold text-zinc-700">
                Token Undangan (64 Karakter)
              </label>
              <div className="mt-1.5">
                <input
                  id="token"
                  name="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Contoh: 4a2b9f..."
                  className="block w-full rounded-xl border border-stone-300 px-3.5 py-3 text-sm text-zinc-900 shadow-2xs placeholder:text-zinc-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 focus:outline-none min-h-[44px]"
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 leading-relaxed">
                Token undangan dikirimkan oleh pihak sekolah melalui pesan resmi WhatsApp ke nomor ponsel Anda.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:opacity-50 transition touch-target min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Aktivasi & Masuk Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-100 text-center">
            <p className="text-xs text-zinc-500">
              Pengguna staf atau pengajar?{" "}
              <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AktivasiPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      }
    >
      <AktivasiForm />
    </Suspense>
  );
}
