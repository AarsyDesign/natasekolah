"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listPaymentTransactionsAction,
  createPaymentTransactionAction,
  listStudentChargesAction,
  getReceiptByPaymentAction,
} from "@/actions/finance";
import { getStudentsAction } from "@/actions/academic";
import {
  CreditCard,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  X,
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
  const [modalOpen, setModalOpen] = useState(false);
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
      const res = await listPaymentTransactionsAction({ search: search || undefined, limit: 50 });
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
  }, []);

  const handleOpenPayment = async () => {
    setSelectedStudentId("");
    setUnpaidCharges([]);
    setAllocationsMap({});
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setNote("");
    setModalOpen(true);

    try {
      const res = await getStudentsAction({ limit: 100 });
      if (res.success && res.data) setStudents(res.data.data as any);
    } catch (err) {
      console.error(err);
    }
  };

  const stResData = (items: any[]) => items;

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
        setUnpaidCharges(pending);

        // Pre-fill allocations map
        const initialMap: Record<string, number> = {};
        pending.forEach((c: any) => {
          initialMap[c.id] = c.remainingAmount;
        });
        setAllocationsMap(initialMap);

        // Auto sum payment amount
        const sum = pending.reduce((acc: number, c: any) => acc + c.remainingAmount, 0);
        setPaymentAmount(sum);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAllocationChange = (chargeId: string, val: number) => {
    const updated = { ...allocationsMap, [chargeId]: val };
    setAllocationsMap(updated);

    const newSum = Object.values(updated).reduce((acc, v) => acc + (v || 0), 0);
    setPaymentAmount(newSum);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
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
          setMessage({ type: "success", text: "Pembayaran berhasil diterima dan kwitansi diterbitkan." });
          setModalOpen(false);
          loadData();
          // Open receipt view
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
      const res = await getReceiptByPaymentAction(paymentId);
      if (res.success && res.data) {
        setReceiptModal(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-emerald-600" /> Kasir Pembayaran & Transaksi
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Penerimaan kas syahriah/SPP siswa, alokasi pembayaran atomik, dan bukti kwitansi sah
            </p>
          </div>

          <button
            onClick={handleOpenPayment}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-700 transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Terima Pembayaran
          </button>
        </div>

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

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex gap-3">
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
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[44px]"
            />
          </form>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat riwayat transaksi pembayaran...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Belum ada transaksi pembayaran yang tercatat.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">No. Transaksi</th>
                    <th className="px-4 py-3.5">Siswa</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Metode</th>
                    <th className="px-4 py-3.5">Total Bayar</th>
                    <th className="px-4 py-3.5 text-right">Kwitansi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {item.transactionNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.student.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">NIS: {item.student.nis}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">
                        {new Date(item.paymentDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {item.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-emerald-600">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleViewReceipt(item.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium text-xs rounded-lg transition-colors border border-slate-200"
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

      {/* Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Form Pembayaran Kasir & Alokasi</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Siswa Pembayar
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} (NIS: {st.nis})
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudentId && unpaidCharges.length === 0 && (
                <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs">
                  Siswa ini tidak memiliki tunggakan tagihan aktif.
                </div>
              )}

              {unpaidCharges.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Alokasi Pembayaran ke Tagihan Siswa
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {unpaidCharges.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{c.feeCategory.name}</div>
                          <div className="text-slate-500 font-mono">
                            Periode: {c.period || "-"} | Sisa: Rp {c.remainingAmount.toLocaleString("id-ID")}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Bayar Rp:</span>
                          <input
                            type="number"
                            min={0}
                            max={c.remainingAmount}
                            value={allocationsMap[c.id] ?? 0}
                            onChange={(e) =>
                              handleAllocationChange(c.id, Number(e.target.value))
                            }
                            className="w-28 px-2 py-1 text-right font-semibold bg-slate-50 border border-slate-300 rounded-md"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Pembayaran (Rp)
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan transaksi (opsional)"
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
                  disabled={isPending || unpaidCharges.length === 0}
                  className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Memproses..." : "Proses Pembayaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:max-w-none">
            <div className="p-6 space-y-4 print:p-0">
              <div className="flex items-center justify-between border-b pb-3 print:border-b-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">NataSekolah</h2>
                  <p className="text-xs text-slate-500">Kwitansi Bukti Pembayaran Sah</p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-1 bg-slate-100 rounded-md">
                  {receiptModal.receiptNumber}
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Siswa:</span>
                  <span className="font-bold text-slate-900">
                    {receiptModal.paymentTransaction.student.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Transaksi:</span>
                  <span className="font-mono">{receiptModal.paymentTransaction.transactionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span>
                    {new Date(receiptModal.paymentTransaction.paymentDate).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Penerima Kasir:</span>
                  <span>{receiptModal.issuedBy.name}</span>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Rincian Alokasi Tagihan:</h4>
                <div className="space-y-1.5 text-xs">
                  {receiptModal.paymentTransaction.allocations.map((a: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-dashed pb-1">
                      <span className="text-slate-700">{a.studentCharge.feeCategory.name}</span>
                      <span className="font-semibold">Rp {a.amount.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t text-sm font-bold text-slate-900">
                <span>Total Dibayar ({receiptModal.paymentTransaction.paymentMethod}):</span>
                <span className="text-emerald-700">
                  Rp {receiptModal.paymentTransaction.amount.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="pt-4 flex justify-between items-center print:hidden">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                >
                  <Printer className="w-4 h-4" /> Cetak Kwitansi
                </button>

                <button
                  onClick={() => setReceiptModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
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
