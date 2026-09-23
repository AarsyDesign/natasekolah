"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listPaymentTransactionsAction,
  createPaymentTransactionAction,
  listStudentChargesAction,
  getReceiptDetailsAction,
} from "@/actions/finance";
import { getStudentsAction } from "@/actions/academic";
import { generatePaymentsCSV, downloadCSV } from "@/lib/finance/export-utils";
import {
  CreditCard,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  X,
  Download,
  AlertCircle,
  FileCheck2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  ChevronRight,
} from "lucide-react";

interface PaymentItem {
  id: string;
  transactionNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  student: {
    fullName: string;
    nis: string;
  };
  receivedBy: {
    name: string;
  };
  receipt?: {
    receiptNumber: string;
  } | null;
  allocations: Array<{
    amount: number;
    studentCharge: {
      feeCategory: {
        name: string;
      };
    };
  }>;
}

export default function PaymentsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [receiptModal, setReceiptModal] = useState<any | null>(null);

  const [students, setStudents] = useState<Array<{ id: string; fullName: string; nis: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [unpaidCharges, setUnpaidCharges] = useState<Array<any>>([]);
  const [allocationsMap, setAllocationsMap] = useState<Record<string, number>>({});
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [note, setNote] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listPaymentTransactionsAction({
        search: search || undefined,
        paymentMethod: methodFilter === "ALL" ? undefined : (methodFilter as any),
        limit: 100,
      });
      if (res.success && res.data) {
        setItems(res.data.items as any);
      }
    } catch (err: unknown) {
      console.error("Failed to load payments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [methodFilter]);

  const handleOpenPayment = async () => {
    setSelectedStudentId("");
    setUnpaidCharges([]);
    setAllocationsMap({});
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setNote("");
    setConfirmStep(false);
    setModalOpen(true);

    try {
      const res = await getStudentsAction({ limit: 100 });
      if (res.success && res.data) setStudents(res.data.data as any);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStudentSelect = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setUnpaidCharges([]);
    setAllocationsMap({});

    if (!studentId) return;

    try {
      const res = await listStudentChargesAction({
        studentId,
        limit: 50,
      });

      if (res.success && res.data) {
        // Filter out VOID and PAID charges
        const pending = res.data.items.filter(
          (c: any) => c.status !== "VOID" && c.status !== "PAID" && c.remainingAmount > 0
        );
        // Sort oldest dueDate first
        pending.sort((a: any, b: any) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        setUnpaidCharges(pending);

        // Pre-fill allocations map
        const initialMap: Record<string, number> = {};
        pending.forEach((c: any) => {
          initialMap[c.id] = c.remainingAmount;
        });
        setAllocationsMap(initialMap);

        const sum = pending.reduce((acc: number, c: any) => acc + c.remainingAmount, 0);
        setPaymentAmount(sum);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAllocationChange = (chargeId: string, val: number) => {
    const charge = unpaidCharges.find((c) => c.id === chargeId);
    const maxVal = charge ? charge.remainingAmount : val;
    const clampedVal = Math.max(0, Math.min(maxVal, val));

    const updated = { ...allocationsMap, [chargeId]: clampedVal };
    setAllocationsMap(updated);

    const newSum = Object.values(updated).reduce((acc, v) => acc + (v || 0), 0);
    setPaymentAmount(newSum);
  };

  const handleToggleAll = (selectAll: boolean) => {
    const newMap: Record<string, number> = {};
    if (selectAll) {
      unpaidCharges.forEach((c) => {
        newMap[c.id] = c.remainingAmount;
      });
    } else {
      unpaidCharges.forEach((c) => {
        newMap[c.id] = 0;
      });
    }
    setAllocationsMap(newMap);
    const newSum = Object.values(newMap).reduce((acc, v) => acc + (v || 0), 0);
    setPaymentAmount(newSum);
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || paymentAmount === "" || Number(paymentAmount) <= 0) return;

    const allocationsList = Object.entries(allocationsMap)
      .filter(([_, amt]) => amt > 0)
      .map(([chargeId, amt]) => ({
        studentChargeId: chargeId,
        amount: Number(amt),
      }));

    if (allocationsList.length === 0) {
      alert("Pilih minimal 1 alokasi tagihan dengan nominal > 0");
      return;
    }

    setConfirmStep(true);
  };

  const handleExecutePayment = () => {
    const allocationsList = Object.entries(allocationsMap)
      .filter(([_, amt]) => amt > 0)
      .map(([chargeId, amt]) => ({
        studentChargeId: chargeId,
        amount: Number(amt),
      }));

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await createPaymentTransactionAction({
          studentId: selectedStudentId,
          amount: Number(paymentAmount),
          paymentMethod: paymentMethod as any,
          note: note || null,
          allocations: allocationsList,
        });

        if (res.success && res.data) {
          setMessage({
            type: "success",
            text: "Pembayaran berhasil diterima dan kwitansi sah telah diterbitkan.",
          });
          setModalOpen(false);
          setConfirmStep(false);
          loadData();
          handleViewReceipt(res.data.payment.id);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleViewReceipt = async (paymentId: string) => {
    try {
      const res = await getReceiptDetailsAction(paymentId);
      if (res.success && res.data) {
        setReceiptModal(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCSV = () => {
    const csvContent = generatePaymentsCSV(
      items.map((i) => ({
        transactionNumber: i.transactionNumber,
        receiptNumber: i.receipt?.receiptNumber,
        paymentDate: i.paymentDate,
        studentName: i.student.fullName,
        studentNis: i.student.nis,
        amount: i.amount,
        paymentMethod: i.paymentMethod,
        receivedByName: i.receivedBy.name,
      }))
    );
    downloadCSV(`Rekap_Pembayaran_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-600" /> Kasir Pembayaran & Kwitansi
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Penerimaan pembayaran SPP/syahriah, alokasi multi-tagihan atomik, dan bukti kwitansi sah
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={items.length === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-xs hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleOpenPayment}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-xs hover:bg-emerald-700 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Terima Pembayaran
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-bold underline">
              Tutup
            </button>
          </div>
        )}

        {/* Filter and Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadData();
            }}
            className="flex-1 relative"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari no. transaksi (TRX-...) atau nama siswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white min-h-[44px]"
            />
          </form>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
          >
            <option value="ALL">Semua Metode</option>
            <option value="CASH">Tunai (CASH)</option>
            <option value="TRANSFER">Transfer Bank</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat data transaksi kasir...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700">Belum Ada Transaksi Pembayaran</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Klik tombol &quot;Terima Pembayaran&quot; untuk mencatat setoran santri dan menerbitkan kwitansi.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">No. Transaksi</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Siswa</th>
                    <th className="px-4 py-3">Nominal Bayar</th>
                    <th className="px-4 py-3">Metode</th>
                    <th className="px-4 py-3">Penerima Kasir</th>
                    <th className="px-4 py-3">No. Kwitansi</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-900">
                        {item.transactionNumber}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(item.paymentDate).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.student.fullName}</div>
                        <div className="text-xs font-mono text-slate-400">NIS: {item.student.nis}</div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-emerald-700">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {item.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{item.receivedBy.name}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                        {item.receipt?.receiptNumber ? (
                          <span className="font-semibold text-purple-700">{item.receipt.receiptNumber}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleViewReceipt(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors min-h-[36px]"
                        >
                          <Printer className="w-3.5 h-3.5" /> Kwitansi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Cashier Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" /> Kasir Penerimaan Kas
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmStep ? "Konfirmasi Transaksi Pembayaran" : "Pilih siswa dan alokasikan nominal tagihan"}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!confirmStep ? (
              <form onSubmit={handleProceedToConfirm} className="p-4 space-y-4 overflow-y-auto">
                {/* Student Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cari / Pilih Siswa <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  >
                    <option value="">-- Pilih Siswa Pembayar --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} (NIS: {st.nis})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Charges Allocation List */}
                {selectedStudentId && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        Daftar Tagihan Belum Terbayar:
                      </label>
                      {unpaidCharges.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAll(true)}
                            className="text-xs text-emerald-700 hover:underline font-semibold"
                          >
                            Pilih Semua
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => handleToggleAll(false)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>

                    {unpaidCharges.length === 0 ? (
                      <p className="text-xs text-emerald-700 py-3 text-center bg-emerald-50 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" /> Siswa ini tidak memiliki tagihan outstanding aktif (Semua lunas).
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {unpaidCharges.map((c) => {
                          const currentAlloc = allocationsMap[c.id] ?? c.remainingAmount;
                          return (
                            <div
                              key={c.id}
                              className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex-1">
                                <div className="font-bold text-slate-800">{c.feeCategory.name}</div>
                                <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>Periode: {c.period || "-"}</span>
                                  {c.isOverdue && (
                                    <span className="text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                                      Terlambat
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 mt-0.5">
                                  Sisa: <span className="font-semibold text-rose-600">Rp {c.remainingAmount.toLocaleString("id-ID")}</span>
                                </div>
                              </div>

                              <div className="w-36">
                                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                                  Alokasi (Rp)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={c.remainingAmount}
                                  value={currentAlloc}
                                  onChange={(e) => handleAllocationChange(c.id, Number(e.target.value))}
                                  className="w-full px-2 py-1 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md text-right min-h-[36px]"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Amount, Method, Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Pembayaran (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl text-emerald-700 min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Metode Pembayaran
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                    >
                      <option value="CASH">CASH (Tunai)</option>
                      <option value="TRANSFER">TRANSFER BANK</option>
                      <option value="OTHER">LAINNYA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Transaksi</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Contoh: Titipan wali via transfer BCA"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || unpaidCharges.length === 0 || !paymentAmount}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    <span>Lanjut ke Konfirmasi</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Screen before execution */
              <div className="p-5 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Konfirmasi Penerimaan Kas
                  </div>
                  <p className="text-xs text-emerald-700">
                    Pastikan uang fisik atau bukti transfer telah sah diterima sebelum menekan tombol proses. Kwitansi dan buku kas akan otomatis diterbitkan.
                  </p>
                </div>

                <div className="space-y-2 text-xs border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Siswa Pembayar:</span>
                    <span className="font-bold text-slate-900">{currentStudent?.fullName} (NIS: {currentStudent?.nis})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Metode Pembayaran:</span>
                    <span className="font-semibold text-slate-800">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Total Nominal:</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      Rp {Number(paymentAmount).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {note && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Catatan:</span>
                      <span className="text-slate-700">{note}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Rincian Alokasi Tagihan:</span>
                  <div className="space-y-1 text-xs">
                    {Object.entries(allocationsMap)
                      .filter(([_, amt]) => amt > 0)
                      .map(([chargeId, amt]) => {
                        const c = unpaidCharges.find((x) => x.id === chargeId);
                        return (
                          <div key={chargeId} className="flex justify-between p-2 bg-slate-100/70 rounded-lg">
                            <span>{c?.feeCategory?.name} ({c?.period || "-"})</span>
                            <span className="font-semibold">Rp {amt.toLocaleString("id-ID")}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
                  >
                    Kembali Edit
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleExecutePayment}
                    className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {isPending ? "Mengeksekusi Transaksi..." : "Proses & Terbitkan Kwitansi"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:max-w-none">
            <div className="p-6 space-y-4 print:p-0">
              {/* Receipt Header */}
              <div className="flex items-start justify-between border-b pb-4 print:border-b-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                    {receiptModal.institution?.name || "NataSekolah"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {receiptModal.institution?.address || "Lembaga Pendidikan & Pesantren"}
                  </p>
                  {receiptModal.institution?.phone && (
                    <p className="text-xs text-slate-400">Telp: {receiptModal.institution.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold px-2 py-1 bg-slate-100 rounded-md block">
                    {receiptModal.receiptNumber}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 block">
                    Kwitansi Sah
                  </span>
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="text-xs space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100 print:border-none print:p-0">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Siswa:</span>
                  <span className="font-bold text-slate-900">
                    {receiptModal.paymentTransaction.student.fullName} (NIS: {receiptModal.paymentTransaction.student.nis})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Transaksi:</span>
                  <span className="font-mono">{receiptModal.paymentTransaction.transactionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Pembayaran:</span>
                  <span>{new Date(receiptModal.paymentTransaction.paymentDate).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Petugas Kasir:</span>
                  <span>{receiptModal.issuedBy.name}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="border-t pt-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Rincian Pos Pembayaran:</h4>
                <div className="space-y-1.5 text-xs">
                  {receiptModal.paymentTransaction.allocations.map((a: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-dashed border-slate-200 pb-1">
                      <span className="text-slate-700">
                        {a.studentCharge.feeCategory.name} {a.studentCharge.period ? `(${a.studentCharge.period})` : ""}
                      </span>
                      <span className="font-semibold">Rp {a.amount.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-2 border-t text-sm font-bold text-slate-900">
                <span>Total Diterima ({receiptModal.paymentTransaction.paymentMethod}):</span>
                <span className="text-emerald-700 text-base">
                  Rp {receiptModal.paymentTransaction.amount.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Footer Note */}
              <div className="pt-2 text-[11px] text-slate-500 italic text-center border-t border-slate-100">
                &ldquo;{receiptModal.footerNote}&rdquo;
              </div>

              {/* Print Action Bar */}
              <div className="pt-4 flex justify-between items-center print:hidden border-t border-slate-100">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 min-h-[44px]"
                >
                  <Printer className="w-4 h-4" /> Cetak Kwitansi
                </button>

                <button
                  onClick={() => setReceiptModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 min-h-[44px]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
