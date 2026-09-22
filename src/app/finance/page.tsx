"use client";

import { useEffect, useState, useTransition } from "react";
import { NavHeader } from "../../components/nav-header";
import {
  getCashbookBalanceAction,
  listCashbookAction,
  listFeeCategoriesAction,
  listPaymentsAction,
  listStudentChargesAction,
  createFeeCategoryAction,
  createStudentChargeAction,
  createPaymentAction,
} from "../../actions/finance";

type Category = { id: string; code: string; name: string; isActive: boolean };
type Charge = { id: string; status: string; amount: number; discountAmount: number; student: { nis: string; fullName: string }; feeCategory: { code: string; name: string }; academicYear: { name: string } };
type Payment = { id: string; amount: number; method: string; status: string; paidAt: string | Date; charge: { student: { fullName: string }; feeCategory: { name: string } }; receipt: { receiptNumber: string } | null };

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function FinancePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState({ income: 0, expense: 0, balance: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [feeCategoryId, setFeeCategoryId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [paymentChargeId, setPaymentChargeId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const load = () => startTransition(async () => {
    setError(null);
    const [cat, ch, pay, bal] = await Promise.all([
      listFeeCategoriesAction({ activeOnly: false }),
      listStudentChargesAction({ page: 1, pageSize: 20 }),
      listPaymentsAction({ page: 1, pageSize: 10 }),
      getCashbookBalanceAction(),
    ]);
    if (cat.success && cat.data) setCategories(cat.data as Category[]);
    if (ch.success && ch.data) setCharges(ch.data.data as Charge[]);
    if (pay.success && pay.data) setPayments(pay.data.data as Payment[]);
    if (bal.success && bal.data) setBalance(bal.data);
    const firstError = [cat, ch, pay, bal].find((x) => !x.success);
    if (firstError && !firstError.success) setError(firstError.error);
  });

  useEffect(() => { load(); }, []);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, message: string) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const res = await fn();
      if (!res.success) setError(res.error || "Operasi gagal.");
      else { setSuccess(message); load(); }
    });
  };

  return (
    <div className="min-h-screen bg-stone-100/60 text-stone-900 pb-16">
      <NavHeader subtitle="Keuangan & Kas" />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Keuangan</h1>
          <p className="mt-1 text-sm text-stone-600">Tagihan, pembayaran, kuitansi, dan buku kas dalam satu alur transaksi.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs text-stone-500">Kas Masuk</p><p className="mt-1 text-xl font-bold">{rupiah(balance.income)}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs text-stone-500">Kas Keluar</p><p className="mt-1 text-xl font-bold">{rupiah(balance.expense)}</p></div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5"><p className="text-xs text-teal-700">Saldo Buku Kas</p><p className="mt-1 text-xl font-bold text-teal-900">{rupiah(balance.balance)}</p></div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={(e) => { e.preventDefault(); run(() => createFeeCategoryAction({ code: categoryCode, name: categoryName }), "Kategori tagihan dibuat."); }} className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <h2 className="font-bold">Kategori Tagihan</h2>
            <input value={categoryCode} onChange={(e) => setCategoryCode(e.target.value.toUpperCase())} placeholder="SPP" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Sumbangan Pembinaan Pendidikan" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <button disabled={pending} className="touch-target rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Tambah Kategori</button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); run(() => createStudentChargeAction({ studentId, feeCategoryId, academicYearId, amount: Number(chargeAmount), discountAmount: Number(discountAmount) }), "Tagihan siswa dibuat."); }} className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
            <h2 className="font-bold">Buat Tagihan</h2>
            <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <select value={feeCategoryId} onChange={(e) => setFeeCategoryId(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
              <option value="">Pilih kategori</option>
              {categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
            <input value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} placeholder="Academic Year ID" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3"><input value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} type="number" min="1" placeholder="Nominal" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /><input value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} type="number" min="0" placeholder="Diskon" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></div>
            <button disabled={pending} className="touch-target rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Simpan Tagihan</button>
          </form>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Catat Pembayaran</h2><p className="text-xs text-stone-500">Idempotency key mencegah pembayaran ganda dari retry.</p></div></div>
          <form onSubmit={(e) => { e.preventDefault(); run(() => createPaymentAction({ studentChargeId: paymentChargeId, amount: Number(paymentAmount), method: paymentMethod, idempotencyKey: crypto.randomUUID() }), "Pembayaran tercatat dan kuitansi diterbitkan."); }} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select value={paymentChargeId} onChange={(e) => setPaymentChargeId(e.target.value)} className="rounded-xl border border-stone-300 px-3 py-2 text-sm sm:col-span-2"><option value="">Pilih tagihan</option>{charges.filter((c) => c.status !== "VOID").map((c) => <option key={c.id} value={c.id}>{c.student.fullName} — {c.feeCategory.name} — {rupiah(c.amount - c.discountAmount)}</option>)}</select>
            <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} type="number" min="1" placeholder="Nominal bayar" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-xl border border-stone-300 px-3 py-2 text-sm"><option>CASH</option><option>TRANSFER</option><option>QRIS</option><option>OTHER</option></select>
            <button disabled={pending} className="touch-target rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-4">Catat Pembayaran & Terbitkan Kuitansi</button>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 overflow-x-auto">
            <h2 className="font-bold mb-4">Tagihan Terbaru</h2>
            <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-stone-500"><th className="py-2 pr-3">Siswa</th><th className="py-2 pr-3">Kategori</th><th className="py-2 pr-3">Nominal</th><th className="py-2">Status</th></tr></thead><tbody>{charges.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="py-2 pr-3">{c.student.fullName}<div className="text-xs text-stone-400">{c.student.nis}</div></td><td className="py-2 pr-3">{c.feeCategory.name}</td><td className="py-2 pr-3">{rupiah(c.amount - c.discountAmount)}</td><td className="py-2">{c.status}</td></tr>)}</tbody></table>
            {charges.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Belum ada tagihan.</p>}
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 overflow-x-auto">
            <h2 className="font-bold mb-4">Pembayaran Terbaru</h2>
            <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-stone-500"><th className="py-2 pr-3">Siswa</th><th className="py-2 pr-3">Nominal</th><th className="py-2 pr-3">Metode</th><th className="py-2">Kuitansi</th></tr></thead><tbody>{payments.map((p) => <tr key={p.id} className="border-b last:border-0"><td className="py-2 pr-3">{p.charge.student.fullName}<div className="text-xs text-stone-400">{p.charge.feeCategory.name}</div></td><td className="py-2 pr-3">{rupiah(p.amount)}</td><td className="py-2 pr-3">{p.method}</td><td className="py-2">{p.receipt?.receiptNumber || "-"}</td></tr>)}</tbody></table>
            {payments.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Belum ada pembayaran.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
