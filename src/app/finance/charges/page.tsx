"use client";

import { useState, useEffect, useTransition } from "react";
import {
  listStudentChargesAction,
  createStudentChargeAction,
  bulkCreateStudentChargesAction,
  getTargetStudentsForBillingAction,
  getBillingSummaryAction,
  listFeeCategoriesAction,
  voidStudentChargeAction,
} from "@/actions/finance";
import { getStudentsAction, getClassroomsAction, getAcademicYearsAction } from "@/actions/academic";
import { generateChargesCSV, downloadCSV } from "@/lib/finance/export-utils";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Download,
  Users2,
  Calendar,
  AlertTriangle,
  Ban,
  ArrowRight,
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

interface ChargeItem {
  id: string;
  studentId: string;
  amount: number;
  allocatedAmount: number;
  remainingAmount: number;
  period?: string | null;
  dueDate?: string | null;
  status: string;
  isOverdue?: boolean;
  createdAt: string;
  student: {
    fullName: string;
    nis: string;
  };
  feeCategory: {
    code: string;
    name: string;
  };
}

export default function StudentChargesPage() {
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [summary, setSummary] = useState({
    totalChargesCount: 0,
    totalChargesAmount: 0,
    totalPaidAmount: 0,
    totalOutstandingAmount: 0,
    unpaidCount: 0,
    partialCount: 0,
    paidCount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });

  // Modal Single Charge
  const [modalOpen, setModalOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ id: string; fullName: string; nis: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; amount: number }>>([]);
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string }>>([]);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedFeeCategoryId, setSelectedFeeCategoryId] = useState("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [period, setPeriod] = useState("2026-09");
  const [dueDate, setDueDate] = useState("2026-10-10");
  const [amount, setAmount] = useState<number | "">("");

  // Modal Bulk Charges
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAcademicYear, setBulkAcademicYear] = useState("");
  const [bulkPeriod, setBulkPeriod] = useState("2026-09");
  const [bulkDueDate, setBulkDueDate] = useState("2026-10-10");
  const [bulkAmount, setBulkAmount] = useState<number | "">("");
  const [bulkTargetMode, setBulkTargetMode] = useState<"ALL" | "CLASSROOM">("ALL");
  const [bulkClassroomId, setBulkClassroomId] = useState("");
  const [bulkPreview, setBulkPreview] = useState<{
    totalStudents: number;
    eligibleCount: number;
    alreadyChargedCount: number;
    students: Array<{ id: string; fullName: string; nis: string; isAlreadyCharged: boolean }>;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Void confirmation state
  const [voidingItem, setVoidingItem] = useState<ChargeItem | null>(null);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [chargesRes, sumRes] = await Promise.all([
        listStudentChargesAction({
          search: search || undefined,
          status: statusFilter === "ALL" ? undefined : (statusFilter as any),
          limit: 100,
        }),
        getBillingSummaryAction(),
      ]);

      if (chargesRes.success && chargesRes.data) {
        setItems(chargesRes.data.items as any);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load charges", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadMasterData = async () => {
    try {
      const [stRes, catRes, ayRes, clRes] = await Promise.all([
        getStudentsAction({ limit: 100 }),
        listFeeCategoriesAction({ isActive: true, limit: 100 }),
        getAcademicYearsAction(),
        getClassroomsAction(),
      ]);
      if (stRes.success && stRes.data) setStudents(stRes.data.data as any);
      if (catRes.success && catRes.data) setCategories(catRes.data.items as any);
      if (ayRes.success && ayRes.data) setAcademicYears(ayRes.data as any);
      if (clRes.success && clRes.data) setClassrooms(clRes.data as any);
    } catch (err) {
      console.error("Failed loading master data", err);
    }
  };

  const handleOpenCreate = async () => {
    setSelectedStudentId("");
    setSelectedFeeCategoryId("");
    setSelectedAcademicYearId("");
    setPeriod("2026-09");
    setDueDate("2026-10-10");
    setAmount("");
    setModalOpen(true);
    await loadMasterData();
  };

  const handleOpenBulk = async () => {
    setBulkCategory("");
    setBulkAcademicYear("");
    setBulkPeriod("2026-09");
    setBulkDueDate("2026-10-10");
    setBulkAmount("");
    setBulkTargetMode("ALL");
    setBulkClassroomId("");
    setBulkPreview(null);
    setBulkModalOpen(true);
    await loadMasterData();
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedFeeCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat) setAmount(cat.amount);
  };

  const handleBulkCategoryChange = (catId: string) => {
    setBulkCategory(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      setBulkAmount(cat.amount);
    }
  };

  // Live candidate preview for bulk charges
  useEffect(() => {
    if (!bulkModalOpen || !bulkCategory) return;

    let isMounted = true;
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getTargetStudentsForBillingAction({
          classroomId: bulkTargetMode === "CLASSROOM" ? bulkClassroomId : null,
          feeCategoryId: bulkCategory,
          period: bulkPeriod || null,
          academicYearId: bulkAcademicYear || null,
        });

        if (isMounted && res.success && res.data) {
          setBulkPreview(res.data);
        }
      } catch (err) {
        console.error("Preview failed", err);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [bulkModalOpen, bulkCategory, bulkTargetMode, bulkClassroomId, bulkPeriod, bulkAcademicYear]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedFeeCategoryId || amount === "") return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await createStudentChargeAction({
          studentId: selectedStudentId,
          feeCategoryId: selectedFeeCategoryId,
          academicYearId: selectedAcademicYearId || null,
          period: period || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          amount: Number(amount),
        });

        if (res.success) {
          setMessage({ type: "success", text: "Kewajiban tagihan berhasil diterbitkan." });
          setModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCategory || bulkAmount === "" || !bulkPreview) return;

    const eligibleStudents = bulkPreview.students.filter((s) => !s.isAlreadyCharged);
    if (eligibleStudents.length === 0) {
      alert("Tidak ada siswa eligible yang belum memiliki tagihan pada periode ini.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await bulkCreateStudentChargesAction({
          studentIds: eligibleStudents.map((s) => s.id),
          feeCategoryId: bulkCategory,
          academicYearId: bulkAcademicYear || null,
          period: bulkPeriod || null,
          dueDate: bulkDueDate ? new Date(bulkDueDate) : null,
          amount: Number(bulkAmount),
        });

        if (res.success && res.data) {
          setMessage({
            type: "success",
            text: `Berhasil menerbitkan ${res.data.count} tagihan baru! (${res.data.skippedCount} siswa dilewati karena sudah memiliki tagihan).`,
          });
          setBulkModalOpen(false);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleVoidConfirm = () => {
    if (!voidingItem) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await voidStudentChargeAction(voidingItem.id);
        if (res.success) {
          setMessage({ type: "success", text: "Tagihan berhasil dibatalkan (VOID)." });
          setVoidingItem(null);
          loadData();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleExportCSV = () => {
    const csvContent = generateChargesCSV(
      items.map((i) => ({
        studentName: i.student.fullName,
        studentNis: i.student.nis,
        feeCategoryName: i.feeCategory.name,
        period: i.period,
        dueDate: i.dueDate,
        amount: i.amount,
        paidAmount: i.allocatedAmount,
        remainingAmount: i.remainingAmount,
        status: i.status,
        isOverdue: i.isOverdue,
      }))
    );
    downloadCSV(`Tagihan_Siswa_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  const renderStatusBadge = (status: string, isOverdue?: boolean) => {
    if (status === "PAID") {
      return (
        <Badge variant="success">
          <CheckCircle2 className="w-3 h-3" /> Lunas
        </Badge>
      );
    }
    if (status === "PARTIAL") {
      return (
        <Badge variant="info">
          <Clock className="w-3 h-3" /> Sebagian
        </Badge>
      );
    }
    if (status === "VOID") {
      return (
        <Badge variant="neutral">
          <XCircle className="w-3 h-3" /> Batal (VOID)
        </Badge>
      );
    }
    if (isOverdue) {
      return (
        <Badge variant="danger">
          <AlertCircle className="w-3 h-3" /> Lewat Batas
        </Badge>
      );
    }
    return (
      <Badge variant="warning">
        <Clock className="w-3 h-3" /> Belum Dibayar
      </Badge>
    );
  };

  const columns: ColumnDef<ChargeItem>[] = [
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
      header: "Kategori & Periode",
      align: "left",
      cell: (item) => (
        <div>
          <div className="font-medium text-stone-900 text-xs">{item.feeCategory.name}</div>
          <div className="text-[11px] text-stone-500">
            {item.period ? `Periode ${item.period}` : "Non-bulanan"}
          </div>
        </div>
      ),
    },
    {
      header: "Jatuh Tempo",
      align: "left",
      cell: (item) => (
        <div className="text-xs">
          {item.dueDate ? (
            <span className={item.isOverdue ? "text-rose-700 font-medium" : "text-stone-700"}>
              {new Date(item.dueDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : (
            <span className="text-stone-400">-</span>
          )}
        </div>
      ),
    },
    {
      header: "Nominal",
      align: "right",
      cell: (item) => (
        <span className="font-mono text-stone-900 font-medium">
          Rp {item.amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Terbayar",
      align: "right",
      cell: (item) => (
        <span className="font-mono text-emerald-800">
          Rp {item.allocatedAmount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Sisa Tagihan",
      align: "right",
      cell: (item) => (
        <span
          className={`font-mono font-semibold ${
            item.remainingAmount > 0 ? "text-stone-900" : "text-stone-400"
          }`}
        >
          Rp {item.remainingAmount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (item) => renderStatusBadge(item.status, item.isOverdue),
    },
    {
      header: "Aksi",
      align: "center",
      cell: (item) => {
        const canVoid =
          item.status !== "VOID" &&
          item.status !== "PAID" &&
          item.allocatedAmount === 0 &&
          item.remainingAmount === item.amount;

        if (!canVoid) {
          return <span className="text-xs text-stone-300">-</span>;
        }

        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoidingItem(item)}
            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 h-8 px-2 text-xs"
          >
            <Ban className="w-3.5 h-3.5 mr-1" /> VOID
          </Button>
        );
      },
    },
  ];

  const renderMobileCard = (item: ChargeItem) => (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900 text-sm">{item.student.fullName}</div>
          <div className="text-xs text-stone-500 font-mono">
            NIS: {item.student.nis} · {item.feeCategory.name}
          </div>
        </div>
        <div className="shrink-0">{renderStatusBadge(item.status, item.isOverdue)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-100">
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-400 block">Nominal</span>
          <span className="font-mono font-medium text-stone-800">
            Rp {item.amount.toLocaleString("id-ID")}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-400 block">Sisa Tagihan</span>
          <span className="font-mono font-bold text-stone-900">
            Rp {item.remainingAmount.toLocaleString("id-ID")}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-400 block">Jatuh Tempo</span>
          <span className="text-stone-700">
            {item.dueDate ? new Date(item.dueDate).toLocaleDateString("id-ID") : "-"}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-stone-400 block">Periode</span>
          <span className="text-stone-700">{item.period || "-"}</span>
        </div>
      </div>

      {item.status !== "VOID" &&
        item.status !== "PAID" &&
        item.allocatedAmount === 0 &&
        item.remainingAmount === item.amount && (
          <div className="pt-2 border-t border-stone-100 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVoidingItem(item)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8"
            >
              <Ban className="w-3.5 h-3.5 mr-1" /> Batalkan (VOID)
            </Button>
          </div>
        )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Control / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-700" /> Operasional Tagihan Siswa
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Penerbitan kewajiban syahriah snapshot per santri atau rombel dengan proteksi duplikasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={items.length === 0}
            className="gap-1.5"
          >
            <Download className="w-4 h-4 text-stone-600" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCreate}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4 text-stone-600" /> Tagihan Tunggal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenBulk}
            className="gap-1.5"
          >
            <Users2 className="w-4 h-4" /> Terbitkan Massal
          </Button>
        </div>
      </div>

      {/* Feedback Message */}
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

      {/* Operational Metrics Cards (Context Bar) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Total Tagihan
          </span>
          <div className="text-base sm:text-lg font-bold text-stone-900 font-mono tabular-nums">
            Rp {summary.totalChargesAmount.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500">{summary.totalChargesCount} kewajiban</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Sudah Terbayar
          </span>
          <div className="text-base sm:text-lg font-bold text-emerald-800 font-mono tabular-nums">
            Rp {summary.totalPaidAmount.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500">{summary.paidCount} lunas</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Sebagian (Cicil)
          </span>
          <div className="text-base sm:text-lg font-bold text-blue-800 font-mono tabular-nums">
            {summary.partialCount} tagihan
          </div>
          <span className="text-xs text-stone-500">Pembayaran parsial</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
            Sisa Tunggakan
          </span>
          <div className="text-base sm:text-lg font-bold text-amber-800 font-mono tabular-nums">
            Rp {summary.totalOutstandingAmount.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-stone-500">
            {summary.unpaidCount + summary.partialCount} tagihan
          </span>
        </Card>

        <Card className="p-3.5 border-rose-200 bg-rose-50/20 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block mb-1">
            Jatuh Tempo
          </span>
          <div className="text-base sm:text-lg font-bold text-rose-800 font-mono tabular-nums">
            Rp {summary.overdueAmount.toLocaleString("id-ID")}
          </div>
          <span className="text-xs text-rose-600 font-medium">
            {summary.overdueCount} tagihan lewat batas
          </span>
        </Card>
      </div>

      {/* Control Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama santri atau NIS..."
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-2 min-h-[44px]"
            >
              <option value="ALL">Semua Status</option>
              <option value="UNPAID">Belum Dibayar</option>
              <option value="PARTIAL">Cicilan / Sebagian</option>
              <option value="PAID">Lunas</option>
              <option value="VOID">Batal (VOID)</option>
            </Select>
          </div>
          <Button variant="secondary" size="default" onClick={loadData}>
            Cari
          </Button>
        </div>
      </div>

      {/* Data Table / Content Area */}
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
              <Receipt className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h4 className="font-semibold text-stone-800 text-sm">Tidak Ada Tagihan Ditemukan</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {search || statusFilter !== "ALL"
                  ? "Tidak ada tagihan yang sesuai dengan filter pencarian saat ini."
                  : "Belum ada tagihan kesiswaan yang diterbitkan. Klik 'Tagihan Tunggal' atau 'Terbitkan Massal'."}
              </p>
            </div>
          }
        />
      )}

      {/* Modal Single Charge */}
      <Dialog isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>Terbitkan Tagihan Tunggal</DialogTitle>
          <DialogDescription>
            Pilih santri dan pos kewajiban yang akan dibebankan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Pilih Santri *"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            required
          >
            <option value="">-- Pilih Santri --</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>
                {st.fullName} (NIS: {st.nis})
              </option>
            ))}
          </Select>

          <Select
            label="Kategori Biaya *"
            value={selectedFeeCategoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
          >
            <option value="">-- Pilih Kategori --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} - Rp {c.amount.toLocaleString("id-ID")}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Periode Tagihan"
              type="text"
              placeholder="Contoh: 2026-09"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              helperText="Format YYYY-MM untuk tagihan rutin"
            />
            <Input
              label="Jatuh Tempo"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <Input
            label="Nominal Tagihan (Rp) *"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0"
            required
            helperText="Nominal akan dibekukan (snapshot) pada tagihan ini"
          />

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
              Terbitkan Tagihan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Modal Bulk Charges */}
      <Dialog isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Penerbitan Tagihan Massal</DialogTitle>
          <DialogDescription>
            Terbitkan tagihan serentak per rombel atau seluruh santri dengan proteksi duplikasi otomatis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleBulkSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kategori Biaya *"
              value={bulkCategory}
              onChange={(e) => handleBulkCategoryChange(e.target.value)}
              required
            >
              <option value="">-- Pilih Kategori Biaya --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Input
              label="Nominal Tagihan (Rp) *"
              type="number"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Target Penerbitan"
              value={bulkTargetMode}
              onChange={(e) => setBulkTargetMode(e.target.value as any)}
            >
              <option value="ALL">Semua Santri Aktif</option>
              <option value="CLASSROOM">Rombel / Kelas Tertentu</option>
            </Select>

            {bulkTargetMode === "CLASSROOM" && (
              <Select
                label="Pilih Kelas *"
                value={bulkClassroomId}
                onChange={(e) => setBulkClassroomId(e.target.value)}
                required
              >
                <option value="">-- Pilih Kelas --</option>
                {classrooms.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="Periode Tagihan"
              type="text"
              placeholder="YYYY-MM (2026-09)"
              value={bulkPeriod}
              onChange={(e) => setBulkPeriod(e.target.value)}
            />
          </div>

          <Input
            label="Tanggal Jatuh Tempo"
            type="date"
            value={bulkDueDate}
            onChange={(e) => setBulkDueDate(e.target.value)}
          />

          {/* Live Candidate Preview */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-stone-600">
              <span>Hasil Verifikasi Kandidat</span>
              {previewLoading && <span className="text-teal-700 lowercase font-normal">memeriksa...</span>}
            </div>

            {bulkPreview ? (
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white p-2.5 rounded-md border border-stone-200">
                  <div className="text-xs text-stone-500">Total Santri</div>
                  <div className="text-base font-bold text-stone-900 font-mono">
                    {bulkPreview.totalStudents}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-md border border-emerald-200">
                  <div className="text-xs text-emerald-700 font-medium">Akan Diterbitkan</div>
                  <div className="text-base font-bold text-emerald-800 font-mono">
                    {bulkPreview.eligibleCount}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-md border border-amber-200">
                  <div className="text-xs text-amber-700 font-medium">Sudah Ada (Lewati)</div>
                  <div className="text-base font-bold text-amber-800 font-mono">
                    {bulkPreview.alreadyChargedCount}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Pilih kategori biaya untuk melihat estimasi calon penerima.</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkModalOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!bulkPreview || bulkPreview.eligibleCount === 0}
              isLoading={isPending}
            >
              Terbitkan {bulkPreview?.eligibleCount || 0} Tagihan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Confirmation Modal VOID */}
      <Dialog isOpen={!!voidingItem} onClose={() => setVoidingItem(null)}>
        <DialogHeader>
          <DialogTitle className="text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" /> Konfirmasi Pembatalan (VOID)
          </DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin membatalkan kewajiban tagihan ini? Tindakan ini bersifat permanen
            dan akan tercatat di log audit.
          </DialogDescription>
        </DialogHeader>

        {voidingItem && (
          <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3.5 text-xs text-stone-800 space-y-1.5 my-2">
            <div>
              <span className="font-semibold">Santri:</span> {voidingItem.student.fullName} (NIS:{" "}
              {voidingItem.student.nis})
            </div>
            <div>
              <span className="font-semibold">Kategori:</span> {voidingItem.feeCategory.name}
            </div>
            <div>
              <span className="font-semibold">Nominal:</span> Rp{" "}
              {voidingItem.amount.toLocaleString("id-ID")}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setVoidingItem(null)}
            disabled={isPending}
          >
            Kembali
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleVoidConfirm}
            isLoading={isPending}
          >
            Ya, Batalkan Tagihan (VOID)
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
