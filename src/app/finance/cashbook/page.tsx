"use client";

import { useState, useEffect, useTransition } from "react";
import {
  listCashbookEntriesAction,
  createCashbookEntryAction,
  getCashbookSummaryAction,
} from "@/actions/finance";
import { generateCashbookCSV, downloadCSV } from "@/lib/finance/export-utils";
import {
  DollarSign,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Receipt,
  FileText,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTableView, ColumnDef } from "@/components/data-dense/data-table-view";
import { TableSkeleton } from "@/components/loading/skeletons";

interface CashbookItem {
  id: string;
  entryNumber: string;
  entryDate: string;
  type: string;
  amount: number;
  description: string;
  paymentTransactionId?: string | null;
  paymentTransaction?: {
    transactionNumber: string;
    student: {
      fullName: string;
    };
  } | null;
  createdBy: {
    name: string;
  };
}

export default function CashbookPage() {
  const [items, setItems] = useState<CashbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    todayIncome: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);

  const [formType, setFormType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formDescription, setFormDescription] = useState("");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        listCashbookEntriesAction({
          search: search || undefined,
          type: typeFilter === "ALL" ? undefined : (typeFilter as any),
          limit: 100,
        }),
        getCashbookSummaryAction(),
      ]);

      if (listRes.success && listRes.data) {
        setItems(listRes.data.items as any);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load cashbook", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleOpenCreate = () => {
    setFormType("EXPENSE");
    setFormAmount("");
    setFormDescription("");
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formAmount === "" || !formDescription) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await createCashbookEntryAction({
          type: formType,
          amount: Number(formAmount),
          description: formDescription,
        });

        if (res.success) {
          setMessage({
            type: "success",
            text: `Mutasi kas [${formType === "EXPENSE" ? "PENGELUARAN" : "PEMASUKAN"}] berhasil dicatat.`,
          });
          setModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleExportCSV = () => {
    const csvContent = generateCashbookCSV(
      items.map((i) => ({
        entryNumber: i.entryNumber,
        entryDate: i.entryDate,
        type: i.type,
        amount: i.amount,
        description: i.description,
        createdByName: i.createdBy?.name,
        paymentRef: i.paymentTransaction
          ? `${i.paymentTransaction.transactionNumber} (${i.paymentTransaction.student.fullName})`
          : null,
      }))
    );
    downloadCSV(`Buku_Kas_Umum_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  const columns: ColumnDef<CashbookItem>[] = [
    {
      header: "No. Kas",
      align: "left",
      cell: (item) => (
        <span className="font-mono text-xs font-bold text-stone-900 leading-tight">
          {item.entryNumber}
        </span>
      ),
    },
    {
      header: "Tanggal & Waktu",
      align: "left",
      cell: (item) => (
        <span className="text-xs text-stone-600">
          {new Date(item.entryDate).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      header: "Jenis",
      align: "center",
      cell: (item) =>
        item.type === "INCOME" ? (
          <Badge variant="success">
            <ArrowUpRight className="w-3 h-3" /> Masuk
          </Badge>
        ) : (
          <Badge variant="danger">
            <ArrowDownRight className="w-3 h-3" /> Keluar
          </Badge>
        ),
    },
    {
      header: "Nominal",
      align: "right",
      cell: (item) => (
        <span
          className={`font-mono font-bold ${
            item.type === "INCOME" ? "text-emerald-800" : "text-rose-700"
          }`}
        >
          {item.type === "INCOME" ? "+" : "-"} Rp {item.amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Keterangan",
      align: "left",
      cell: (item) => (
        <span className="text-xs text-stone-800 max-w-xs block truncate" title={item.description}>
          {item.description}
        </span>
      ),
    },
    {
      header: "Sumber Mutasi",
      align: "left",
      cell: (item) =>
        item.paymentTransaction ? (
          <Badge variant="primary" className="text-[11px] gap-1">
            <Receipt className="w-3 h-3" /> Kasir Pembayaran
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-[11px] gap-1">
            <FileText className="w-3 h-3" /> Manual Operasional
          </Badge>
        ),
    },
    {
      header: "Petugas",
      align: "left",
      cell: (item) => (
        <span className="text-xs text-stone-600">{item.createdBy?.name || "-"}</span>
      ),
    },
  ];

  const renderMobileCard = (item: CashbookItem) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs font-bold text-stone-900">{item.entryNumber}</div>
          <div className="text-xs text-stone-500 mt-0.5">
            {new Date(item.entryDate).toLocaleDateString("id-ID")}
          </div>
        </div>
        <div
          className={`font-mono font-bold text-sm ${
            item.type === "INCOME" ? "text-emerald-800" : "text-rose-700"
          }`}
        >
          {item.type === "INCOME" ? "+" : "-"} Rp {item.amount.toLocaleString("id-ID")}
        </div>
      </div>

      <p className="text-xs text-stone-800 pt-1 border-t border-stone-100">{item.description}</p>

      <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500">
        <div className="flex items-center gap-1.5">
          {item.type === "INCOME" ? (
            <Badge variant="success" className="text-[10px] py-0">
              Masuk
            </Badge>
          ) : (
            <Badge variant="danger" className="text-[10px] py-0">
              Keluar
            </Badge>
          )}
          <span>{item.paymentTransaction ? "Kasir" : "Manual"}</span>
        </div>
        <span>Petugas: {item.createdBy?.name || "-"}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Workspace Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-700" /> Buku Kas Umum (BKU)
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Pencatatan arus kas masuk otomatis dari kasir dan mutasi pengeluaran operasional lembaga.
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
          <Button variant="primary" size="sm" onClick={handleOpenCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> Catat Kas Manual
          </Button>
        </div>
      </div>

      {/* Message Feedback */}
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

      {/* Summary Cards (Context Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Total Pemasukan
            </span>
            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-800 font-mono tabular-nums">
            Rp {summary.totalIncome.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500 mt-0.5 block">Kas masuk terakumulasi</span>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Total Pengeluaran
            </span>
            <div className="w-6 h-6 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-rose-700 font-mono tabular-nums">
            Rp {summary.totalExpense.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500 mt-0.5 block">Operasional & belanja</span>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Saldo Bersih BKU
            </span>
            <div className="w-6 h-6 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`text-base sm:text-lg font-bold font-mono tabular-nums ${
              summary.netBalance >= 0 ? "text-stone-900" : "text-rose-700"
            }`}
          >
            Rp {summary.netBalance.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500 mt-0.5 block">Total Masuk - Total Keluar</span>
        </Card>

        <Card className="p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Penerimaan Hari Ini
            </span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-800 font-mono tabular-nums">
            Rp {summary.todayIncome.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500 mt-0.5 block">Kasir pembayaran hari ini</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari no. kas (CSH-...) atau keterangan mutasi..."
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs py-2 min-h-[44px]"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="INCOME">Pemasukan (INCOME)</option>
              <option value="EXPENSE">Pengeluaran (EXPENSE)</option>
            </Select>
          </div>
          <Button variant="secondary" size="default" onClick={loadData}>
            Cari
          </Button>
        </div>
      </div>

      {/* Entries Data Table */}
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
              <DollarSign className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h4 className="font-semibold text-stone-800 text-sm">Belum Ada Catatan Kas</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {search || typeFilter !== "ALL"
                  ? "Tidak ada mutasi buku kas yang sesuai dengan kriteria filter."
                  : "Setiap transaksi pembayaran kasir dan pencatatan kas manual akan otomatis tercatat di sini."}
              </p>
            </div>
          }
        />
      )}

      {/* Manual Entry Modal */}
      <Dialog isOpen={modalOpen} onClose={() => setModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Mutasi Kas Manual</DialogTitle>
          <DialogDescription>
            Pencatatan kas operasional lembaga di luar transaksi kasir santri.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Jenis Mutasi *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormType("EXPENSE")}
                className={`touch-target px-3 py-2 text-xs font-semibold rounded-md border min-h-[44px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  formType === "EXPENSE"
                    ? "bg-rose-50 border-rose-300 text-rose-800 font-bold"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                <span>Pengeluaran</span>
              </button>

              <button
                type="button"
                onClick={() => setFormType("INCOME")}
                className={`touch-target px-3 py-2 text-xs font-semibold rounded-md border min-h-[44px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  formType === "INCOME"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span>Pemasukan Lain</span>
              </button>
            </div>
          </div>

          <Input
            label="Nominal (Rp) *"
            type="number"
            required
            min={1}
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value ? Number(e.target.value) : "")}
            placeholder="50000"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-700">
              Keterangan / Keperluan *
            </label>
            <textarea
              required
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Contoh: Pembelian spidol whiteboard dan ATK kantor"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700 text-stone-900 placeholder:text-stone-400"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={isPending}>
              Simpan Mutasi Kas
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
