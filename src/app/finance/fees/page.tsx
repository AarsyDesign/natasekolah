"use client";

import { useState, useEffect, useTransition } from "react";
import {
  listFeeCategoriesAction,
  createFeeCategoryAction,
  updateFeeCategoryAction,
} from "@/actions/finance";
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
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
import { DataTableView, ColumnDef } from "@/components/data-dense/data-table-view";
import { TableSkeleton } from "@/components/loading/skeletons";

interface FeeCategoryItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amount: number;
  frequency: string;
  isActive: boolean;
  createdAt: string;
}

export default function FeeCategoriesPage() {
  const [items, setItems] = useState<FeeCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState<number | "">("");
  const [formFrequency, setFormFrequency] = useState("MONTHLY");
  const [formIsActive, setFormIsActive] = useState(true);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listFeeCategoriesAction({ search: search || undefined, limit: 100 });
      if (res.success && res.data) {
        setItems(res.data.items as any);
      }
    } catch (err: unknown) {
      console.error("Failed to load fee categories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setFormCode("");
    setFormName("");
    setFormDesc("");
    setFormAmount("");
    setFormFrequency("MONTHLY");
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: FeeCategoryItem) => {
    setEditId(item.id);
    setFormCode(item.code);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormAmount(item.amount);
    setFormFrequency(item.frequency);
    setFormIsActive(item.isActive);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formName || formAmount === "") return;

    setMessage(null);
    startTransition(async () => {
      try {
        if (editId) {
          const res = await updateFeeCategoryAction(editId, {
            code: formCode,
            name: formName,
            description: formDesc || null,
            amount: Number(formAmount),
            frequency: formFrequency as any,
            isActive: formIsActive,
          });
          if (res.success) {
            setMessage({ type: "success", text: "Kategori biaya berhasil diperbarui." });
            setModalOpen(false);
            loadData();
          }
        } else {
          const res = await createFeeCategoryAction({
            code: formCode,
            name: formName,
            description: formDesc || null,
            amount: Number(formAmount),
            frequency: formFrequency as any,
            isActive: formIsActive,
          });
          if (res.success) {
            setMessage({ type: "success", text: "Kategori biaya baru berhasil dibuat." });
            setModalOpen(false);
            loadData();
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const columns: ColumnDef<FeeCategoryItem>[] = [
    {
      header: "Kode",
      align: "left",
      cell: (item) => (
        <span className="font-mono font-bold text-xs text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          {item.code}
        </span>
      ),
    },
    {
      header: "Nama Kategori",
      align: "left",
      cell: (item) => (
        <div>
          <div className="font-semibold text-stone-900 text-sm leading-tight">{item.name}</div>
          {item.description && (
            <div className="text-xs text-stone-500 mt-0.5">{item.description}</div>
          )}
        </div>
      ),
    },
    {
      header: "Frekuensi",
      align: "left",
      cell: (item) => (
        <span className="text-xs font-medium text-stone-700">{item.frequency}</span>
      ),
    },
    {
      header: "Nominal Acuan",
      align: "right",
      cell: (item) => (
        <span className="font-mono font-bold text-stone-900">
          Rp {item.amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      header: "Status",
      align: "center",
      cell: (item) =>
        item.isActive ? (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3" /> Aktif
          </Badge>
        ) : (
          <Badge variant="neutral">
            <XCircle className="w-3 h-3" /> Nonaktif
          </Badge>
        ),
    },
    {
      header: "Aksi",
      align: "right",
      cell: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleOpenEdit(item)}
          className="text-stone-600 hover:text-stone-900 h-8 px-2 text-xs"
        >
          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      ),
    },
  ];

  const renderMobileCard = (item: FeeCategoryItem) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
              {item.code}
            </span>
            <span className="font-semibold text-stone-900 text-sm">{item.name}</span>
          </div>
          {item.description && <p className="text-xs text-stone-500 mt-0.5">{item.description}</p>}
        </div>
        <div className="shrink-0">
          {item.isActive ? (
            <Badge variant="success" className="text-[10px] py-0">
              Aktif
            </Badge>
          ) : (
            <Badge variant="neutral" className="text-[10px] py-0">
              Nonaktif
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs text-stone-600">
        <span>Frekuensi: {item.frequency}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-stone-900">
            Rp {item.amount.toLocaleString("id-ID")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(item)}
            className="h-7 px-2 text-xs"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Workspace Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-700" /> Master Kategori Biaya
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Atur komponen biaya dan syahriah lembaga. Perubahan acuan tidak mengubah tagihan yang telah
            diterbitkan.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Kategori Baru
        </Button>
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

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          className="relative"
        >
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kode atau nama kategori biaya..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700 focus:border-teal-700 text-stone-900 min-h-[44px]"
          />
        </form>
      </div>

      {/* Data Table */}
      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : (
        <DataTableView
          data={items}
          columns={columns}
          keyExtractor={(item) => item.id}
          mobileCardRenderer={renderMobileCard}
          emptyState={
            <div className="py-6 text-center">
              <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <h4 className="font-semibold text-stone-800 text-sm">Belum Ada Kategori Biaya</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {search
                  ? "Tidak ada kategori biaya yang sesuai pencarian."
                  : "Buat kategori biaya baru untuk mulai menerbitkan tagihan syahriah santri."}
              </p>
            </div>
          }
        />
      )}

      {/* Modal Form */}
      <Dialog isOpen={modalOpen} onClose={() => setModalOpen(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editId ? "Edit Kategori Biaya" : "Tambah Kategori Biaya Baru"}
          </DialogTitle>
          <DialogDescription>
            Tentukan kode unik, nama, nominal acuan, dan siklus frekuensi tagihan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Kode Kategori *"
            type="text"
            required
            value={formCode}
            onChange={(e) => setFormCode(e.target.value.toUpperCase())}
            placeholder="Contoh: SPP, PANGKAL, SERAGAM"
            helperText="Gunakan huruf besar tanpa spasi"
          />

          <Input
            label="Nama Kategori Biaya *"
            type="text"
            required
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Contoh: SPP Syahriah Bulanan"
          />

          <Input
            label="Deskripsi"
            type="text"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Catatan tambahan (opsional)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nominal Acuan (Rp) *"
              type="number"
              required
              min={1}
              value={formAmount}
              onChange={(e) =>
                setFormAmount(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="150000"
            />

            <Select
              label="Frekuensi"
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value)}
            >
              <option value="MONTHLY">Bulanan (MONTHLY)</option>
              <option value="ONE_TIME">Satu Kali (ONE_TIME)</option>
              <option value="ANNUAL">Tahunan (ANNUAL)</option>
              <option value="CUSTOM">Khusus (CUSTOM)</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-teal-700 focus:ring-teal-700 border-stone-300"
            />
            <label htmlFor="isActive" className="text-xs font-semibold text-stone-700 cursor-pointer">
              Kategori Aktif (Dapat dipilih saat menerbitkan tagihan)
            </label>
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
              {editId ? "Simpan Perubahan" : "Simpan Kategori"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
