import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedGuardianSession } from "../../../../../../lib/guardian/auth-helper";
import {
  getGuardianProfile,
  getGuardianStudentReportCard,
  GuardianResourceNotFoundError,
} from "../../../../../../lib/guardian/portal-service";
import { GuardianAccessDeniedError } from "../../../../../../lib/auth/guardian-guard";
import { ArrowLeft, Printer, Award, ShieldCheck, AlertCircle } from "lucide-react";

export default async function GuardianReportCardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { reportId } = await params;
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

  let snapshot;
  let accessError: string | null = null;

  try {
    snapshot = await getGuardianStudentReportCard({
      sessionGuardianId: auth.guardian.id,
      sessionInstitutionId: auth.institution.id,
      requestedStudentId: targetStudentId,
      reportCardId: reportId,
    });
  } catch (err: unknown) {
    if (err instanceof GuardianResourceNotFoundError) {
      notFound();
    }
    if (err instanceof GuardianAccessDeniedError) {
      accessError = err.message;
    } else {
      accessError = "Gagal memuat dokumen raport resmi.";
    }
  }

  const studentQuery = `?studentId=${targetStudentId}`;

  if (accessError || !snapshot) {
    return (
      <div className="space-y-4">
        <Link
          href={`/wali/akademik${studentQuery}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 touch-target min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Halaman Akademik</span>
        </Link>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center my-6">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600 mb-2" />
          <h2 className="text-base font-bold text-red-900">Akses Raport Ditolak</h2>
          <p className="mt-1 text-xs text-red-700 max-w-md mx-auto leading-relaxed">
            {accessError || "Buku raport belum berstatus terbit atau bukan milik santri asuh Anda."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/wali/akademik${studentQuery}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 touch-target min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Akademik</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-900 transition touch-target min-h-[44px]"
        >
          <Printer className="h-4 w-4" />
          <span>Cetak Raport Resmi</span>
        </button>
      </div>

      {/* Official Frozen Report Card View */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-10 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header Lembaga & Raport */}
        <div className="border-b-2 border-stone-900 pb-5 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-teal-800 block">
            {profile.institution.name}
          </span>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold uppercase tracking-tight text-zinc-900">
            Laporan Hasil Belajar Peserta Didik
          </h1>
          <p className="mt-1 text-xs text-zinc-600">
            Semester {snapshot.semester === "ODD" ? "Ganjil" : "Genap"} Tahun Ajaran {snapshot.academicYear.name}
          </p>
        </div>

        {/* Student & Class Meta */}
        <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex">
              <span className="w-28 text-zinc-500">Nama Santri</span>
              <span className="font-bold text-zinc-900">: {snapshot.student.fullName}</span>
            </div>
            <div className="flex">
              <span className="w-28 text-zinc-500">NIS / NISN</span>
              <span className="text-zinc-800">: {snapshot.student.nis} / {snapshot.student.nisn || "-"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex">
              <span className="w-28 text-zinc-500">Rombongan Belajar</span>
              <span className="font-bold text-zinc-900">: {snapshot.classroom.name}</span>
            </div>
            <div className="flex">
              <span className="w-28 text-zinc-500">Jenis Kelamin</span>
              <span className="text-zinc-800">: {snapshot.student.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
            </div>
          </div>
        </div>

        {/* Table of Subjects & Grades */}
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 text-zinc-800 border-b border-stone-200 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center">No</th>
                <th className="py-2.5 px-3">Mata Pelajaran</th>
                <th className="py-2.5 px-3 w-20 text-center">Nilai Akhir</th>
                <th className="py-2.5 px-3 w-16 text-center">Predikat</th>
                <th className="py-2.5 px-3">Capaian Kompetensi / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-zinc-700">
              {snapshot.subjects.map((sub, idx) => (
                <tr key={sub.subjectId} className="hover:bg-stone-50/50">
                  <td className="py-2.5 px-3 text-center text-zinc-500">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-zinc-900">
                    {sub.subjectName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-zinc-900">
                    {sub.finalScore}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-teal-800">
                    {sub.letterGrade || "-"}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-600 text-[11px] leading-relaxed">
                    {sub.comments || "Menunjukkan penguasaan materi yang baik sesuai standar capaian pembelajaran."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Attendance Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-stone-200 p-4">
            <h3 className="text-xs font-bold text-zinc-900 mb-2">Rekap Ketidakhadiran</h3>
            <div className="space-y-1 text-xs text-zinc-700">
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span>Sakit</span>
                <span className="font-semibold">{snapshot.attendance.sick} hari</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span>Izin</span>
                <span className="font-semibold">{snapshot.attendance.excused} hari</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Tanpa Keterangan (Alpa)</span>
                <span className="font-semibold">{snapshot.attendance.absent} hari</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 p-4">
            <h3 className="text-xs font-bold text-zinc-900 mb-2">Catatan Perkembangan</h3>
            <p className="text-xs text-zinc-600 leading-relaxed italic">
              &ldquo;{snapshot.notes || "Pertahankan prestasi dan terus tingkatkan kedisiplinan belajar serta ibadah."}&rdquo;
            </p>
          </div>
        </div>

        {/* Frozen Document Verification Footer */}
        <div className="mt-8 pt-5 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5 text-teal-800 font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Dokumen Resmi Terverifikasi Sistem (Frozen Data Snapshot)</span>
          </div>
          <span>
            Dibekukan pada: {new Date(snapshot.frozenAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
