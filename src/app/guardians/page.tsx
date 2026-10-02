"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { NavHeader } from "@/components/nav-header";
import {
  listGuardiansAction,
  updateGuardianAction,
  deactivateGuardianAction,
  createGuardianInvitationAction,
} from "@/actions/guardian";
import {
  UsersRound,
  Plus,
  RefreshCw,
  Search,
  X,
  Edit2,
  MailPlus,
  UserX,
  Copy,
  Check,
  Users,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  INVITED: "Diundang",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
};

const STATUS_BADGE: Record<string, string> = {
  INVITED: "bg-amber-50 text-amber-700 border-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-rose-50 text-rose-700 border-rose-200",
};

const RELATIONSHIP_LABEL: Record<string, string> = {
  AYAH: "Ayah",
  IBU: "Ibu",
  WALI: "Wali",
  LAINNYA: "Lainnya",
};

interface InvitationResult {
  guardianId: string;
  rawToken: string;
  activationPath: string;
  expiresAt: string | Date;
  sentVia: string;
}

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modal edit profil
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", phoneWa: "", email: "", status: "INVITED" });

  // Modal nonaktifkan
  const [deactivating, setDeactivating] = useState<any | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  // Modal undangan
  const [inviting, setInviting] = useState<any | null>(null);
  const [sentVia, setSentVia] = useState<"WHATSAPP" | "SMS" | "MANUAL">("WHATSAPP");
  const [inviteResult, setInviteResult] = useState<InvitationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listGuardiansAction({
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      if (res.success && res.data) {
        setGuardians(res.data.guardians);
        setCanManage(res.data.canManage);
      } else if (!res.success) {
        setMessage({ text: res.error || "Gagal memuat daftar wali murid.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadData();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(loadData);
  };

  const openEdit = (g: any) => {
    setEditing(g);
    setEditForm({
      fullName: g.fullName || "",
      phoneWa: g.phoneWa || "",
      email: g.email || "",
      status: g.status || "INVITED",
    });
    setMessage(null);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setMessage(null);
    startTransition(async () => {
      const res = await updateGuardianAction({
        guardianId: editing.id,
        fullName: editForm.fullName.trim(),
        phoneWa: editForm.phoneWa.trim(),
        email: editForm.email.trim(),
        status: editForm.status,
      });
      if (!res.success) {
        setMessage({ text: res.error || "Gagal memperbarui profil wali.", type: "error" });
      } else {
        setMessage({ text: `Profil ${editForm.fullName} diperbarui.`, type: "success" });
        setEditing(null);
        loadData();
      }
    });
  };

  const handleDeactivate = () => {
    if (!deactivating) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deactivateGuardianAction({
        guardianId: deactivating.id,
        reason: deactivateReason.trim() || undefined,
      });
      if (!res.success) {
        setMessage({ text: res.error || "Gagal menonaktifkan wali.", type: "error" });
      } else {
        const revoked = res.data?.revokedInvitations ?? 0;
        setMessage({
          text: `${deactivating.fullName} dinonaktifkan${
            revoked > 0 ? ` · ${revoked} undangan dicabut` : ""
          }.`,
          type: "success",
        });
        setDeactivating(null);
        setDeactivateReason("");
        loadData();
      }
    });
  };

  const handleInvite = () => {
    if (!inviting) return;
    setMessage(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createGuardianInvitationAction({
        guardianId: inviting.id,
        sentVia,
      });
      if (!res.success || !res.data) {
        setMessage({ text: res.error || "Gagal membuat undangan.", type: "error" });
      } else {
        setInviteResult(res.data);
        setInviting(null);
        loadData();
      }
    });
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ text: "Gagal menyalin — salin manual dari kolom.", type: "error" });
    }
  };

  const activationLink = inviteResult
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${inviteResult.activationPath}`
    : "";

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16">
      <NavHeader subtitle="Master Data" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <UsersRound className="h-4 w-4" />
              <span>Master Data Wali Murid</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              Wali Murid
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Kelola profil wali, lihat relasi anak, dan kirim undangan aktivasi portal wali
              (token 1x pakai, berlaku 72 jam).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/settings/users"
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50"
            >
              <Users className="h-4 w-4" />
              <span>Staf Internal</span>
            </Link>
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

        {/* Filter & pencarian */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, WA, atau email..."
              aria-label="Cari wali murid"
              className="touch-target w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-xs text-stone-800 shadow-2xs"
            />
          </form>
          <label htmlFor="guardian-status-filter" className="text-xs font-medium text-stone-600">
            Status
          </label>
          <select
            id="guardian-status-filter"
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
          <span className="text-xs text-stone-500">{guardians.length} data</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : guardians.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <UsersRound className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-700">Belum ada wali murid</p>
            <p className="mt-1 max-w-sm text-xs text-stone-500">
              Wali dibuat saat impor data siswa atau saat aktivasi portal wali. Gunakan tombol
              &quot;Undang&quot; pada wali untuk menerbitkan tautan aktivasi.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {guardians.map((g: any) => (
              <li
                key={g.id}
                className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-stone-900">
                        {g.fullName}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_BADGE[g.status] ||
                          "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {STATUS_LABEL[g.status] || g.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">
                      WA: <span className="font-medium">{g.phoneWa}</span>
                      {g.email ? ` · ${g.email}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-stone-400" />
                      {(g.students || []).length === 0 ? (
                        <span className="text-[11px] italic text-stone-400">
                          Belum terhubung dengan siswa
                        </span>
                      ) : (
                        (g.students || []).map((rel: any) => (
                          <span
                            key={rel.id || rel.student?.id}
                            className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800"
                          >
                            {rel.student?.fullName || "?"}{" "}
                            ({RELATIONSHIP_LABEL[rel.relationship] || rel.relationship}
                            {rel.isPrimary ? ", utama" : ""})
                          </span>
                        ))
                      )}
                    </div>
                    {(g.invitations || []).length > 0 && (
                      <p className="mt-1.5 text-[11px] text-amber-700">
                        Undangan aktif:{" "}
                        {new Date(g.invitations[0].expiresAt).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        (belum ditebus)
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openEdit(g)}
                        disabled={isPending}
                        className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setInviteResult(null);
                          setSentVia("WHATSAPP");
                          setInviting(g);
                          setMessage(null);
                        }}
                        disabled={isPending || g.status === "INACTIVE"}
                        title={
                          g.status === "INACTIVE"
                            ? "Wali nonaktif — aktifkan dulu sebelum mengundang"
                            : "Terbitkan token aktivasi 72 jam"
                        }
                        className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        <MailPlus className="h-3.5 w-3.5" />
                        Undang
                      </button>
                      {g.status !== "INACTIVE" && (
                        <button
                          onClick={() => {
                            setDeactivating(g);
                            setDeactivateReason("");
                            setMessage(null);
                          }}
                          disabled={isPending}
                          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Nonaktifkan
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Modal Edit Profil */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit profil wali murid"
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Edit Profil Wali</h2>
              <button
                onClick={() => setEditing(null)}
                className="touch-target rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label htmlFor="g-name" className="mb-1 block text-xs font-medium text-stone-700">
                  Nama lengkap *
                </label>
                <input
                  id="g-name"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>
              <div>
                <label htmlFor="g-phone" className="mb-1 block text-xs font-medium text-stone-700">
                  Nomor WhatsApp *
                </label>
                <input
                  id="g-phone"
                  required
                  inputMode="tel"
                  value={editForm.phoneWa}
                  onChange={(e) => setEditForm((f) => ({ ...f, phoneWa: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>
              <div>
                <label htmlFor="g-email" className="mb-1 block text-xs font-medium text-stone-700">
                  Email (kosongkan untuk menghapus)
                </label>
                <input
                  id="g-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                />
              </div>
              <div>
                <label htmlFor="g-status" className="mb-1 block text-xs font-medium text-stone-700">
                  Status
                </label>
                <select
                  id="g-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="touch-target rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editForm.fullName.trim() || !editForm.phoneWa.trim()}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Undangan */}
      {inviting && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Undang wali murid"
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Undang Wali Murid</h2>
              <button
                onClick={() => setInviting(null)}
                className="touch-target rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-stone-600">
              Token aktivasi untuk <span className="font-semibold">{inviting.fullName}</span>{" "}
              berlaku <span className="font-semibold">72 jam</span> dan hanya bisa dipakai{" "}
              <span className="font-semibold">sekali</span>. Sampaikan tautannya lewat jalur
              pribadi.
            </p>

            <div className="mb-4">
              <label htmlFor="g-sentvia" className="mb-1 block text-xs font-medium text-stone-700">
                Kanal pengiriman
              </label>
              <select
                id="g-sentvia"
                value={sentVia}
                onChange={(e) => setSentVia(e.target.value as typeof sentVia)}
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
                <option value="MANUAL">Salin manual</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setInviting(null)}
                className="touch-target rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                onClick={handleInvite}
                disabled={isPending}
                className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {isPending ? "Menerbitkan..." : "Terbitkan Token"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hasil Undangan (tampilkan token untuk disalin) */}
      {inviteResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Token undangan diterbitkan"
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">Token Undangan Diterbitkan</h2>
              <button
                onClick={() => setInviteResult(null)}
                className="touch-target rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-stone-700">Tautan aktivasi</p>
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={activationLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700"
                  />
                  <button
                    onClick={() => copyText(activationLink)}
                    className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-stone-700">Token mentah (64 karakter)</p>
                <input
                  readOnly
                  value={inviteResult.rawToken}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[10px] break-all text-stone-700"
                />
              </div>

              <p className="text-[11px] text-stone-500">
                Kedaluwarsa:{" "}
                {new Date(inviteResult.expiresAt).toLocaleString("id-ID", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Kanal: {inviteResult.sentVia} · Token baru otomatis mencabut token lama.
              </p>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setInviteResult(null)}
                  className="touch-target rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nonaktifkan */}
      {deactivating && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi penonaktifan wali"
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="mb-3 flex items-start gap-3">
              <UserX className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h2 className="text-base font-bold text-stone-900">Nonaktifkan Wali?</h2>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  {deactivating.fullName} tidak bisa masuk ke Portal Wali, dan seluruh undangan
                  yang belum ditebus akan dicabut permanen.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="g-deactivate-reason"
                className="mb-1 block text-xs font-medium text-stone-700"
              >
                Alasan (opsional)
              </label>
              <input
                id="g-deactivate-reason"
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                maxLength={200}
                placeholder="Contoh: wali pindah sekolah"
                className="touch-target w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeactivating(null)}
                className="touch-target rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isPending}
                className="touch-target rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {isPending ? "Menonaktifkan..." : "Ya, Nonaktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
