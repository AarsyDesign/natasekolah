"use client";

import { useState, useEffect, useTransition, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import {
  getDormitoryAction,
  assignStudentToRoomAction,
  endDormitoryAssignmentAction,
  createDormitoryRoomAction,
} from "@/actions/dormitory";
import { getStudentsAction } from "@/actions/academic";
import { createLivingAttendanceSessionAction } from "@/actions/attendance";
import {
  Home,
  ArrowLeft,
  Plus,
  DoorOpen,
  UserPlus,
  UserMinus,
  RefreshCw,
  ClipboardCheck,
  X,
  Users,
} from "lucide-react";

export default function DormitoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [dormitory, setDormitory] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Tempatkan Santri
  const [modalAssignOpen, setModalAssignOpen] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignNotes, setAssignNotes] = useState("");

  // Modal Tambah Kamar
  const [modalRoomOpen, setModalRoomOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState<number | "">(8);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [dormRes, stRes] = await Promise.all([
        getDormitoryAction(id),
        getStudentsAction({ pageSize: 100 }),
      ]);

      if (dormRes.success && dormRes.data) {
        setDormitory(dormRes.data);
      }
      if (stRes.success && stRes.data) {
        setStudents(stRes.data.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const res = await assignStudentToRoomAction({
        studentId: selectedStudentId,
        roomId: targetRoomId,
        startDate: new Date(startDate),
        notes: assignNotes.trim() || undefined,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal menempatkan santri ke kamar.", type: "error" });
      } else {
        setMessage({ text: "Santri berhasil ditempatkan di kamar!", type: "success" });
        setModalAssignOpen(false);
        setSelectedStudentId("");
        setAssignNotes("");
        loadData();
      }
    });
  };

  const handleEndAssignment = async (assignmentId: string, studentName: string) => {
    if (!confirm(`Akhiri penempatan kamar untuk ${studentName}?`)) return;

    startTransition(async () => {
      const res = await endDormitoryAssignmentAction({
        assignmentId,
        endDate: new Date(),
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal mengakhiri penempatan kamar.", type: "error" });
      } else {
        setMessage({ text: `Penempatan ${studentName} berhasil diakhiri.`, type: "success" });
        loadData();
      }
    });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const res = await createDormitoryRoomAction({
        dormitoryId: id,
        name: roomName.trim(),
        capacity: Number(roomCapacity),
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal membuat kamar.", type: "error" });
      } else {
        setMessage({ text: "Kamar asrama berhasil ditambahkan!", type: "success" });
        setModalRoomOpen(false);
        setRoomName("");
        loadData();
      }
    });
  };

  const handleOpenAttendance = async (roomId: string, roomName: string) => {
    startTransition(async () => {
      const res = await createLivingAttendanceSessionAction({
        dormitoryRoomId: roomId,
        attendanceDate: new Date(),
      });

      if (res.success) {
        router.push("/attendance");
      } else {
        setMessage({
          text: res.error || `Sesi absensi untuk ${roomName} gagal dibuka (mungkin sudah dibuka hari ini).`,
          type: "error",
        });
      }
    });
  };

  // Find students who already have active assignments in this dormitory
  const occupiedStudentIds = new Set<string>();
  dormitory?.rooms?.forEach((r: any) => {
    r.assignments?.forEach((a: any) => {
      occupiedStudentIds.add(a.studentId);
    });
  });

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Pesantren & Tahfidz" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/dormitories"
            className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Kompleks Asrama</span>
          </Link>

          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => setModalRoomOpen(true)}
              className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Kamar</span>
            </button>

            <button
              onClick={() => startTransition(loadData)}
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white p-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
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

        {/* Dormitory Detail Card */}
        <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-2xs font-bold ${
                    dormitory?.gender === "L"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {dormitory?.gender === "L" ? "Asrama Putra" : "Asrama Putri"}
                </span>
                <span className="text-2xs text-stone-400">
                  Total {dormitory?.rooms?.length || 0} Kamar
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
                {dormitory?.name || "Memuat asrama..."}
              </h1>
              {dormitory?.description && (
                <p className="mt-1 text-sm text-stone-600">{dormitory.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">Daftar Kamar & Penghuni</h2>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-stone-200 bg-white">
              <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
            </div>
          ) : !dormitory?.rooms || dormitory.rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <DoorOpen className="mx-auto h-12 w-12 text-stone-400" />
              <h3 className="mt-3 text-base font-bold text-stone-900">Belum ada kamar</h3>
              <p className="mt-1 text-xs text-stone-500">
                Tambahkan kamar pertama untuk gedung asrama ini.
              </p>
              <button
                onClick={() => setModalRoomOpen(true)}
                className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Kamar Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {dormitory.rooms.map((room: any) => {
                const occupants = room.assignments || [];
                const isFull = occupants.length >= room.capacity;

                return (
                  <div
                    key={room.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs"
                  >
                    <div>
                      {/* Room Header */}
                      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-teal-800">
                            <DoorOpen className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-stone-900">{room.name}</h3>
                            <span className="text-2xs text-stone-500">
                              Kapasitas: {occupants.length} / {room.capacity} santri
                            </span>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-2xs font-bold ${
                            isFull
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isFull ? "Penuh" : "Tersedia"}
                        </span>
                      </div>

                      {/* Occupants List */}
                      <div className="mt-4">
                        <span className="text-2xs font-bold uppercase tracking-wider text-stone-400">
                          Penghuni Aktif ({occupants.length})
                        </span>

                        {occupants.length === 0 ? (
                          <p className="mt-2 text-xs italic text-stone-400">
                            Kamar ini belum memiliki penghuni santri.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {occupants.map((occ: any) => (
                              <div
                                key={occ.id}
                                className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs border border-stone-200/60"
                              >
                                <div>
                                  <span className="font-semibold text-stone-900">
                                    {occ.student.fullName}
                                  </span>
                                  <span className="ml-2 font-mono text-2xs text-stone-500">
                                    {occ.student.nis}
                                  </span>
                                  {occ.notes && (
                                    <span className="block text-2xs italic text-stone-400">
                                      {occ.notes}
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleEndAssignment(occ.id, occ.student.fullName)}
                                  className="touch-target rounded p-1 text-stone-400 hover:text-rose-600 transition"
                                  title="Akhiri penempatan kamar santri ini"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Room Actions */}
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                      <button
                        onClick={() => {
                          setTargetRoomId(room.id);
                          setModalAssignOpen(true);
                        }}
                        disabled={isFull}
                        className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 disabled:opacity-40"
                      >
                        <UserPlus className="h-4 w-4 text-stone-600" />
                        <span>Tempatkan Santri</span>
                      </button>

                      <button
                        onClick={() => handleOpenAttendance(room.id, room.name)}
                        disabled={occupants.length === 0}
                        className="touch-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-40"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        <span>Buka Absensi Asrama</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Tempatkan Santri */}
      {modalAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Tempatkan Santri ke Kamar</h3>
              <button
                onClick={() => setModalAssignOpen(false)}
                className="touch-target rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignStudent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Pilih Santri</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="">-- Pilih Santri --</option>
                  {students
                    .filter((s) => !occupiedStudentIds.has(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.nis})
                      </option>
                    ))}
                </select>
                <span className="mt-1 block text-2xs text-stone-400">
                  Hanya menampilkan santri yang belum memiliki kamar aktif di gedung ini.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Tanggal Mulai Menghuni</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Catatan / Posisi Ranjang</label>
                <input
                  type="text"
                  placeholder="Contoh: Ranjang atas no 2..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAssignOpen(false)}
                  className="touch-target rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedStudentId}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Tempatkan Sekarang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Kamar */}
      {modalRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Tambah Kamar Asrama Baru</h3>
              <button
                onClick={() => setModalRoomOpen(false)}
                className="touch-target rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Nama / Nomor Kamar</label>
                <input
                  type="text"
                  placeholder="Contoh: Kamar 101, Kobong Al-Fath..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Kapasitas Maksimal Santri</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(Number(e.target.value))}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalRoomOpen(false)}
                  className="touch-target rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Kamar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
