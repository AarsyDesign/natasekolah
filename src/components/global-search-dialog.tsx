"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  GraduationCap,
  School,
  User,
  Users,
  ArrowRight,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { searchGlobalAction } from "../actions/operations";
import type { GlobalSearchResultItem, SearchEntityType } from "../lib/operations/types";
import { highlightSearchMatches } from "../lib/operations/search-highlight";

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Render teks dengan bagian yang cocok dengan kueri dibungkus <mark>.
 * Segmen dibangun dari `highlightSearchMatches` (murni, teruji unit test)
 * sehingga tidak ada innerHTML / injection.
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightSearchMatches(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.matched ? (
          <mark
            key={i}
            className="rounded-xs bg-amber-100 px-0.5 text-amber-900"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function GlobalSearchDialog({ isOpen, onClose }: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchGlobalAction(trimmed);
        if (res.success && res.data) {
          setResults(res.data);
          setSelectedIndex(0);
        } else {
          setResults([]);
        }
        setHasSearched(true);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation through search results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: GlobalSearchResultItem) => {
    onClose();
    router.push(item.href);
  };

  if (!isOpen) return null;

  const renderIcon = (type: SearchEntityType) => {
    switch (type) {
      case "STUDENT":
        return <GraduationCap className="h-4 w-4 text-teal-700" />;
      case "CLASSROOM":
        return <School className="h-4 w-4 text-emerald-700" />;
      case "TEACHER":
        return <User className="h-4 w-4 text-sky-700" />;
      case "GUARDIAN":
        return <Users className="h-4 w-4 text-amber-700" />;
    }
  };

  const getTypeLabel = (type: SearchEntityType) => {
    switch (type) {
      case "STUDENT":
        return "Siswa";
      case "CLASSROOM":
        return "Rombel";
      case "TEACHER":
        return "Guru/Staf";
      case "GUARDIAN":
        return "Wali Murid";
    }
  };

  return (
    // Backdrop click-to-close adalah pola modal standar; area dialog sendiri
    // tetap interaktif lewat kontrol di dalamnya.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-stone-900/50 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl animate-modal-enter">
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-stone-200 px-4">
          <Search className="h-5 w-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Cari siswa, NIS, rombel, guru, atau wali murid..."
            className="w-full bg-transparent px-3 py-4 text-sm text-stone-900 placeholder-stone-400 focus:outline-hidden"
          />
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-teal-700 shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery("")}
              className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="hidden sm:inline-block rounded-md border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
              ESC
            </span>
          )}
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-stone-500">
              <Search className="mx-auto mb-2 h-7 w-7 text-stone-300" />
              <p className="font-medium text-stone-700">Pencarian Cepat NataSekolah</p>
              <p className="mt-1 text-xs text-stone-500">
                Ketik minimal 2 karakter nama, nomor induk, rombel, atau nomor WA.
              </p>
            </div>
          ) : results.length === 0 && hasSearched && !isPending ? (
            <div className="px-4 py-8 text-center text-sm text-stone-500">
              <p className="font-medium text-stone-700">Tidak ada hasil ditemukan</p>
              <p className="mt-1 text-xs text-stone-500">
                Tidak ada data yang cocok dengan &ldquo;{query}&rdquo; pada lembaga ini.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition min-h-[44px] ${
                        isSelected
                          ? "bg-teal-50 text-teal-950"
                          : "text-stone-800 hover:bg-stone-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            isSelected ? "bg-teal-100" : "bg-stone-100"
                          }`}
                        >
                          {renderIcon(item.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              <HighlightedText text={item.title} query={query} />
                            </span>
                            <span className="shrink-0 rounded-xs bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                              {getTypeLabel(item.type)}
                            </span>
                            {item.badge && item.badge !== item.title && (
                              <span className="shrink-0 rounded-xs bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-stone-500">
                            <HighlightedText text={item.subtitle} query={query} />
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 pl-2 text-stone-400 group-hover:text-teal-700 shrink-0">
                        {isSelected && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-teal-600 mr-1" />
                        )}
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-4 py-2 text-xs text-stone-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigasi</span>
            <span>↵ Buka</span>
          </div>
          <span>Terisolasi per lembaga</span>
        </div>
      </div>
    </div>
  );
}
