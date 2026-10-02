"use client";

import React, { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "../../actions/auth";
import { getSafePostLoginPath } from "../../lib/auth/navigation";
import { useToast } from "../../components/ui/toast";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[100dvh] place-items-center bg-[#fbfbfa] px-4">
          <p className="text-sm text-[#52525b]">Memuat halaman masuk...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionExpired = searchParams.get("expired") === "1";

  React.useEffect(() => {
    if (sessionExpired && !error) {
      toast({
        title: "Sesi Berakhir",
        description: "Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.",
        variant: "expired",
        duration: 8000,
      });
    }
  }, [sessionExpired, toast, error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);

    const result = await loginAction({
      institutionSlug: formData.get("institutionSlug"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.replace(getSafePostLoginPath(searchParams.get("redirect")));
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] bg-[#fbfbfa] px-4 py-8 sm:grid sm:place-items-center sm:p-8">
      <section className="mx-auto w-full max-w-md rounded-xl border border-[#e5e5e0] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-7 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-lg font-bold text-white"
          >
            N
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-[#18181b]">NataSekolah</p>
            <p className="text-sm text-[#52525b]">Masuk ke ruang kerja lembaga</p>
          </div>
        </div>

        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#18181b]">Masuk</h1>
          <p className="text-sm leading-6 text-[#52525b]">
            Gunakan akun staf lembaga yang telah diaktifkan administrator.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p aria-live="polite" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm leading-5 text-[#991b1b]" role="alert">
              {error}
            </p>
          ) : null}

          <label className="block space-y-2" htmlFor="institutionSlug">
            <span className="text-sm font-semibold text-[#18181b]">Kode lembaga</span>
            <input
              autoCapitalize="none"
              autoComplete="organization"
              className="min-h-11 w-full rounded-lg border border-[#a1a1aa] bg-white px-3 text-base text-[#18181b] outline-none placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2"
              id="institutionSlug"
              name="institutionSlug"
              placeholder="contoh: pesantren-al-falah"
              required
              spellCheck={false}
              type="text"
            />
          </label>

          <label className="block space-y-2" htmlFor="email">
            <span className="text-sm font-semibold text-[#18181b]">Email</span>
            <input
              autoCapitalize="none"
              autoComplete="email"
              className="min-h-11 w-full rounded-lg border border-[#a1a1aa] bg-white px-3 text-base text-[#18181b] outline-none placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2"
              id="email"
              inputMode="email"
              name="email"
              placeholder="nama@lembaga.id"
              required
              type="email"
            />
          </label>

          <label className="block space-y-2" htmlFor="password">
            <span className="text-sm font-semibold text-[#18181b]">Kata sandi</span>
            <input
              autoComplete="current-password"
              className="min-h-11 w-full rounded-lg border border-[#a1a1aa] bg-white px-3 text-base text-[#18181b] outline-none placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2"
              id="password"
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="min-h-11 w-full rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#52525b]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Memeriksa akun..." : "Masuk ke NataSekolah"}
          </button>
        </form>

        <div className="mt-6 border-t border-[#e5e5e0] pt-4 text-sm leading-6 text-[#52525b] space-y-2">
          <p>
            Wali murid memiliki token undangan?{" "}
            <Link className="font-semibold text-[#0f766e] underline underline-offset-4" href="/wali/aktivasi">
              Aktivasi portal wali
            </Link>
          </p>
          <p>
            Belum memiliki akses? Hubungi administrator lembaga Anda.
          </p>
        </div>
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#0f766e] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2" href="/">
          Kembali ke informasi NataSekolah
        </Link>
      </section>
    </main>
  );
}
