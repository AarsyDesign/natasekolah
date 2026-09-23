"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Users2,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Edit2,
  X,
  Save,
} from "lucide-react";
import {
  listManagedUsersAction,
  updateUserRolesAction,
  toggleUserActiveAction,
} from "../../../actions/settings";
import {
  ASSIGNABLE_ROLES as ROLES,
  type Role,
  type ManagedUser,
} from "../../../lib/settings/types";

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal edit role
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  // Confirmation toggle active
  const [togglingUser, setTogglingUser] = useState<ManagedUser | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await listManagedUsersAction();
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setErrorMsg(res.error || "Gagal memuat daftar pengguna.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openRoleModal = (user: ManagedUser) => {
    setEditingUser(user);
    setSelectedRoles([...user.roles]);
  };

  const handleToggleRoleSelection = (role: Role) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSaveRoles = () => {
    if (!editingUser) return;
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateUserRolesAction(editingUser.id, {
        roles: selectedRoles,
      });

      if (res.success && res.data) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? res.data! : u))
        );
        setSuccessMsg(`Peran pengguna ${editingUser.name} berhasil diperbarui.`);
        setEditingUser(null);
      } else {
        setErrorMsg(res.error || "Gagal memperbarui peran pengguna.");
      }
    });
  };

  const handleConfirmToggleActive = () => {
    if (!togglingUser) return;
    setSuccessMsg(null);
    setErrorMsg(null);

    const targetStatus = !togglingUser.isActive;

    startTransition(async () => {
      const res = await toggleUserActiveAction(togglingUser.id, {
        isActive: targetStatus,
      });

      if (res.success && res.data) {
        setUsers((prev) =>
          prev.map((u) => (u.id === togglingUser.id ? res.data! : u))
        );
        setSuccessMsg(
          `Akun ${togglingUser.name} berhasil ${
            targetStatus ? "diaktifkan kembali" : "dinonaktifkan"
          }.`
        );
        setTogglingUser(null);
      } else {
        setErrorMsg(res.error || "Gagal mengubah status aktif pengguna.");
      }
    });
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "FOUNDATION_HEAD":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "PRINCIPAL":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "ADMIN":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "FINANCE_STAFF":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "TEACHER":
        return "bg-sky-100 text-sky-800 border-sky-200";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-teal-700" />
        <p className="text-sm font-medium text-stone-600">Memuat direktori staf...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Principle Banner */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              Tata Kelola Otorisasi Akun Internal Lembaga
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              Setiap pengguna terikat pada peran resmi sistem. Penonaktifan akun akan mencabut seluruh sesi aktif secara instan. Wali murid bukan bagian dari akun staf ini dan hanya dikelola melalui Portal Wali terpisah.
            </p>
          </div>
        </div>
      </div>

      {/* Users Table / List */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 p-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900">Daftar Pengguna Internal</h2>
            <p className="text-xs text-stone-500">
              {users.length} akun terdaftar di lembaga ini
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            disabled={isPending}
            className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="divide-y divide-stone-100">
          {users.map((user) => (
            <div
              key={user.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition ${
                !user.isActive ? "bg-stone-50/70 opacity-75" : "hover:bg-stone-50/40"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900 truncate">{user.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-xs px-1.5 py-0.5 text-[10px] font-semibold border ${
                      user.isActive
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="text-xs text-stone-500 truncate mt-0.5">
                  {user.email} {user.phoneWa ? `• WA: ${user.phoneWa}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <span
                      key={r}
                      className={`inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold ${getRoleBadgeStyle(
                        r
                      )}`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openRoleModal(user)}
                  className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  <Edit2 className="h-3.5 w-3.5 text-stone-500" />
                  <span>Ubah Peran</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTogglingUser(user)}
                  className={`touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    user.isActive
                      ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                      : "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {user.isActive ? (
                    <>
                      <UserX className="h-3.5 w-3.5" />
                      <span>Nonaktifkan</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Aktifkan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Ubah Peran Pengguna</h3>
                <p className="text-xs text-stone-500">{editingUser.name} ({editingUser.email})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                Pilih Hak Akses Peran Internal (Paling Sedikit 1):
              </label>
              {ROLES.map((role) => {
                const isChecked = selectedRoles.includes(role as Role);
                return (
                  <label
                    key={role}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs font-medium transition ${
                      isChecked
                        ? "border-teal-400 bg-teal-50/50 text-teal-950"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRoleSelection(role as Role)}
                        className="h-4 w-4 rounded-xs border-stone-300 text-teal-700 focus:ring-teal-500"
                      />
                      <span>{role}</span>
                    </div>
                    <span className="text-[10px] text-stone-400">
                      {role === "TEACHER" && "Akses guru & presensi kelas"}
                      {role === "FINANCE_STAFF" && "Kelola SPP & kwitansi"}
                      {role === "ADMIN" && "Administrasi siswa & rombel"}
                      {role === "PRINCIPAL" && "Kepala sekolah"}
                      {role === "FOUNDATION_HEAD" && "Pimpinan yayasan"}
                      {role === "SUPER_ADMIN" && "Akses penuh platform"}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={isPending || selectedRoles.length === 0}
                className="touch-target inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Simpan Peran</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Toggle Active */}
      {togglingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle
                className={`h-6 w-6 shrink-0 ${
                  togglingUser.isActive ? "text-rose-600" : "text-emerald-600"
                }`}
              />
              <h3 className="text-base font-bold text-stone-900">
                {togglingUser.isActive ? "Konfirmasi Penonaktifan Akun" : "Konfirmasi Pengaktifan Akun"}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-stone-600">
              {togglingUser.isActive
                ? `Apakah Anda yakin ingin menonaktifkan akun staf ${togglingUser.name}? Seluruh sesi aktif pengguna ini akan dicabut secara instan dan pengguna tidak akan dapat masuk kembali hingga diaktifkan.`
                : `Aktifkan kembali akun staf ${togglingUser.name}? Pengguna akan dapat masuk kembali ke sistem.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setTogglingUser(null)}
                className="touch-target rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                disabled={isPending}
                className={`touch-target inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  togglingUser.isActive
                    ? "bg-rose-700 hover:bg-rose-800"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {togglingUser.isActive ? "Ya, Nonaktifkan Akun" : "Ya, Aktifkan Akun"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
