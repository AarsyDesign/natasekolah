"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
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
  RefreshCw,
  X,
  Ban,
  Download,
  Users2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Filter,
} from "lucide-react";

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
  const [voidingId, setVoidingId] = useState<string | null>(null);

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
    if (!voidingId) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const res = await voidStudentChargeAction(voidingId);
        if (res.success) {
          setMessage({ type: "success", text: "Tagihan berhasil dibatalkan (VOID)." });
          setVoidingId(null);
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

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    if (status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
        </span>
      );
    }
    if (status === "PARTIAL") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <Clock className="w-3.5 h-3.5" /> Sebagian
        </span>
      );
    }
    if (status === "VOID") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          <XCircle className="w-3.5 h-3.5" /> Batal (VOID)
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <AlertCircle className="w-3.5 h-3.5" /> Jatuh Tempo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        <Clock className="w-3.5 h-3.5" /> Belum Dibayar
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-purple-600" /> Operasional Tagihan Siswa
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Kewajiban tagihan kesiswaan per periode dengan nominal snapshot dan proteksi duplikasi
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              disabled={items.length === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-xs hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-800 font-medium rounded-xl shadow-xs hover:bg-slate-50 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Tagihan Tunggal
            </button>
            <button
              onClick={handleOpenBulk}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-xl shadow-xs hover:bg-purple-700 transition-all min-h-[44px]"
            >
              <Users2 className="w-4 h-4" /> Terbitkan Massal
            </button>
          </div>
        </div>

        {/* Message Banner */}
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

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
              Total Tagihan
            </span>
            <div className="text-lg font-bold text-slate-900">
              Rp {summary.totalChargesAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400">{summary.totalChargesCount} kewajiban</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
              Sudah Terbayar
            </span>
            <div className="text-lg font-bold text-emerald-700">
              Rp {summary.totalPaidAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400">{summary.paidCount} lunas</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
              Sebagian (Cicil)
            </span>
            <div className="text-lg font-bold text-blue-700">{summary.partialCount} tagihan</div>
            <span className="text-xs text-slate-400">Pembayaran parsial</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
              Belum Dibayar
            </span>
            <div className="text-lg font-bold text-amber-700">
              Rp {summary.totalOutstandingAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-slate-400">{summary.unpaidCount} tagihan</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs col-span-2 lg:col-span-1 bg-rose-50/30">
            <span className="text-xs font-medium text-rose-600 uppercase tracking-wider block mb-1">
              Jatuh Tempo (Overdue)
            </span>
            <div className="text-lg font-bold text-rose-700">
              Rp {summary.overdueAmount.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-rose-500 font-medium">{summary.overdueCount} tagihan terlambat</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
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
              placeholder="Cari nama siswa, NIS, atau nama biaya..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white min-h-[44px]"
            />
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
            >
              <option value="ALL">Semua Status</option>
              <option value="UNPAID">Belum Dibayar</option>
              <option value="PARTIAL">Dibayar Sebagian</option>
              <option value="PAID">Lunas</option>
              <option value="OVERDUE">Jatuh Tempo (Terlambat)</option>
              <option value="VOID">Batal (VOID)</option>
            </select>
          </div>
        </div>

        {/* Charges Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
            Memuat data tagihan siswa...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700">Belum Ada Tagihan</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Gunakan tombol di atas untuk menerbitkan tagihan tunggal atau massal ke siswa.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Siswa</th>
                    <th className="px-4 py-3">Komponen Biaya</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Terbayar</th>
                    <th className="px-4 py-3">Sisa</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{item.student.fullName}</div>
                        <div className="text-xs font-mono text-slate-400">NIS: {item.student.nis}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-800">{item.feeCategory.name}</span>
                        <span className="block text-xs font-mono text-slate-400">{item.feeCategory.code}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        {item.period || "-"}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {item.dueDate ? (
                          <span className={item.isOverdue ? "text-rose-600 font-semibold" : "text-slate-600"}>
                            {new Date(item.dueDate).toLocaleDateString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        Rp {item.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 text-blue-700 font-medium">
                        Rp {item.allocatedAmount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3.5 font-bold">
                        <span className={item.remainingAmount > 0 ? "text-rose-600" : "text-emerald-700"}>
                          Rp {item.remainingAmount.toLocaleString("id-ID")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(item.status, item.isOverdue)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {item.status !== "VOID" && item.allocatedAmount === 0 && (
                          <button
                            onClick={() => setVoidingId(item.id)}
                            title="Batalkan (Void) Tagihan Ini"
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal Single Charge */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Terbitkan Tagihan Tunggal</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Biaya</label>
                <select
                  required
                  value={selectedFeeCategoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                >
                  <option value="">-- Pilih Kategori Biaya --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Acuan: Rp {c.amount.toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Periode (YYYY-MM)</label>
                  <input
                    type="text"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026-09"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal Snapshot (Rp)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                    placeholder="150000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran (Opsional)</label>
                  <select
                    value={selectedAcademicYearId}
                    onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  >
                    <option value="">-- Umum --</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  />
                </div>
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
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 min-h-[44px]"
                >
                  {isPending ? "Menerbitkan..." : "Terbitkan Tagihan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bulk Charge Generation */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-purple-600" /> Terbitkan Tagihan Massal
                </h3>
                <p className="text-xs text-slate-500">
                  Buat kewajiban tagihan sekaligus untuk banyak siswa dengan proteksi tagihan ganda
                </p>
              </div>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Biaya <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={bulkCategory}
                    onChange={(e) => handleBulkCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  >
                    <option value="">-- Pilih Komponen Biaya --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Rp {c.amount.toLocaleString("id-ID")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nominal per Siswa (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Periode (YYYY-MM)</label>
                  <input
                    type="text"
                    value={bulkPeriod}
                    onChange={(e) => setBulkPeriod(e.target.value)}
                    placeholder="2026-09"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                  <select
                    value={bulkAcademicYear}
                    onChange={(e) => setBulkAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  >
                    <option value="">-- Semua Tahun --</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batas Jatuh Tempo</label>
                  <input
                    type="date"
                    value={bulkDueDate}
                    onChange={(e) => setBulkDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl min-h-[44px]"
                  />
                </div>
              </div>

              {/* Target Selection */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-800">Target Siswa Penerima</label>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="targetMode"
                      value="ALL"
                      checked={bulkTargetMode === "ALL"}
                      onChange={() => setBulkTargetMode("ALL")}
                      className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span>Semua Siswa Aktif</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="targetMode"
                      value="CLASSROOM"
                      checked={bulkTargetMode === "CLASSROOM"}
                      onChange={() => setBulkTargetMode("CLASSROOM")}
                      className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span>Per Rombel / Kelas Tertentu</span>
                  </label>
                </div>

                {bulkTargetMode === "CLASSROOM" && (
                  <div>
                    <select
                      value={bulkClassroomId}
                      onChange={(e) => setBulkClassroomId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl min-h-[44px]"
                    >
                      <option value="">-- Pilih Rombel / Kelas --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Preview Box */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Hasil Pratinjau Siswa
                  </h4>
                  {previewLoading && (
                    <span className="text-xs text-purple-600 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memeriksa status...
                    </span>
                  )}
                </div>

                {bulkPreview ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-500 block">Total Target</span>
                        <span className="font-bold text-slate-800 text-sm">{bulkPreview.totalStudents}</span>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="text-emerald-700 block">Siap Diterbitkan</span>
                        <span className="font-bold text-emerald-800 text-sm">{bulkPreview.eligibleCount}</span>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-amber-700 block">Sudah Ada (Dilewati)</span>
                        <span className="font-bold text-amber-800 text-sm">{bulkPreview.alreadyChargedCount}</span>
                      </div>
                    </div>

                    {bulkPreview.alreadyChargedCount > 0 && (
                      <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        Sistem mendeteksi {bulkPreview.alreadyChargedCount} siswa sudah memiliki tagihan aktif pada periode ini dan otomatis akan dilewati agar tidak terjadi tagihan ganda.
                      </p>
                    )}

                    {bulkPreview.eligibleCount === 0 && (
                      <p className="text-xs text-rose-600 font-medium text-center py-2">
                        Seluruh siswa target sudah memiliki tagihan ini untuk periode {bulkPeriod}.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-3">
                    Pilih kategori biaya untuk menampilkan pratinjau target siswa.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !bulkPreview || bulkPreview.eligibleCount === 0}
                  className="px-5 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-xl shadow-xs disabled:opacity-50 min-h-[44px]"
                >
                  {isPending
                    ? "Menerbitkan Tagihan..."
                    : `Terbitkan ${bulkPreview?.eligibleCount || 0} Tagihan Baru`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Void */}
      {voidingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-base">Batalkan (VOID) Tagihan?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tagihan ini belum memiliki pembayaran dan akan dibatalkan secara permanen dalam catatan audit. Tindakan ini tidak dapat diurungkan.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidingId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleVoidConfirm}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-xs min-h-[44px]"
              >
                {isPending ? "Membatalkan..." : "Ya, Batalkan Tagihan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
