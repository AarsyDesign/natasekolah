"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  School,
  BookOpen,
  GraduationCap,
  Briefcase,
  ClipboardCheck,
  MessageSquare,
  CreditCard,
  FileCheck2,
  Award,
  BookMarked,
  Home,
  Search,
  Settings,
} from "lucide-react";
import { GlobalSearchDialog } from "./global-search-dialog";

export function NavHeader({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/teacher", label: "Workspace Guru", icon: GraduationCap },
    { href: "/settings", label: "Pengaturan", icon: Settings },
    { href: "/tahfidz", label: "Tahfidz", icon: BookMarked },
    { href: "/dormitories", label: "Asrama", icon: Home },
    { href: "/assessments", label: "Penilaian", icon: FileCheck2 },
    { href: "/reports", label: "Raport", icon: Award },
    { href: "/finance", label: "Keuangan", icon: CreditCard },
    { href: "/attendance", label: "Absensi", icon: ClipboardCheck },
    { href: "/notifications", label: "Outbox WA", icon: MessageSquare },
    { href: "/students", label: "Buku Induk", icon: Users },
    { href: "/academic-years", label: "Tahun Ajaran", icon: Calendar },
    { href: "/classrooms", label: "Rombel", icon: School },
    { href: "/subjects", label: "Mata Pelajaran", icon: BookOpen },
    { href: "/teachers", label: "Direktori Guru", icon: GraduationCap },
    { href: "/teacher-assignments", label: "Penugasan", icon: Briefcase },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Logo & Subtitle */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/dashboard"
                className="touch-target inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-stone-900 transition hover:text-teal-700"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white font-bold shadow-sm">
                  N
                </div>
                <div className="hidden sm:block">
                  <span className="text-base font-bold tracking-tight">NataSekolah</span>
                  {subtitle && (
                    <span className="block text-xs font-normal text-stone-500">{subtitle}</span>
                  )}
                </div>
              </Link>
            </div>

            {/* Quick Search Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="touch-target inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 shadow-2xs transition hover:border-stone-300 hover:bg-stone-50 focus:outline-hidden focus:ring-2 focus:ring-teal-700/20"
                aria-label="Cari data (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5 text-stone-400" />
                <span className="hidden md:inline">Cari siswa, rombel, guru...</span>
                <span className="md:hidden">Cari</span>
                <kbd className="hidden sm:inline-block rounded-xs bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 border border-stone-200">
                  Ctrl K
                </kbd>
              </button>
            </div>

            {/* Nav links scrollable */}
            <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  link.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`touch-target inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-teal-700 text-white shadow-2xs"
                        : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xl:inline">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Global Search Dialog Modal */}
      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
