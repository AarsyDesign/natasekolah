"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import {
  listDormitoriesAction,
  createDormitoryAction,
  createDormitoryRoomAction,
} from "@/actions/dormitory";
import {
  Home,
  Plus,
  RefreshCw,
  DoorOpen,
  Users,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";

export default function DormitoriesPage() {
  const [dormitories, setDormitories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Gedung Baru
  const [modalDormOpen, setModalDormOpen] = useState(false);
  const [dormName, setDormName] = useState("");
  const [dormGender, setDormGender] = useState<"L" | "P">("L");
  const [dormDesc, setDormDesc] = useState("");

  // Modal Kamar Baru
  const [modalRoomOpen, setModalRoomOpen] = useState(false);
  const [selectedDormId, setSelectedDormId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState<number | "">(8);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listDormitoriesAction();
      if (res.success && res.data) {
        setDormitories(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDorm = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const res = await createDormitoryAction({
        name: dormName.trim(),
        gender: dormGender,
        description: dormDesc.trim() || undefined,
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal membuat gedung asrama.", type: "error" });
      } else {
        setMessage({ text: "Gedung asrama berhasil dibuat!", type: "success" });
        setModalDormOpen(false);
        setDormName("");
        setDormDesc("");
        loadData();
      }
    });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedDormId) {
      setMessage({ text: "Pilih gedung asrama terlebih dahulu.", type: "error" });
      return;
    }

    startTransition(async () => {
      const res = await createDormitoryRoomAction({
        dormitoryId: selectedDormId,
        name: roomName.trim(),
        capacity: Number(roomCapacity),
      });

      if (!res.success) {
        setMessage({ text: res.error || "Gagal membuat kamar asrama.", type: "error" });
      } else {
        setMessage({ text: "Kamar asrama berhasil dibuat!", type: "success" });
        setModalRoomOpen(false);
        setRoomName("");
        setRoomCapacity(8);
        loadData();
      }
    });
  };

  const totalRooms = dormitories.reduce((acc, d) => acc + (d.rooms?.length || 0), 0);
  const totalCapacity = dormitories.reduce(
    (acc, d) =>
      acc + (d.rooms?.reduce((rAcc: number, r: any) => rAcc + r.capacity, 0) || 0),
    0
  );
  const totalOccupants = dormitories.reduce(
    (acc, d) =>
      acc +
      (d.rooms?.reduce((rAcc: number, r: any) => rAcc + (r.assignments?.length || 0), 0) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Pesantren & Tahfidz" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <Home className="h-4 w-4" />
              <span>Living & Pengasuhan</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Asrama & Kobong Santri
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Kelola kompleks gedung asrama, pembagian kamar, dan kapasitas hunian santri mukim.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setMessage(null);
                setModalDormOpen(true);
              }}
              className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Gedung</span>
            </button>

            <button
              onClick={() => {
                setMessage(null);
                if (dormitories.length > 0) {
                  setSelectedDormId(dormitories[0].id);
                }
                setModalRoomOpen(true);
              }}
              className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50"
            >
              <DoorOpen className="h-4 w-4 text-stone-600" />
              <span>Tambah Kamar</span>
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

        {/* Quick Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Gedung Asrama</span>
            <p className="mt-1 text-2xl font-bold text-stone-900">{dormitories.length}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Total Kamar</span>
            <p className="mt-1 text-2xl font-bold text-stone-900">{totalRooms}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-teal-700">Santri Mukim</span>
            <p className="mt-1 text-2xl font-bold text-teal-800">{totalOccupants}</p>
          </div>
          <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs">
            <span className="text-xs font-medium text-stone-500">Kapasitas Total</span>
            <p className="mt-1 text-2xl font-bold text-stone-900">
              {totalCapacity}{" "}
              <span className="text-xs font-normal text-stone-500">
                ({totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0}% terisi)
              </span>
            </p>
          </div>
        </div>

        {/* Dormitories Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : dormitories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <Home className="mx-auto h-12 w-12 text-stone-400" />
            <h3 className="mt-3 text-base font-bold text-stone-900">Belum ada gedung asrama</h3>
            <p className="mt-1 text-xs text-stone-500">
              Mulai dengan menambahkan gedung asrama santri putra atau putri pertama Anda.
            </p>
            <button
              onClick={() => setModalDormOpen(true)}
              className="touch-target mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Gedung Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dormitories.map((dorm) => {
              const roomsCount = dorm.rooms?.length || 0;
              const dormCap =
                dorm.rooms?.reduce((acc: number, r: any) => acc + r.capacity, 0) || 0;
              const dormOcc =
                dorm.rooms?.reduce(
                  (acc: number, r: any) => acc + (r.assignments?.length || 0),
                  0
                ) || 0;
              const percent = dormCap > 0 ? Math.round((dormOcc / dormCap) * 100) : 0;

              return (
                <div
                  key={dorm.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs transition hover:border-teal-300 hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-2xs font-bold ${
                          dorm.gender === "L"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : dorm.gender === "P"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {dorm.gender === "L"
                          ? "Asrama Putra (Ikhwan)"
                          : dorm.gender === "P"
                          ? "Asrama Putri (Akhwat)"
                          : "Umum"}
                      </span>
                      <span className="text-2xs font-medium text-stone-400">
                        {roomsCount} Kamar
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-stone-900">{dorm.name}</h3>
                    {dorm.description && (
                      <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                        {dorm.description}
                      </p>
                    )}

                    {/* Capacity Progress Bar */}
                    <div className="mt-4 rounded-xl bg-stone-50 p-3 border border-stone-100">
                      <div className="flex justify-between text-2xs font-medium text-stone-600 mb-1.5">
                        <span>Hunian: {dormOcc} santri</span>
                        <span>Kapasitas: {dormCap} ({percent}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                          className={`h-full rounded-full ${
                            percent >= 90
                              ? "bg-rose-600"
                              : percent >= 75
                              ? "bg-amber-600"
                              : "bg-teal-600"
                          }`}
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-stone-100 pt-4">
                    <Link
                      href={`/dormitories/${dorm.id}`}
                      className="touch-target flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-700"
                    >
                      <span>Kelola Kamar & Santri</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Tambah Gedung */}
      {modalDormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Tambah Gedung Asrama</h3>
              <button
                onClick={() => setModalDormOpen(false)}
                className="touch-target rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDorm} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Nama Gedung Asrama</label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung Abu Bakar Ash-Shiddiq"
                  value={dormName}
                  onChange={(e) => setDormName(e.target.value)}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Peruntukan Santri</label>
                <select
                  value={dormGender}
                  onChange={(e) => setDormGender(e.target.value as any)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  <option value="L">Putra (Ikhwan / Banin)</option>
                  <option value="P">Putri (Akhwat / Banat)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Deskripsi / Keterangan</label>
                <textarea
                  rows={3}
                  placeholder="Keterangan lokasi gedung, musyrif penanggung jawab..."
                  value={dormDesc}
                  onChange={(e) => setDormDesc(e.target.value)}
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDormOpen(false)}
                  className="touch-target rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan Gedung"}
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
              <h3 className="text-base font-bold text-stone-900">Tambah Kamar Asrama</h3>
              <button
                onClick={() => setModalRoomOpen(false)}
                className="touch-target rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Gedung Asrama</label>
                <select
                  value={selectedDormId}
                  onChange={(e) => setSelectedDormId(e.target.value)}
                  required
                  className="touch-target mt-1 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  {dormitories.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.gender === "L" ? "Putra" : "Putri"})
                    </option>
                  ))}
                </select>
              </div>

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
