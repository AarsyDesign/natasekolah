"use client";

import { useState, useEffect, useTransition } from "react";
import { NavHeader } from "@/components/nav-header";
import {
  listNotificationsAction,
  processOutboxQueueAction,
  cancelNotificationAction,
} from "@/actions/notification";
import {
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
  Filter,
} from "lucide-react";

interface NotificationItem {
  id: string;
  recipient: string;
  templateKey: string;
  status: string;
  channel: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  externalId?: string | null;
  nextRetryAt?: string | null;
  payloadJson?: string | null;
  createdAt: string;
}

const TEMPLATE_OPTIONS = [
  { value: "ALL", label: "Semua Template" },
  { value: "PAYMENT_RECEIPT", label: "Kwitansi Pembayaran" },
  { value: "ATTENDANCE_ALERT", label: "Peringatan Kehadiran" },
  { value: "REPORT_CARD_PUBLISHED", label: "Penerbitan Raport" },
  { value: "GUARDIAN_INVITE", label: "Undangan Wali" },
  { value: "ANNOUNCEMENT", label: "Pengumuman" },
  { value: "CUSTOM_ALERT", label: "Pemberitahuan Kustom" },
];

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [templateFilter, setTemplateFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await listNotificationsAction({
        status: statusFilter === "ALL" ? undefined : (statusFilter as any),
        templateKey: templateFilter === "ALL" ? undefined : (templateFilter as any),
        channel: channelFilter === "ALL" ? undefined : (channelFilter as any),
        search: searchQuery || undefined,
        limit: 50,
      });

      if (res.success && res.data) {
        setItems(res.data.items as any);
        setTotal(res.data.total);
      }
    } catch (err: unknown) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [statusFilter, templateFilter, channelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotifications();
  };

  const handleProcessOutbox = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await processOutboxQueueAction(20, "DEEPLINK");
        if (res.success && res.data) {
          setMessage({
            type: "success",
            text: `Antrean diproses: ${res.data.succeeded} berhasil, ${res.data.failed} gagal.`,
          });
          loadNotifications();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const handleCancel = (id: string) => {
    if (!confirm("Batalkan pengiriman notifikasi ini?")) return;
    startTransition(async () => {
      try {
        const res = await cancelNotificationAction(id);
        if (res.success) {
          setMessage({ type: "success", text: "Notifikasi berhasil dibatalkan." });
          loadNotifications();
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setMessage({ type: "error", text: errorMsg });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Terkirim
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memproses
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> Gagal
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" /> Batal
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Antrean
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <NavHeader />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-emerald-600" /> Outbox WhatsApp & Notifikasi
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pemantauan antrean pengiriman notifikasi otomatis lintas modul (Total: {total} item)
            </p>
          </div>

          <button
            onClick={handleProcessOutbox}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[44px]"
          >
            <Send className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            Proses Antrean Outbox
          </button>
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-xs font-bold underline ml-2 min-h-[44px] px-2 flex items-center"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor tujuan (628...) atau kata kunci pesan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[44px]"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* Status Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "PENDING", "PROCESSING", "DELIVERED", "FAILED", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border min-h-[44px] ${
                    statusFilter === st
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {st === "ALL" ? "Semua Status" : st}
                </button>
              ))}
            </div>

            {/* Template Selector */}
            <div className="ml-auto flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
              >
                <option value="ALL">Semua Channel</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Memuat data outbox notifikasi...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            Tidak ada notifikasi dalam antrean untuk kriteria ini.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              let parsedPayload: Record<string, any> = {};
              try {
                parsedPayload = JSON.parse(item.payloadJson || "{}");
              } catch {
                // Ignore parse error
              }

              return (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.recipient}</span>
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                        {item.templateKey}
                      </span>
                      {parsedPayload._idempotencyKey && (
                        <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                          Key: {parsedPayload._idempotencyKey}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.status)}
                      <span className="text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>

                  {item.errorMessage && (
                    <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100 mb-2">
                      Error: {item.errorMessage}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 gap-2">
                    <div className="flex items-center gap-3">
                      <span>
                        Percobaan: {item.attempts} / {item.maxAttempts}
                      </span>
                      {item.nextRetryAt && (
                        <span className="text-amber-600 font-medium">
                          Retry: {new Date(item.nextRetryAt).toLocaleTimeString("id-ID")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {item.externalId?.startsWith("https://wa.me") && (
                        <a
                          href={item.externalId}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 font-semibold hover:underline min-h-[44px] py-1"
                        >
                          Buka WA DeepLink <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {(item.status === "PENDING" || item.status === "FAILED") && (
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="text-rose-600 font-medium hover:underline min-h-[44px] py-1"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
