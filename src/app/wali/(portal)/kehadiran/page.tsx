import React from "react";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentAttendance } from "../../../../lib/guardian/portal-service";
import { ClipboardCheck, Calendar, Filter, CheckCircle2, AlertCircle, Info, Clock } from "lucide-react";

export default async function GuardianAttendancePage({
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

  const attendance = await getGuardianStudentAttendance({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PRESENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Hadir
          </span>
        );
      case "SICK":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" />
            Sakit
          </span>
        );
      case "EXCUSED":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Info className="h-3 w-3" />
            Izin
          </span>
        );
      case "ABSENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
            <AlertCircle className="h-3 w-3" />
            Alpa
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Riwayat Kehadiran Santri
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Catatan presensi harian kelas dan kedisiplinan asrama untuk {activeChild.student.fullName}.
        </p>
      </div>

      {/* Kartu Statistik Kehadiran */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-zinc-500">Tingkat Hadir</span>
          <span className="mt-1 block text-2xl font-bold text-teal-800">
            {attendance.attendanceRate}%
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">
            {attendance.presentCount} dari {attendance.totalSessions} sesi
          </span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-blue-700">Sakit</span>
          <span className="mt-1 block text-2xl font-bold text-blue-900">
            {attendance.sickCount}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Surat dokter / izin</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-amber-700">Izin</span>
          <span className="mt-1 block text-2xl font-bold text-amber-900">
            {attendance.excusedCount}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Izin orang tua / tasrih</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <span className="block text-xs text-red-700">Alpa</span>
          <span className="mt-1 block text-2xl font-bold text-red-900">
            {attendance.absentCount}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">Tanpa keterangan</span>
        </div>
      </div>

      {/* Roster Riwayat Presensi (Mobile Cards & Desktop Table) */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900">Log Presensi Terbaru</h2>
          <span className="text-xs text-zinc-500">{attendance.recentRecords.length} rekaman</span>
        </div>

        {attendance.recentRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada rekaman kehadiran untuk santri ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {attendance.recentRecords.map((record) => (
              <div
                key={record.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-stone-50/50 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">
                      {new Date(record.date).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                      {record.context === "ACADEMIC" ? "Akademik / Kelas" : "Asrama / Living"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {record.subjectName
                      ? `Mata Pelajaran: ${record.subjectName}`
                      : record.roomName
                      ? `Kamar Asrama: ${record.roomName}`
                      : "Presensi Umum"}
                  </p>
                  {record.note && (
                    <p className="mt-1 text-xs text-zinc-500 italic bg-stone-50 rounded-md p-1.5 border border-stone-200/60 inline-block">
                      Catatan: &ldquo;{record.note}&rdquo;
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {getStatusBadge(record.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
