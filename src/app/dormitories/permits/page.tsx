"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import {
  listPermitRequestsAction,
  createPermitRequestAction,
  approvePermitAction,
  rejectPermitAction,
  markPermitReturnedAction,
  markPermitOverdueAction,
} from "@/actions/permit";
import { listDormitoryAssignmentsAction } from "@/actions/dormitory";
import {
  ScrollText,
  Plus,
  RefreshCw,
  ArrowLeft,
  X,
  Check,
  Undo2,
  ClockAlert,
  Ban,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURNED: "Sudah Kembali",
  OVERDUE: "Terlambat",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  RETURNED: "bg-teal-50 text-teal-700 border-teal-200",
  OVERDUE: "bg-orange-50 text-orange-800 border-orange-300",
};

const TYPE_LABEL: Record<string, string> = {
  HOME_LEAVE: "Izin Pulang",
  SICK_LEAVE: "Izin Sakit",
  EXCUSED: "Izin Lainnya",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal Ajukan Izin
  const [modalOpen, setModalOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [permitType, setPermitType] = useState<"HOME_LEAVE" | "SICK_LEAVE" | "EXCUSED">(
    "HOME_LEAVE"
  );
  const [leaveAt, setLeaveAt] = useState("");
  const [returnAt, setReturnAt] = useState("");
  const [reason, setReason] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [resPermits, resAssignments] = await Promise.all([
        listPermitRequestsAction(filterStatus ? { status: filterStatus } : undefined),
        listDormitoryAssignmentsAction({ status: "ACTIVE" }),
      ]);
      if (resPermits.success && resPermits.data) {
        setPermits(resPermits.data);
      } else if (!resPermits.success) {
        setMessage({ text: resPermits.error || "Gagal memuat daftar izin.", type: "error" });
      }
      if (resAssignments.success && resAssignments.data) {
        setAssignments(resAssignments.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const res = await createPermitRequestAction({
        studentId,
        type: permitType,
        leaveAt: new Date(leaveAt).toISOString(),
        returnAt: returnAt ? new Date(returnAt).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal mengajukan izin.", type: "error" });
      } else {
        setMessage({ text: "Permohonan izin berhasil diajukan.", type: "success" });
        setModalOpen(false);
        setStudentId("");
        setReason("");
        setLeaveAt("");
        setReturnAt("");
        loadData();
      }
    });
  };

  const runAction = async (
    fn: (input: unknown) => Promise<{ success: boolean; error?: string }>,
    input: unknown,
    successText: string
  ) => {
    setMessage(null);
    startTransition(async () => {
      const res = await fn(input);
      if (!res.success) {
        setMessage({ text: res.error || "Operasi gagal.", type: "error" });
      } else {
        setMessage({ text: successText, type: "success" });
        loadData();
      }
    });
  };

  const studentOptions = assignments
    .map((a: any) => a.student)
    .filter((s: any) => s && s.id);

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Pesantren & Tahfidz" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <ScrollText className="h-4 w-4" />
              <span>Tasrih / Izin Pulang Santri</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Izin Pulang Santri
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Ajukan, setujui, dan lacak izin pulang santri mukim — siklus Menunggu →
              Disetujui/Ditolak → Sudah Kembali / Terlambat.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dormitories"
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Asrama</span>
            </Link>

            <button
              onClick={() => {
                setMessage(null);
                setModalOpen(true);
              }}
              className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Ajukan Izin</span>
            </button>

            <button
              onClick={() => startTransition(loadData)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white p-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50"
              title="Segarkan data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Feedback banner */}
        {message && (
          <div
            className={`mb-6 rounded-xl p-4 text-xs font-medium ${
              message.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filter status */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label htmlFor="status-filter" className="text-xs font-medium text-stone-600">
            Status
          </label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="touch-target rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 shadow-2xs"
          >
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-xs text-stone-500">{permits.length} data</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : permits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <ScrollText className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-700">
              Belum ada permohonan izin
            </p>
            <p className="mt-1 max-w-sm text-xs text-stone-500">
              Klik &quot;Ajukan Izin&quot; untuk mencatat tasrih santri yang ingin pulang.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {permits.map((p: any) => (
              <li
                key={p.id}
                className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900">
                        {p.student?.fullName || "-"}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_BADGE[p.status] || "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {TYPE_LABEL[p.type] || p.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      Berangkat: <span className="font-medium">{formatDateTime(p.leaveAt)}</span>
                      {" · "}Kembali:{" "}
                      <span className="font-medium">{formatDateTime(p.returnAt)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {p.academicYear?.name ? `${p.academicYear.name} · ` : ""}
                      Diajukan {formatDateTime(p.requestedAt)}
                      {p.approvedBy?.name ? ` · Disetujui ${p.approvedBy.name}` : ""}
                    </p>
                    {p.reason && (
                      <p className="mt-1 text-xs italic text-stone-500">&quot;{p.reason}&quot;</p>
                    )}
                    {p.notes && (
                      <p className="mt-0.5 text-xs text-stone-500">Catatan: {p.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {p.status === "PENDING" && (
                      <>
                        <button
                          onClick={() =>
                            runAction(
                              approvePermitAction,
                              { permitId: p.id },
                              "Izin disetujui — notifikasi ke wali diantre."
                            )
                          }
                          disabled={isPending}
                          className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Setujui
                        </button>
                        <button
                          onClick={() =>
                            runAction(
                              rejectPermitAction,
                              { permitId: p.id },
                              "Izin ditolak."
                            )
                          }
                          disabled={isPending}
                          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Tolak
                        </button>
                      </>
                    )}

                    {p.status === "APPROVED" && (
                      <>
                        <button
                          onClick={() =>
                            runAction(
                              markPermitReturnedAction,
                              { permitId: p.id },
                              "Santri ditandai sudah kembali."
                            )
                          }
                          disabled={isPending}
                          className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Sudah Kembali
                        </button>
                        <button
                          onClick={() =>
                            runAction(
                              markPermitOverdueAction,
                              { permitId: p.id },
                              "Izin ditandai terlambat kembali."
                            )
                          }
                          disabled={isPending}
                          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <ClockAlert className="h-3.5 w-3.5" />
                          Terlambat
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Modal Ajukan Izin */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Ajukan Izin Pulang</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="touch-target rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="permit-student" className="mb-1 block text-xs font-medium text-stone-700">
                  Santri (penghuni asrama aktif)
                </label>
                <select
                  id="permit-student"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <option value="">— Pilih santri —</option>
                  {studentOptions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.nis})
                    </option>
                  ))}
                </select>
                {studentOptions.length === 0 && (
                  <p className="mt-1 text-xs text-rose-600">
                    Tidak ada santri dengan penempatan kamar aktif.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="permit-type" className="mb-1 block text-xs font-medium text-stone-700">
                  Jenis izin
                </label>
                <select
                  id="permit-type"
                  value={permitType}
                  onChange={(e) => setPermitType(e.target.value as typeof permitType)}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  <option value="HOME_LEAVE">Izin Pulang</option>
                  <option value="SICK_LEAVE">Izin Sakit</option>
                  <option value="EXCUSED">Izin Lainnya</option>
                </select>
              </div>

              <div>
                <label htmlFor="permit-leave" className="mb-1 block text-xs font-medium text-stone-700">
                  Waktu berangkat
                </label>
                <input
                  id="permit-leave"
                  type="datetime-local"
                  required
                  value={leaveAt}
                  onChange={(e) => setLeaveAt(e.target.value)}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>

              <div>
                <label htmlFor="permit-return" className="mb-1 block text-xs font-medium text-stone-700">
                  Waktu kembali (opsional)
                </label>
                <input
                  id="permit-return"
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>

              <div>
                <label htmlFor="permit-reason" className="mb-1 block text-xs font-medium text-stone-700">
                  Alasan (opsional)
                </label>
                <textarea
                  id="permit-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Contoh: pulang menengok orang tua di Cirebon"
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="touch-target rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !studentId || !leaveAt}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Mengajukan..." : "Ajukan Izin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
