/**
 * Halaman verifikasi publik naskah ujian (Phase 10.3, PRD #31).
 *
 * Diakses lewat QR pada naskah cetak: `/verify/exam/<token mentah>`.
 * Sifatnya PUBLIK (tanpa sesi — terdaftar di PUBLIC_PREFIXES middleware)
 * dan HANYA menampilkan identitas ringkas naskah:
 *   lembaga, judul, mapel, tahun ajaran, jenis, status, waktu terakhir diperbarui.
 *
 * ANTI-LEAK: halaman ini TIDAK PERNAH menampilkan daftar soal, stem,
 * opsi, kunci jawaban, maupun data tenant lain — cukup `getExamPublicIdentity`
 * yang memilih kolom secara eksplisit di lapisan service.
 */

import { notFound } from "next/navigation";
import { ShieldCheck, XCircle } from "lucide-react";
import { getExamPublicIdentity } from "@/lib/exam-paper";
import type { ExamPublicIdentity } from "@/lib/exam-paper";

const TYPE_LABEL: Record<string, string> = {
  DAILY: "Harian",
  MIDTERM: "Tengah Semester",
  FINAL: "Akhir Semester",
  REMEDIAL: "Remedial",
  PRACTICAL: "Praktik",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  READY: "Siap",
  ISSUED: "Diterbitkan",
  ARCHIVED: "Arsip",
};

interface VerifyPageProps {
  params: Promise<{ token: string }>;
}

async function loadIdentity(token: string): Promise<ExamPublicIdentity | null> {
  try {
    return await getExamPublicIdentity(token);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: VerifyPageProps) {
  const { token } = await params;
  const identity = await loadIdentity(token);
  return {
    title: identity ? `Verifikasi: ${identity.title}` : "Verifikasi Naskah Ujian",
  };
}

export default async function VerifyExamPage({ params }: VerifyPageProps) {
  const { token } = await params;
  const identity = await loadIdentity(token);

  if (!identity) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-2xs">
          <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-base font-bold text-stone-900">
            Naskah Tidak Ditemukan
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-stone-600">
            Token verifikasi tidak dikenal atau naskah sudah tidak berlaku.
            Token dapat diputar ulang oleh penyelenggara ujian — pastikan Anda
            memindai QR dari cetakan terbaru.
          </p>
          <p className="mt-3 text-[11px] text-stone-400">
            Verifikasi Naskah Ujian · NataSekolah
          </p>
        </div>
      </main>
    );
  }

  const rows: Array<[string, string]> = [
    ["Lembaga", identity.institutionName ?? "-"],
    ["Mata Pelajaran", identity.subjectName ?? "-"],
    ["Tahun Ajaran", identity.academicYearName ?? "-"],
    ["Jenis Ujian", TYPE_LABEL[identity.examType] ?? identity.examType],
    ["Status", STATUS_LABEL[identity.status] ?? identity.status],
    [
      "Terakhir Diperbarui",
      identity.issuedAt
        ? new Date(identity.issuedAt).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "-",
    ],
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Naskah Terverifikasi
            </span>
          </div>

          <h1 className="mt-3 text-lg font-bold leading-snug text-stone-900">
            {identity.title}
          </h1>

          <dl className="mt-4 divide-y divide-stone-100 border-y border-stone-100">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 py-2">
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="text-right text-xs font-semibold text-stone-800">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-[11px] leading-relaxed text-stone-500">
            Halaman ini hanya menampilkan identitas ringkas naskah untuk
            keperluan verifikasi keaslian. Daftar soal dan kunci jawaban tidak
            pernah ditampilkan di sini.
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          Diverifikasi melalui QR NataSekolah
        </p>
      </div>
    </main>
  );
}
