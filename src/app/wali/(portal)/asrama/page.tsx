import React from "react";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentDormitory } from "../../../../lib/guardian/portal-service";
import { Home, Users, Calendar, CheckCircle2, AlertCircle, Clock, Info } from "lucide-react";

export default async function GuardianDormitoryPage({
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

  const dormitory = await getGuardianStudentDormitory({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          Kehidupan Asrama & Kedisiplinan
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Informasi penempatan kamar asrama dan presensi malam untuk santri {activeChild.student.fullName}.
        </p>
      </div>

      {!dormitory.isResident || !dormitory.assignment ? (
        /* Empty State untuk Santri Non-Mukim */
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <Home className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-zinc-900">Bukan Santri Mukim</h2>
          <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Santri berstatus santri pulang-pergi (non-mukim) atau belum memiliki penempatan kamar asrama aktif pada periode berjalan.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-zinc-600">
            <Info className="h-3.5 w-3.5" />
            <span>Jika santri sebenarnya mukim di asrama, hubungi pamong asrama sekolah.</span>
          </div>
        </div>
      ) : (
        /* Data Penempatan Kamar Aktif */
        <>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Penempatan Asrama Aktif
                </span>
                <h2 className="mt-2 text-xl font-bold text-zinc-900">
                  {dormitory.assignment.dormitoryName} — Kamar {dormitory.assignment.roomName}
                </h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  <span>
                    Masuk sejak: {new Date(dormitory.assignment.startDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3.5 text-right sm:min-w-[160px]">
                <span className="text-[11px] text-zinc-400 block">Kapasitas Penghuni</span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <Users className="h-4 w-4 text-teal-700" />
                  <span className="text-base font-bold text-zinc-900">
                    {dormitory.assignment.currentOccupants} / {dormitory.assignment.capacity}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Santri terdaftar di kamar</span>
              </div>
            </div>
          </div>

          {/* Log Presensi Malam Asrama */}
          <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900">Log Presensi Malam / Asrama</h2>
              <span className="text-xs text-zinc-500">
                {dormitory.recentLivingAttendance.length} rekaman
              </span>
            </div>

            {dormitory.recentLivingAttendance.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 italic">
                Belum ada rekaman presensi asrama untuk santri ini.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {dormitory.recentLivingAttendance.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 flex items-center justify-between hover:bg-stone-50/50 transition"
                  >
                    <div>
                      <span className="text-xs font-bold text-zinc-900">
                        {new Date(rec.date).toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {rec.note && (
                        <p className="mt-0.5 text-xs text-zinc-500 italic">
                          Catatan: &ldquo;{rec.note}&rdquo;
                        </p>
                      )}
                    </div>

                    <div>
                      {rec.status === "PRESENT" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Hadir di Kamar
                        </span>
                      ) : rec.status === "SICK" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                          <Clock className="h-3 w-3" />
                          Sakit di UKS / Kamar
                        </span>
                      ) : rec.status === "EXCUSED" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                          <Info className="h-3 w-3" />
                          Izin Pulang (Tasrih)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
                          <AlertCircle className="h-3 w-3" />
                          Alpa
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
