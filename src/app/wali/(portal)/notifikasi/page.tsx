import React from "react";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianNotifications } from "../../../../lib/guardian/portal-service";
import { Bell, MessageSquare, CheckCheck, Clock, AlertCircle, Calendar } from "lucide-react";

export default async function GuardianNotificationsPage() {
  const auth = await getAuthenticatedGuardianSession();
  const profile = await getGuardianProfile(auth.guardian.id, auth.institution.id);

  const notifications = await getGuardianNotifications({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    phoneWa: profile.guardian.phoneWa,
    limit: 50,
  });

  const getTemplateTitle = (key: string) => {
    switch (key) {
      case "PAYMENT_RECEIPT":
        return "Bukti Penerimaan Pembayaran SPP / Iuran";
      case "ATTENDANCE_ALERT":
        return "Pemberitahuan Presensi & Kehadiran Santri";
      case "GUARDIAN_INVITE":
        return "Undangan Aktivasi Portal Wali Murid";
      case "ANNOUNCEMENT":
        return "Pengumuman Resmi Sekolah / Pesantren";
      default:
        return `Pemberitahuan Sistem (${key})`;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCheck className="h-3 w-3" />
            Terkirim ke WhatsApp
          </span>
        );
      case "PENDING":
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <Clock className="h-3 w-3" />
            Dalam Antrean
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            <AlertCircle className="h-3 w-3" />
            Gagal Terkirim
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
          Riwayat Notifikasi WhatsApp
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Pesan resmi yang dikirimkan oleh sistem {profile.institution.name} ke nomor WhatsApp Anda ({profile.guardian.phoneWa}).
        </p>
      </div>

      {/* Roster Pesan Notifikasi */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-zinc-900">Log Pesan Resmi Keluar (Outbox)</h2>
          </div>
          <span className="text-xs text-zinc-500">{notifications.length} pesan</span>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada riwayat pesan notifikasi yang dikirimkan ke nomor WhatsApp Anda.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-4 hover:bg-stone-50/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm font-bold text-zinc-900">
                    {getTemplateTitle(notif.templateKey)}
                  </span>
                  <div>{getStatusBadge(notif.status)}</div>
                </div>

                {/* Detail Payload Ringkas */}
                <div className="mt-2 text-xs text-zinc-600 bg-stone-50 rounded-xl p-3 border border-stone-200/60 space-y-1">
                  {notif.payload.studentName ? (
                    <p>
                      Santri: <strong>{String(notif.payload.studentName)}</strong>
                    </p>
                  ) : null}
                  {notif.payload.receiptNo ? (
                    <p>
                      No. Kwitansi: <strong>{String(notif.payload.receiptNo)}</strong> (Nominal: Rp{" "}
                      {Number(notif.payload.amount || 0).toLocaleString("id-ID")})
                    </p>
                  ) : null}
                  {notif.payload.status ? (
                    <p>
                      Status Presensi: <strong>{String(notif.payload.status)}</strong>
                    </p>
                  ) : null}
                  {notif.payload.inviteUrl ? (
                    <p className="text-[11px] text-zinc-500 truncate">
                      Tautan Aktivasi: {String(notif.payload.inviteUrl)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(notif.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <span>Tujuan: {notif.recipient}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
