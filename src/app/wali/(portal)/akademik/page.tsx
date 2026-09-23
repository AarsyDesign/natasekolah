import React from "react";
import Link from "next/link";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentAcademic } from "../../../../lib/guardian/portal-service";
import { Award, FileText, ArrowRight, CheckCircle2, Calendar, BookOpen, Clock } from "lucide-react";

export default async function GuardianAcademicPage({
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

  const academic = await getGuardianStudentAcademic({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  const studentQuery = `?studentId=${targetStudentId}`;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Akademik & Buku Raport
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Capaian hasil belajar, rekap nilai harian, dan buku raport resmi santri {activeChild.student.fullName}.
        </p>
      </div>

      {/* 1. Buku Raport Resmi (PUBLISHED ONLY) */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-zinc-900">Buku Raport Resmi Diterbitkan</h2>
          </div>
          <span className="text-xs text-zinc-500">
            {academic.publishedReportCards.length} buku raport
          </span>
        </div>

        {academic.publishedReportCards.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada buku raport resmi yang diterbitkan untuk santri ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {academic.publishedReportCards.map((report) => (
              <div
                key={report.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-stone-50/50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">
                      Tahun Ajaran {report.academicYearName}
                    </span>
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                      Semester {report.semester === "ODD" ? "Ganjil" : "Genap"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Resmi
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    Kelas: <strong>{report.classroomName}</strong>
                  </p>
                  {report.publishedAt && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      Diterbitkan pada:{" "}
                      {new Date(report.publishedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  <Link
                    href={`/wali/akademik/raport/${report.id}${studentQuery}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-900 transition touch-target min-h-[44px]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Lihat & Cetak Raport</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Rekap Nilai Penilaian (Harian, Kuis, UTS, UAS) */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-zinc-700" />
            <h2 className="text-sm font-bold text-zinc-900">Rekap Nilai Penilaian Terpublikasi</h2>
          </div>
          <span className="text-xs text-zinc-500">{academic.recentScores.length} data</span>
        </div>

        {academic.recentScores.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada nilai penilaian terpublikasi untuk santri ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {academic.recentScores.map((score) => (
              <div
                key={score.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-stone-50/50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">
                      {score.subjectName}
                    </span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                      {score.assessmentType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 font-medium">
                    {score.assessmentTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    Tanggal: {new Date(score.date).toLocaleDateString("id-ID")}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="text-[11px] text-zinc-400 block">Skor Diperoleh:</span>
                  <div className="flex items-baseline gap-1 sm:justify-end">
                    <span className="text-lg font-bold text-teal-800">{score.score}</span>
                    <span className="text-xs text-zinc-400">/ {score.maxScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
