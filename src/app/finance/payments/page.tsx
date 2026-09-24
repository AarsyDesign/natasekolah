"use client";

import { useState, useEffect, useTransition } from "react";
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
  Printer,
  CheckCircle2,
  Download,
  ShieldCheck,
  ArrowRight,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SuccessCheck } from "@/components/ui/success-check";
import { DataTableView, ColumnDef } from "@/components/data-dense/data-table-view";
import { TableSkeleton } from "@/components/loading/skeletons";

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
  const [step, setStep] = useState<"input" | "confirm" | "success">("input");
  const [completedPaymentId, setCompletedPaymentId] = useState<string | null>(null);
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
    setStep("input");
    setCompletedPaymentId(null);
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
        const pending = res.data.items.filter(
          (c: any) => c.status !== "VOID" && c.status !== "PAID" && c.remainingAmount > 0
        );
        pending.sort((a: any, b: any) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        setUnpaidCharges(pending);

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

    setStep("confirm");
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
          setCompletedPaymentId(res.data.payment.id);
          setStep("success");
          loadData();
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

  const columns: ColumnDef<PaymentItem>[] = [
    {
      header: "No. Transaksi",
      align: "left",
      cell: (item) => (
        <div>
          <div className="font-mono text-xs font-bold text-stone-900 leading-tight">
            {item.transactionNumber}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {new Date(item.paymentDate).toLocaleString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      ),
    },
    {
      header: "Santri / Siswa",
      align: "left",
      cell: (item) => (
        <div>
          <div className="font-semibold text-stone-900 text-sm leading-tight">
            {item.student.fullName}
          </div>
          <div className="text-xs text-stone-500 font-mono mt-0.5">NIS: {item.student.nis}</div>
        </div>
      ),
    },
    {
      header: "Nominal Bayar",
      align: "right",
      cell: (item) => (
        <span className="font-mono font-bold text-emerald-800">
          Rp {item.amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Metode",
      align: "center",
      cell: (item) => <Badge variant="neutral">{item.paymentMethod}</Badge>,
    },
    {
      header: "Petugas Kasir",
      align: "left",
      cell: (item) => <span className="text-xs text-stone-700">{item.receivedBy.name}</span>,
    },
    {
      header: "No. Kwitansi",
      align: "left",
      cell: (item) =>
        item.receipt?.receiptNumber ? (
          <span className="font-mono text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            {item.receipt.receiptNumber}
          </span>
        ) : (
          <span className="text-xs text-stone-400">-</span>
        ),
    },
    {
      header: "Aksi",
      align: "right",
      cell: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewReceipt(item.id)}
          className="text-xs h-8 px-2.5 gap-1 text-stone-700"
        >
          <Printer className="w-3.5 h-3.5" /> Kwitansi
        </Button>
      ),
    },
  ];

  const renderMobileCard = (item: PaymentItem) => (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900 text-sm">{item.student.fullName}</div>
          <div className="text-xs text-stone-500 font-mono">
            NIS: {item.student.nis} · {item.transactionNumber}
          </div>
        </div>
        <div className="shrink-0 font-mono font-bold text-emerald-800 text-sm">
          Rp {item.amount.toLocaleString("id-ID")}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-100 text-stone-600">
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{item.paymentMethod}</Badge>
          <span>{new Date(item.paymentDate).toLocaleDateString("id-ID")}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleViewReceipt(item.id)}
          className="text-xs h-8 px-2.5 gap-1"
        >
          <Printer className="w-3.5 h-3.5" /> Kwitansi
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Workspace Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-700" /> Kasir Pembayaran & Kwitansi
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Penerimaan pembayaran SPP/syahriah, multi-alokasi atomik, dan penerbitan kwitansi sah.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="gap-1.5"
          >
            <Download className="w-4 h-4 text-stone-600" /> Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenPayment} className="gap-1.5">
            <Plus className="w-4 h-4" /> Terima Pembayaran
          </Button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          role="alert"
          className={`p-3.5 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-semibold underline shrink-0 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari no. transaksi (TRX-...) atau nama santri..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadData();
            }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700 text-stone-900 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-xs py-2 min-h-[44px]"
            >
              <option value="ALL">Semua Metode</option>
              <option value="CASH">Tunai (CASH)</option>
              <option value="TRANSFER">Transfer Bank</option>
              <option value="OTHER">Lainnya</option>
            </Select>
          </div>
          <Button variant="secondary" size="default" onClick={loadData}>
            Cari
          </Button>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : (
        <DataTableView
          data={items}
          columns={columns}
          keyExtractor={(item) => item.id}
          mobileCardRenderer={renderMobileCard}
          emptyState={
            <div className="py-6 text-center">
              <CreditCard className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h4 className="font-semibold text-stone-800 text-sm">Belum Ada Transaksi Kasir</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {search || methodFilter !== "ALL"
                  ? "Tidak ada transaksi pembayaran yang sesuai dengan kriteria filter."
                  : "Belum ada transaksi pembayaran yang tercatat. Klik 'Terima Pembayaran' untuk melayani santri."}
              </p>
            </div>
          }
        />
      )}

      {/* Cashier Payment Modal */}
      <Dialog
        isOpen={modalOpen}
        onClose={() => {
          if (!isPending) {
            setModalOpen(false);
            setStep("input");
            setCompletedPaymentId(null);
          }
        }}
        className="max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-700" /> Kasir Penerimaan Kas
          </DialogTitle>
          <DialogDescription>
            {step === "success"
              ? "Transaksi pembayaran selesai dan kwitansi sah telah diterbitkan."
              : step === "confirm"
              ? "Konfirmasi rincian transaksi sebelum membukukan ke buku kas."
              : "Pilih santri pembayar dan tentukan alokasi pelunasan tagihan."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <form onSubmit={handleProceedToConfirm} className="space-y-4">
            {/* Student Selection */}
            <Select
              label="Pilih Santri Pembayar *"
              required
              value={selectedStudentId}
              onChange={(e) => handleStudentSelect(e.target.value)}
            >
              <option value="">-- Pilih Santri --</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.fullName} (NIS: {st.nis})
                </option>
              ))}
            </Select>

            {/* Charges Allocation List */}
            {selectedStudentId && (
              <div className="space-y-2 border border-stone-200 rounded-lg p-3 bg-stone-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">
                    Daftar Tagihan Belum Terbayar:
                  </span>
                  {unpaidCharges.length > 0 && (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleAll(true)}
                        className="text-teal-700 hover:underline font-semibold cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-stone-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAll(false)}
                        className="text-stone-500 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                {unpaidCharges.length === 0 ? (
                  <div className="text-xs text-emerald-800 py-3 text-center bg-emerald-50 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-600" />
                    Santri ini tidak memiliki tagihan aktif (Seluruh tagihan telah lunas).
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {unpaidCharges.map((c) => {
                      const currentAlloc = allocationsMap[c.id] ?? c.remainingAmount;
                      return (
                        <div
                          key={c.id}
                          className="p-2.5 bg-white border border-stone-200 rounded-md flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-stone-900">{c.feeCategory.name}</div>
                            <div className="text-stone-500 flex items-center gap-2 mt-0.5">
                              <span>Periode: {c.period || "-"}</span>
                              {c.isOverdue && (
                                <Badge variant="danger" className="text-[10px] py-0 px-1.5">
                                  Terlambat
                                </Badge>
                              )}
                            </div>
                            <div className="text-stone-500 mt-0.5">
                              Sisa:{" "}
                              <span className="font-mono font-semibold text-stone-800">
                                Rp {c.remainingAmount.toLocaleString("id-ID")}
                              </span>
                            </div>
                          </div>

                          <div className="w-36">
                            <label className="block text-[10px] text-stone-500 uppercase font-semibold mb-0.5">
                              Alokasi (Rp)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={c.remainingAmount}
                              value={currentAlloc}
                              onChange={(e) =>
                                handleAllocationChange(c.id, Number(e.target.value))
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-stone-900 bg-stone-50 border border-stone-200 rounded-md text-right min-h-[36px]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Total, Method, Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Total Pembayaran (Rp) *"
                type="number"
                required
                min={1}
                value={paymentAmount}
                onChange={(e) =>
                  setPaymentAmount(e.target.value ? Number(e.target.value) : "")
                }
              />

              <Select
                label="Metode Pembayaran"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="CASH">CASH (Tunai)</option>
                <option value="TRANSFER">TRANSFER BANK</option>
                <option value="OTHER">LAINNYA</option>
              </Select>
            </div>

            <Input
              label="Catatan Transaksi"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Titipan wali via transfer BCA"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isPending || unpaidCharges.length === 0 || !paymentAmount}
                className="gap-1.5"
              >
                <span>Lanjut ke Konfirmasi</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "confirm" && (
          /* Step 2: Confirmation */
          <div className="space-y-4 animate-fade-in">
            <div className="bg-teal-50 border border-teal-200 p-3.5 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-teal-800 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                Konfirmasi Penerimaan Kas
              </div>
              <p className="text-xs text-teal-700">
                Pastikan fisik uang atau bukti transfer valid sebelum menekan proses. Kwitansi dan
                pencatatan buku kas akan otomatis dieksekusi secara atomik.
              </p>
            </div>

            <div className="space-y-1.5 text-xs border border-stone-200 rounded-lg p-3 bg-stone-50">
              <div className="flex justify-between py-1 border-b border-stone-200">
                <span className="text-stone-500">Santri Pembayar:</span>
                <span className="font-semibold text-stone-900">
                  {currentStudent?.fullName} (NIS: {currentStudent?.nis})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200">
                <span className="text-stone-500">Metode:</span>
                <span className="font-semibold text-stone-800">{paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-200">
                <span className="text-stone-500">Total Pembayaran:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  Rp {Number(paymentAmount).toLocaleString("id-ID")}
                </span>
              </div>
              {note && (
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Catatan:</span>
                  <span className="text-stone-700">{note}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-700">Rincian Alokasi Tagihan:</span>
              <div className="space-y-1 text-xs">
                {Object.entries(allocationsMap)
                  .filter(([_, amt]) => amt > 0)
                  .map(([chargeId, amt]) => {
                    const c = unpaidCharges.find((x) => x.id === chargeId);
                    return (
                      <div
                        key={chargeId}
                        className="flex justify-between p-2 bg-stone-100 rounded-md text-stone-800"
                      >
                        <span>
                          {c?.feeCategory?.name} ({c?.period || "-"})
                        </span>
                        <span className="font-mono font-semibold">
                          Rp {amt.toLocaleString("id-ID")}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("input")}
                disabled={isPending}
              >
                Kembali Edit
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isPending}
                onClick={handleExecutePayment}
                isLoading={isPending}
              >
                {isPending ? "Mengeksekusi Transaksi..." : "Proses & Terbitkan Kwitansi"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "success" && (
          /* Step 3: Success Feedback & Receipt Action */
          <div className="py-6 flex flex-col items-center text-center space-y-4 animate-fade-in">
            <SuccessCheck size="lg" className="text-teal-700" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-900">Pembayaran Berhasil Diterima</h3>
              <p className="text-xs text-stone-500 max-w-sm">
                Transaksi telah dibukukan secara atomik ke buku kas umum dan kwitansi sah telah diterbitkan.
              </p>
            </div>

            <div className="w-full max-w-sm rounded-lg border border-teal-200 bg-teal-50/70 p-3.5 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-teal-800">Santri:</span>
                <span className="font-semibold text-teal-950">
                  {currentStudent?.fullName} (NIS: {currentStudent?.nis})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-teal-800">Metode Pembayaran:</span>
                <span className="font-medium text-teal-950">{paymentMethod}</span>
              </div>
              <div className="flex justify-between border-t border-teal-200/60 pt-1">
                <span className="text-teal-800 font-semibold">Total Diterima:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  Rp {Number(paymentAmount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm pt-2">
              <Button
                type="button"
                variant="primary"
                className="w-full gap-1.5"
                onClick={() => {
                  if (completedPaymentId) {
                    setModalOpen(false);
                    setStep("input");
                    handleViewReceipt(completedPaymentId);
                  }
                }}
              >
                <Printer className="w-4 h-4" />
                <span>Lihat & Cetak Kwitansi</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setModalOpen(false);
                  setStep("input");
                  setCompletedPaymentId(null);
                  setSelectedStudentId("");
                  setUnpaidCharges([]);
                  setAllocationsMap({});
                  setPaymentAmount("");
                }}
              >
                Selesai
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Printable Receipt Modal */}
      {receiptModal && (
        <Dialog
          isOpen={!!receiptModal}
          onClose={() => setReceiptModal(null)}
          className="max-w-md print:max-w-none print:shadow-none print:border-none"
        >
          <div className="space-y-4 print:p-0">
            {/* Receipt Header */}
            <div className="flex items-start justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 uppercase tracking-tight">
                  {receiptModal.institution?.name || "NataSekolah"}
                </h3>
                <p className="text-xs text-stone-500">
                  {receiptModal.institution?.address || "Lembaga Pendidikan & Pesantren"}
                </p>
                {receiptModal.institution?.phone && (
                  <p className="text-xs text-stone-400">Telp: {receiptModal.institution.phone}</p>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-100 rounded border border-stone-200 text-stone-800 block">
                  {receiptModal.receiptNumber}
                </span>
                <span className="text-[10px] text-stone-400 uppercase tracking-widest mt-1 block">
                  Kwitansi Sah
                </span>
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="text-xs space-y-1.5 bg-stone-50 p-3 rounded-md border border-stone-200">
              <div className="flex justify-between">
                <span className="text-stone-500">Nama Santri:</span>
                <span className="font-semibold text-stone-900">
                  {receiptModal.paymentTransaction.student.fullName} (NIS:{" "}
                  {receiptModal.paymentTransaction.student.nis})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">No. Transaksi:</span>
                <span className="font-mono">{receiptModal.paymentTransaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Waktu Pembayaran:</span>
                <span>
                  {new Date(receiptModal.paymentTransaction.paymentDate).toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Petugas Kasir:</span>
                <span>{receiptModal.issuedBy.name}</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-stone-200 pt-3">
              <h4 className="text-xs font-semibold text-stone-700 mb-2">Rincian Pos Pembayaran:</h4>
              <div className="space-y-1.5 text-xs">
                {receiptModal.paymentTransaction.allocations.map((a: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex justify-between border-b border-dashed border-stone-200 pb-1"
                  >
                    <span className="text-stone-700">
                      {a.studentCharge.feeCategory.name}{" "}
                      {a.studentCharge.period ? `(${a.studentCharge.period})` : ""}
                    </span>
                    <span className="font-mono font-semibold">
                      Rp {a.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t border-stone-200 text-sm font-bold text-stone-900">
              <span>Total Diterima ({receiptModal.paymentTransaction.paymentMethod}):</span>
              <span className="text-emerald-800 text-base font-mono">
                Rp {receiptModal.paymentTransaction.amount.toLocaleString("id-ID")}
              </span>
            </div>

            {/* Footer Note */}
            <div className="pt-2 text-[11px] text-stone-500 italic text-center border-t border-stone-100">
              &ldquo;{receiptModal.footerNote}&rdquo;
            </div>

            {/* Action Bar */}
            <div className="pt-3 flex justify-between items-center print:hidden border-t border-stone-200">
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="w-4 h-4" /> Cetak Kwitansi
              </Button>

              <Button variant="secondary" size="sm" onClick={() => setReceiptModal(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
