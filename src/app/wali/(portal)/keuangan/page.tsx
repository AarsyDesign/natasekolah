import React from "react";
import { getAuthenticatedGuardianSession } from "../../../../lib/guardian/auth-helper";
import { getGuardianProfile, getGuardianStudentFinance } from "../../../../lib/guardian/portal-service";
import { CreditCard, CheckCircle2, AlertCircle, Clock, Receipt, Calendar } from "lucide-react";

export default async function GuardianFinancePage({
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

  const finance = await getGuardianStudentFinance({
    sessionGuardianId: auth.guardian.id,
    sessionInstitutionId: auth.institution.id,
    requestedStudentId: targetStudentId,
  });

  const getChargeStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Lunas
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" />
            Sebagian
          </span>
        );
      case "UNPAID":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
            <AlertCircle className="h-3 w-3" />
            Belum Bayar
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
          Keuangan & Tagihan Santri
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Rincian kewajiban SPP, iuran gedung, dan riwayat pembayaran resmi untuk {activeChild.student.fullName}.
        </p>
      </div>

      {/* Ringkasan Keuangan Banner */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-b sm:border-b-0 sm:border-r border-stone-100 pb-3 sm:pb-0 sm:pr-4">
            <span className="text-xs text-zinc-500 block">Sisa Kewajiban Tagihan:</span>
            <span className="mt-1 block text-2xl font-bold text-red-700">
              Rp {finance.totalUnpaidAmount.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block">
              {finance.unpaidChargesCount} tagihan belum terselesaikan
            </span>
          </div>

          <div className="border-b sm:border-b-0 sm:border-r border-stone-100 pb-3 sm:pb-0 sm:pr-4">
            <span className="text-xs text-zinc-500 block">Total Sudah Terbayar:</span>
            <span className="mt-1 block text-2xl font-bold text-emerald-700">
              Rp {finance.totalPaidAmount.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 block">
              Tercatat resmi di buku kas yayasan
            </span>
          </div>

          <div>
            <span className="text-xs text-zinc-500 block">Status Akun Keuangan:</span>
            <div className="mt-2">
              {finance.unpaidChargesCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Kewajiban Lunas Bersih
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  Menunggu Penyelesaian
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Pembayaran dapat dilakukan melalui bendahara yayasan atau transfer resmi.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Daftar Kewajiban Tagihan */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-zinc-900">Daftar Tagihan & Iuran</h2>
          </div>
          <span className="text-xs text-zinc-500">{finance.recentCharges.length} tagihan</span>
        </div>

        {finance.recentCharges.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada tagihan yang diterbitkan untuk santri ini.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {finance.recentCharges.map((charge) => (
              <div
                key={charge.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-stone-50/50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900">{charge.categoryName}</span>
                    {getChargeStatusBadge(charge.status)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span>
                      Total: <strong>Rp {charge.amount.toLocaleString("id-ID")}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Dibayar:{" "}
                      <strong className="text-emerald-700">
                        Rp {charge.paidAmount.toLocaleString("id-ID")}
                      </strong>
                    </span>
                    {charge.dueDate && (
                      <>
                        <span>•</span>
                        <span>
                          Jatuh Tempo: {new Date(charge.dueDate).toLocaleDateString("id-ID")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="text-[11px] text-zinc-400 block">Sisa Pembayaran:</span>
                  <span className="text-sm font-bold text-red-700">
                    Rp {charge.remainingAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Riwayat Transaksi & Bukti Kwitansi */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-zinc-900">Riwayat Pembayaran & Kwitansi Resmi</h2>
          </div>
          <span className="text-xs text-zinc-500">{finance.recentTransactions.length} transaksi</span>
        </div>

        {finance.recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 italic">
            Belum ada catatan transaksi pembayaran yang berhasil.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {finance.recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-stone-50/50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">
                      No. Transaksi: {tx.transactionNo}
                    </span>
                    {tx.receiptNo && (
                      <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200">
                        <Receipt className="h-3 w-3" />
                        Kwitansi: {tx.receiptNo}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    Alokasi: {tx.categoryNames.join(", ") || "Iuran Umum"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(tx.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}</span>
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="text-[11px] text-zinc-400 block">Jumlah Diterima:</span>
                  <span className="text-sm font-bold text-emerald-700">
                    Rp {tx.totalAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
