import React from "react";
import Link from "next/link";
import { getAuthenticatedGuardianSession } from "../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentOverview } from "../../../lib/guardian/portal-service";
import {
  ClipboardCheck,
  CreditCard,
  Award,
  BookMarked,
  Home,
  ArrowRight,
  AlertCircle,
  Calendar,
  School,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

export default async function GuardianDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId } = await searchParams;
  const auth = await getAuthenticatedGuardianSession();
  const profile = await getGuardianProfile(auth.guardian.id, auth.institution.id);

  if (profile.children.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs my-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Info className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-base font-bold text-zinc-900">Belum Ada Santri Terhubung</h2>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
          Akun wali Anda belum dikaitkan dengan data santri manapun. Silakan hubungi bagian tata usaha {profile.institution.name} untuk menghubungkan data santri Anda.
        </p>
      </div>
    );
  }

  // Pilih santri aktif dengan validasi ketat
  const targetStudentId =
    studentId && profile.children.some((c) => c.student.id === studentId)
      ? studentId
      : profile.children[0].student.id;

  const overview = await getGuardianStudentOverview({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  const studentQuery = `?studentId=${overview.student.id}`;
  const classroomName = overview.activeEnrollment?.classroom.name || "Belum ada rombel";
  const academicYearName = overview.activeEnrollment?.academicYear.name || "-";

  return (
    <div className="space-y-6">
      {/* 1. Header Santri Aktif */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                Santri Binaan ({overview.relationship})
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs text-zinc-500">NIS: {overview.student.nis}</span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              {overview.student.fullName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <School className="h-3.5 w-3.5 text-zinc-400" />
                <span>Kelas: <strong>{classroomName}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Tahun Ajaran: <strong>{academicYearName}</strong></span>
              </span>
            </div>
          </div>

          <div className="sm:text-right shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100">
            <span className="text-[11px] font-medium text-zinc-400 block">Status Santri</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Aktif Belajar
            </span>
          </div>
        </div>
      </div>

      {/* Grid Ringkasan Operasional 2 Kolom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 2. Kehadiran Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900">Kehadiran</h2>
              </div>
              <Link
                href={`/wali/kehadiran${studentQuery}`}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 touch-target min-h-[44px]"
              >
                <span>Detail</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-2xl font-bold text-zinc-900">
                  {overview.attendance.attendanceRate}%
                </span>
                <span className="text-xs text-zinc-500 ml-1.5">Tingkat Kehadiran</span>
              </div>
              <span className="text-xs font-medium text-zinc-500">
                {overview.attendance.presentCount} dari {overview.attendance.totalSessions} sesi
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-blue-50/60 p-2">
                <span className="block text-[11px] text-blue-700">Sakit</span>
                <span className="text-sm font-bold text-blue-800">{overview.attendance.sickCount}</span>
              </div>
              <div className="rounded-lg bg-amber-50/60 p-2">
                <span className="block text-[11px] text-amber-700">Izin</span>
                <span className="text-sm font-bold text-amber-800">{overview.attendance.excusedCount}</span>
              </div>
              <div className="rounded-lg bg-red-50/60 p-2">
                <span className="block text-[11px] text-red-700">Alpa</span>
                <span className="text-sm font-bold text-red-800">{overview.attendance.absentCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100">
            {overview.attendance.recentRecords.length > 0 ? (
              <p className="text-xs text-zinc-500 truncate">
                Presensi terakhir:{" "}
                <span className="font-medium text-zinc-800">
                  {overview.attendance.recentRecords[0].status === "PRESENT"
                    ? "Hadir"
                    : overview.attendance.recentRecords[0].status}
                </span>{" "}
                ({new Date(overview.attendance.recentRecords[0].date).toLocaleDateString("id-ID")})
              </p>
            ) : (
              <p className="text-xs text-zinc-400 italic">Belum ada rekaman sesi presensi.</p>
            )}
          </div>
        </div>

        {/* 3. Keuangan Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <CreditCard className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900">Keuangan & Tagihan</h2>
              </div>
              <Link
                href={`/wali/keuangan${studentQuery}`}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 touch-target min-h-[44px]"
              >
                <span>Rincian</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4 border-b border-stone-100 pb-3">
              <span className="text-xs text-zinc-500 block">Sisa Kewajiban Tagihan:</span>
              <span className="text-2xl font-bold text-zinc-900">
                Rp {overview.finance.totalUnpaidAmount.toLocaleString("id-ID")}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-500">
                {overview.finance.unpaidChargesCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{overview.finance.unpaidChargesCount} tagihan belum lunas</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Seluruh kewajiban lunas</span>
                  </span>
                )}
              </span>
              <span className="text-zinc-400">
                Total Terbayar: Rp {overview.finance.totalPaidAmount.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100">
            {overview.finance.recentTransactions.length > 0 ? (
              <p className="text-xs text-zinc-500 truncate">
                Pembayaran terakhir:{" "}
                <span className="font-medium text-zinc-800">
                  Rp {overview.finance.recentTransactions[0].totalAmount.toLocaleString("id-ID")}
                </span>{" "}
                ({new Date(overview.finance.recentTransactions[0].date).toLocaleDateString("id-ID")})
              </p>
            ) : (
              <p className="text-xs text-zinc-400 italic">Belum ada riwayat transaksi pembayaran.</p>
            )}
          </div>
        </div>

        {/* 4. Akademik / Raport Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Award className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900">Akademik & Raport</h2>
              </div>
              <Link
                href={`/wali/akademik${studentQuery}`}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 touch-target min-h-[44px]"
              >
                <span>Lihat Nilai</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4">
              {overview.academic.latestPublishedReportCard ? (
                <div className="rounded-xl bg-teal-50/50 border border-teal-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-900">
                      Raport Resmi ({overview.academic.latestPublishedReportCard.semester === "ODD" ? "Ganjil" : "Genap"})
                    </span>
                    <span className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Rilis Resmi
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs text-zinc-600">Nilai Rata-rata:</span>
                    <span className="text-lg font-bold text-teal-900">
                      {overview.academic.latestPublishedReportCard.averageScore}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-1">
                    {overview.academic.latestPublishedReportCard.totalSubjects} Mata Pelajaran
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3.5 text-center">
                  <p className="text-xs font-medium text-zinc-700">Belum Ada Raport Terbit</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Raport resmi akan tampil otomatis setelah guru dan kepala sekolah menerbitkan buku raport.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Nilai Harian/UTS Terbaru:</span>
            <span className="font-semibold text-zinc-800">
              {overview.academic.recentScores.length} data nilai
            </span>
          </div>
        </div>

        {/* 5. Tahfidz Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <BookMarked className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900">Mutaba&apos;ah Tahfidz</h2>
              </div>
              <Link
                href={`/wali/tahfidz${studentQuery}`}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 touch-target min-h-[44px]"
              >
                <span>Hafalan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-2xl font-bold text-zinc-900">
                  {overview.tahfidz.totalZiyadahAyat}
                </span>
                <span className="text-xs text-zinc-500 ml-1.5">Ayat Ziyadah</span>
              </div>
              <span className="text-xs font-medium text-zinc-500">
                {overview.tahfidz.totalMurajaahAyat} Ayat Muraja&apos;ah
              </span>
            </div>

            <div className="mt-3">
              {overview.tahfidz.lastRecord ? (
                <div className="text-xs">
                  <span className="text-zinc-500 block">Setoran Terakhir:</span>
                  <div className="mt-1 flex items-center justify-between rounded-lg bg-stone-50 p-2.5">
                    <span className="font-semibold text-zinc-800">
                      {overview.tahfidz.lastRecord.surahName} (Ayat {overview.tahfidz.lastRecord.startAyah} - {overview.tahfidz.lastRecord.endAyah})
                    </span>
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                      {overview.tahfidz.lastRecord.type}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic py-2">Belum ada rekaman setoran tahfidz.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Total Catatan Setoran:</span>
            <span className="font-semibold text-zinc-800">{overview.tahfidz.totalRecords} kali</span>
          </div>
        </div>
      </div>

      {/* 6. Asrama (Living) Section */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800">
              <Home className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Kehidupan Asrama (Living)</h2>
              <p className="text-xs text-zinc-500">Penempatan kamar dan kedisiplinan malam santri</p>
            </div>
          </div>
          {overview.dormitory.isResident && (
            <Link
              href={`/wali/asrama${studentQuery}`}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 touch-target min-h-[44px]"
            >
              <span>Detail Kamar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-4">
          {overview.dormitory.isResident && overview.dormitory.assignment ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-stone-50 border border-stone-200 p-4">
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  {overview.dormitory.assignment.dormitoryName} — Kamar {overview.dormitory.assignment.roomName}
                </span>
                <span className="block text-xs text-zinc-500 mt-0.5">
                  Kapasitas: {overview.dormitory.assignment.currentOccupants} / {overview.dormitory.assignment.capacity} Santri
                </span>
              </div>
              <div className="text-xs">
                <span className="text-zinc-500 block sm:text-right">Absensi Asrama Terakhir:</span>
                <span className="font-semibold text-emerald-700 sm:text-right block">
                  {overview.dormitory.recentLivingAttendance[0]
                    ? `${overview.dormitory.recentLivingAttendance[0].status} (${new Date(overview.dormitory.recentLivingAttendance[0].date).toLocaleDateString("id-ID")})`
                    : "Belum tercatat"}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 text-center">
              <p className="text-xs text-zinc-600">
                Santri berstatus santri pulang-pergi (non-mukim) atau belum memiliki penempatan kamar asrama aktif.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
