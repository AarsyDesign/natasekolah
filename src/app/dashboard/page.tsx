import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  School,
  Users,
} from "lucide-react";
import { NavHeader } from "../../components/nav-header";
import { getDashboardSnapshotAction } from "../../actions/dashboard";

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("id-ID").format(value);
}

function attendanceLabel(status: "NOT_STARTED" | "OPEN" | "CLOSED") {
  if (status === "OPEN") return "Terbuka";
  if (status === "CLOSED") return "Selesai";
  return "Belum mulai";
}

function attendanceClass(status: "NOT_STARTED" | "OPEN" | "CLOSED") {
  if (status === "OPEN") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "CLOSED") return "border-teal-200 bg-teal-50 text-teal-800";
  return "border-stone-200 bg-stone-50 text-stone-600";
}

export default async function DashboardPage() {
  const result = await getDashboardSnapshotAction();

  if (!result.success || !result.data) {
    return (
      <div className="min-h-screen bg-stone-100/60 text-stone-900">
        <NavHeader subtitle="Dashboard Operasional" />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            {result.error || "Dashboard tidak dapat dimuat."}
          </div>
        </main>
      </div>
    );
  }

  const { institution, today, activeAcademicYear, counts, dataQuality, attendance } = result.data;

  const actionLinks = [
    { href: "/attendance", label: "Buka Presensi", description: "Catat kehadiran hari ini.", icon: ClipboardCheck, visible: attendance.visible },
    { href: "/students", label: "Buku Induk", description: "Cari atau kelola data siswa.", icon: Users, visible: counts.activeStudents !== null },
    { href: "/teacher-assignments", label: "Penugasan Mengajar", description: "Periksa guru, mapel, dan rombel.", icon: GraduationCap, visible: counts.activeSubjects !== null },
    { href: "/academic-years", label: "Tahun Ajaran", description: "Periksa tahun ajaran aktif.", icon: CalendarDays, visible: counts.activeSubjects !== null },
  ].filter((action) => action.visible);

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16 text-stone-900">
      <NavHeader subtitle="Dashboard Operasional" />
      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <LayoutDashboard className="h-3.5 w-3.5" /> OPERASIONAL
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900">{institution.name}</h1>
              <p className="mt-1 text-sm text-stone-600">
                Hari ini {today}{activeAcademicYear ? ` • Tahun ajaran ${activeAcademicYear.name}` : " • Belum ada tahun ajaran aktif"}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Fokus</p>
              <p className="mt-1 text-sm font-semibold text-stone-900">Apa yang perlu dilakukan hari ini?</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Siswa Aktif" value={formatNumber(counts.activeStudents)} icon={Users} />
            <MetricCard label="Guru Aktif" value={formatNumber(counts.activeTeachers)} icon={GraduationCap} />
            <MetricCard label="Rombel Aktif" value={formatNumber(counts.activeClassrooms)} icon={School} />
            <MetricCard label="Mapel Aktif" value={formatNumber(counts.activeSubjects)} icon={BookOpen} />
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Perlu Perhatian</h2>
                <p className="mt-1 text-sm text-stone-500">Indikator operasional yang bisa ditindaklanjuti.</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>

            <div className="mt-4 space-y-3">
              {!activeAcademicYear && (
                <ActionAlert
                  title="Belum ada tahun ajaran aktif"
                  description="Aktifkan satu tahun ajaran sebelum presensi dan operasional akademik berjalan."
                  href="/academic-years"
                />
              )}

              {activeAcademicYear && dataQuality.activeStudentsWithoutEnrollment !== null && dataQuality.activeStudentsWithoutEnrollment > 0 && (
                <ActionAlert
                  title={`${formatNumber(dataQuality.activeStudentsWithoutEnrollment)} siswa belum punya enrollment aktif`}
                  description="Siswa aktif belum ditempatkan pada tahun ajaran aktif."
                  href="/students"
                />
              )}

              {attendance.visible && attendance.sessionsOpen > 0 && (
                <ActionAlert
                  title={`${formatNumber(attendance.sessionsOpen)} sesi presensi masih terbuka`}
                  description="Selesaikan sesi yang sedang dikerjakan agar histori presensi terkunci."
                  href="/attendance"
                />
              )}

              {activeAcademicYear && attendance.visible && attendance.sessionsNotStarted > 0 && (
                <ActionAlert
                  title={`${formatNumber(attendance.sessionsNotStarted)} penugasan belum memiliki sesi hari ini`}
                  description="Periksa hanya bila penugasan tersebut memang perlu melakukan presensi hari ini."
                  href="/attendance"
                />
              )}

              {(activeAcademicYear || !attendance.visible) &&
                (!dataQuality.activeStudentsWithoutEnrollment || dataQuality.activeStudentsWithoutEnrollment === 0) &&
                attendance.sessionsOpen === 0 &&
                attendance.sessionsNotStarted === 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                    <div>
                      <p className="text-sm font-semibold text-teal-900">Tidak ada indikator perhatian dari data saat ini.</p>
                      <p className="mt-0.5 text-xs text-teal-800">Dashboard hanya menyoroti kondisi operasional yang terdeteksi.</p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Aksi Cepat</h2>
              <p className="mt-1 text-sm text-stone-500">Workflow yang tersedia untuk akun ini.</p>
            </div>

            <div className="mt-4 space-y-2">
              {actionLinks.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 transition hover:bg-stone-100"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-800 shadow-xs"><Icon className="h-4 w-4" /></span>
                      <span>
                        <span className="block text-sm font-semibold text-stone-900">{action.label}</span>
                        <span className="block text-xs text-stone-500">{action.description}</span>
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-stone-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {attendance.visible && (
          <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Presensi Hari Ini</h2>
                <p className="mt-1 text-sm text-stone-500">{formatNumber(attendance.assignmentsToday)} penugasan dalam cakupan akun.</p>
              </div>
              <Link href="/attendance" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
                Buka presensi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {attendance.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  Belum ada penugasan pada tahun ajaran aktif yang masuk cakupan akun ini.
                </div>
              ) : (
                <div className="min-w-[640px] divide-y divide-stone-100">
                  {attendance.items.map((item) => (
                    <div key={item.assignmentId} className="flex items-center gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{item.classroomName} • {item.subjectName}</p>
                        <p className="truncate text-xs text-stone-500">{item.teacherName}{item.recordCount > 0 ? ` • ${item.recordCount} catatan` : ""}</p>
                      </div>
                      <span className={"shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold " + attendanceClass(item.status)}>
                        {attendanceLabel(item.status)}
                      </span>
                      {item.sessionId && item.status === "OPEN" ? (
                        <Link href="/attendance" className="text-xs font-semibold text-teal-800 hover:underline">Lanjut</Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-500">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
            <p>Dashboard ini hanya membaca data yang sudah ada. Tidak ada mutasi database dari halaman dashboard, dan tenant selalu berasal dari session server.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5">
      <div className="flex items-center gap-2 text-stone-500"><Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span></div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">{value}</p>
    </div>
  );
}

function ActionAlert({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100/70">
      <p className="text-sm font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">{description}</p>
    </Link>
  );
}
