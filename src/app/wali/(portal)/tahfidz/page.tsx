import React from "react";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentTahfidz } from "../../../../lib/guardian/portal-service";
import { BookMarked, Sparkles, Calendar, CheckCircle2 } from "lucide-react";

export default async function GuardianTahfidzPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId } = await searchParams;
  const auth = await getAuthenticatedGuardianSession();
  const profile = await getGuardianProfile(auth.guardian.id, auth.institution.id);

  if (profile.children.length === 0) {
    return <div>Belum ada santri terhubung.</div>;
  }

  const targetStudentId =
    studentId && profile.children.some((c) => c.student.id === studentId)
      ? studentId
      : profile.children[0].student.id;

  const activeChild =
    profile.children.find((c) => c.student.id === targetStudentId) || profile.children[0];

  const tahfidz = await getGuardianStudentTahfidz({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Mutaba&apos;ah Tahfidz Al-Qur&apos;an
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Capaian hafalan ziyadah (tambahan baru) dan pengulangan muraja&apos;ah santri {activeChild.student.fullName}.
        </p>
      </div>

      {/* Ringkasan Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-zinc-500">Total Ziyadah Baru</span>
          <span className="mt-1 block text-2xl font-bold text-teal-800">
            {tahfidz.totalZiyadahAyat}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Ayat telah disetorkan</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-zinc-500">Total Muraja&apos;ah</span>
          <span className="mt-1 block text-2xl font-bold text-indigo-700">
            {tahfidz.totalMurajaahAyat}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Ayat diulang bersama musyrif</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-zinc-500">Frekuensi Setoran</span>
          <span className="mt-1 block text-2xl font-bold text-zinc-900">
            {tahfidz.totalRecords} kali
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Tercatat di buku mutaba&apos;ah</span>
        </div>
      </div>

      {/* Riwayat Setoran */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-indigo-700" />
            <h2 className="text-sm font-bold text-zinc-900">Riwayat Setoran Hafalan</h2>
          </div>
          <span className="text-xs text-zinc-500">{tahfidz.recentRecords.length} rekaman</span>
        </div>

        {tahfidz.recentRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada rekaman setoran tahfidz untuk santri ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {tahfidz.recentRecords.map((record) => (
              <div
                key={record.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-stone-50/50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">
                      {record.surahName}
                    </span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                      Ayat {record.startAyah} - {record.endAyah}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        record.type === "SETORAN"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-indigo-50 text-indigo-800"
                      }`}
                    >
                      {record.type}
                    </span>
                  </div>

                  <p className="mt-1 text-[11px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(record.date).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </p>

                  {record.note && (
                    <p className="mt-1.5 text-xs text-zinc-600 bg-stone-50 rounded-lg p-2 border border-stone-200/60 inline-block leading-relaxed">
                      Catatan Musyrif: &ldquo;{record.note}&rdquo;
                    </p>
                  )}
                </div>

                {record.quality && (
                  <div className="sm:text-right shrink-0">
                    <span className="text-[11px] text-zinc-400 block">Kualitas Bacaan:</span>
                    <span className="text-xs font-bold text-teal-800">{record.quality}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
