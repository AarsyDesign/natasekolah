"use client";

/**
 * Phase 12.7 — UI Chat DKAS Bot (`/dkas`).
 *
 * Kirim pertanyaan bahasa natural → server action (`dkasQueryAction`) →
 * tampilkan baris hasil + ringkasan rencana query. Mode jawaban ditampilkan
 * apa adanya: `ai` (planner LLM) atau `rule` (aturan deterministik/fallback),
 * sehingga guru paham saat AI nonaktif tetap bisa bertanya.
 *
 * A11y: label form eksplisit, transkrip `role="log"` + `aria-live="polite"`,
 * indikator sibuk `aria-busy`, chip saran bisa dipakai lewat keyboard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Clock3,
  Loader2,
  Send,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { dkasCatalogAction, dkasQueryAction } from "@/actions/dkas";

interface ChatRow {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
}

interface BotMeta {
  datasetLabel?: string;
  dataset?: string;
  mode?: "ai" | "rule";
  aiFlagEnabled?: boolean;
  summary?: string;
  total?: number;
  truncated?: boolean;
  fallbackReason?: string | null;
}

interface ChatMessage {
  id: number;
  role: "user" | "bot";
  text: string;
  rows?: ChatRow[];
  meta?: BotMeta;
}

const FALLBACK_SAMPLES = [
  "Santri berstatus aktif",
  "Siswa yang alpha hari ini",
  "Nilai di bawah 70",
  "Izin yang belum disetujui",
];

let messageSeq = 0;

export function DkasChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: (messageSeq += 1),
      role: "bot",
      text: "Halo! Tanya data lembaga dengan bahasa sehari-hari — misalnya \"siswa yang alpha hari ini\" atau \"nilai di bawah 70\".",
      meta: { summary: "Jawaban hanya memuat data lembaga Anda sendiri." },
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState<string[]>(FALLBACK_SAMPLES);
  const [aiFlag, setAiFlag] = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await dkasCatalogAction();
      if (cancelled) return;
      if (res.success && res.data) {
        setAiFlag(res.data.aiFlagEnabled);
        const allowed = res.data.datasets
          .filter((d) => d.allowed)
          .flatMap((d) => d.samples.slice(0, 1));
        if (allowed.length > 0) setSamples(allowed.slice(0, 4));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: (messageSeq += 1), role: "user", text },
      ]);
      setBusy(true);
      try {
        const res = await dkasQueryAction({ query: text });
        if (res.success && res.data) {
          const d = res.data;
          setMessages((prev) => [
            ...prev,
            {
              id: (messageSeq += 1),
              role: "bot",
              text: d.total
                ? `Ketemu ${d.total} data${d.truncated ? ` (batas ${d.limit} baris)` : ""} di ${d.datasetLabel}.`
                : `Tidak ada data yang cocok di ${d.datasetLabel}.`,
              rows: d.rows,
              meta: {
                dataset: d.dataset,
                datasetLabel: d.datasetLabel,
                mode: d.mode,
                aiFlagEnabled: d.aiFlagEnabled,
                summary: d.summary,
                total: d.total,
                truncated: d.truncated,
                fallbackReason: d.fallbackReason,
              },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: (messageSeq += 1),
              role: "bot",
              text: (res as { error?: string }).error || "Gagal memproses pertanyaan.",
              meta: {},
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (messageSeq += 1),
            role: "bot",
            text: "Terjadi gangguan tak terduga. Coba lagi sebentar lagi.",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  return (
    <section className="mt-4 flex flex-col gap-4">
      {/* Status mode planner */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 font-medium text-teal-800">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          DKAS Bot aktif
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
            aiFlag
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-stone-200 bg-stone-100 text-stone-600"
          }`}
        >
          {aiFlag ? (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Planner AI aktif
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Mode aturan (AI nonaktif)
            </>
          )}
        </span>
        <span className="text-stone-500">
          Kuota: {busy ? "…" : "siap"} · maks. 50 baris per jawaban
        </span>
      </div>

      {/* Transkrip */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        aria-label="Percakapan DKAS Bot"
        className="max-h-[55vh] min-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-4 shadow-2xs"
      >
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.role === "user"
                  ? "self-end max-w-[85%] rounded-lg bg-teal-700 px-3 py-2 text-sm text-white"
                  : "self-start max-w-[95%] rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-800"
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>

              {m.meta?.summary && (
                <p className="mt-1 text-xs text-stone-500">{m.meta.summary}</p>
              )}

              {m.meta?.mode && m.rows && m.rows.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-medium text-stone-600">
                    {m.meta.datasetLabel}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 font-medium ${
                      m.meta.mode === "ai"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-white text-stone-500"
                    }`}
                  >
                    {m.meta.mode === "ai" ? "rencana: AI" : "rencana: aturan"}
                  </span>
                </p>
              )}

              {m.meta?.fallbackReason && (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700">
                  <TriangleAlert
                    className="mt-0.5 h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                  Planner AI tidak tersedia, dijawab dengan aturan lokal.
                </p>
              )}

              {m.rows && m.rows.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {m.rows.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900">
                          {r.title}
                        </span>
                        {r.badge && (
                          <span className="shrink-0 rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <span className="block text-xs text-stone-500">
                        {r.subtitle}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}

          {busy && (
            <li className="self-start flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Menyusun rencana query…
            </li>
          )}
        </ul>
      </div>

      {/* Saran cepat */}
      <div className="flex flex-wrap gap-2">
        {samples.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void ask(s)}
            disabled={busy}
            className="touch-target rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-2xs transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Form pertanyaan */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="dkas-question" className="sr-only">
          Pertanyaan data lembaga
        </label>
        <input
          id="dkas-question"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Tulis pertanyaan… (mis. siswa yang sakit minggu ini)"
          className="touch-target min-h-11 w-full flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length < 3}
          className="touch-target inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Tanya
        </button>
      </form>

      <p className="flex items-center gap-1.5 text-xs text-stone-500">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Pertanyaan dibatasi per pengguna; hanya data lembaga Anda yang bisa
        diakses (filter tenant selalu dipasang di server).
      </p>
    </section>
  );
}
