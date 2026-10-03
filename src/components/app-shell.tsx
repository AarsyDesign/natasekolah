"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  CreditCard,
  ClipboardCheck,
  FileCheck2,
  Award,
  Users,
  Calendar,
  School,
  BookOpen,
  Briefcase,
  Home,
  BookMarked,
  LibraryBig,
  FileText,
  MessageSquare,
  Settings,
  Search,
  Menu,
  X,
  ChevronDown,
  UsersRound,
  ScrollText,
} from "lucide-react";
// Dialog pencarian hanya dimuat saat dibuka (Ctrl+K) — code split 12.4.
const GlobalSearchDialog = dynamic(
  () =>
    import("./global-search-dialog").then((m) => ({
      default: m.GlobalSearchDialog,
    })),
  { ssr: false, loading: () => null }
);
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from "./ui/dropdown";
import { ToastProvider } from "./ui/toast";
import { cn } from "../lib/utils";

// 1. App Shell Context for Subtitle & Title coordination
interface AppShellContextType {
  subtitle: string;
  setSubtitle: (subtitle: string) => void;
  isInsideShell: boolean;
}

const AppShellContext = createContext<AppShellContextType>({
  subtitle: "",
  setSubtitle: () => {},
  isInsideShell: false,
});

export const useAppShell = () => useContext(AppShellContext);

// Navigation Definitions
const PRIMARY_WORKSPACES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher", label: "Guru", icon: GraduationCap },
  { href: "/attendance", label: "Presensi", icon: ClipboardCheck },
  { href: "/finance", label: "Keuangan", icon: CreditCard },
  { href: "/assessments", label: "Penilaian", icon: FileCheck2 },
  { href: "/reports", label: "Raport", icon: Award },
];

const MASTER_DATA_ITEMS = [
  { href: "/students", label: "Buku Induk Siswa", icon: Users },
  { href: "/guardians", label: "Wali Murid", icon: UsersRound },
  { href: "/academic-years", label: "Tahun Ajaran", icon: Calendar },
  { href: "/classrooms", label: "Rombel / Kelas", icon: School },
  { href: "/subjects", label: "Mata Pelajaran", icon: BookOpen },
  { href: "/exams/question-bank", label: "Bank Soal", icon: LibraryBig },
  { href: "/exams/papers", label: "Naskah Ujian", icon: FileText },
  { href: "/teachers", label: "Direktori Guru", icon: GraduationCap },
  { href: "/teacher-assignments", label: "Penugasan Mengajar", icon: Briefcase },
  { href: "/dormitories", label: "Asrama Santri", icon: Home },
  { href: "/tahfidz", label: "Tahfidz & Mutaba'ah", icon: BookMarked },
  { href: "/notifications", label: "Outbox Notifikasi WA", icon: MessageSquare },
  { href: "/audit-log", label: "Jejak Audit", icon: ScrollText },
  { href: "/settings", label: "Pengaturan Lembaga", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [subtitle, setSubtitle] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
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

  // Close mobile menu on pathname change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isMasterDataActive = MASTER_DATA_ITEMS.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <AppShellContext.Provider value={{ subtitle, setSubtitle, isInsideShell: true }}>
      <ToastProvider>
        <div className="min-h-screen bg-[#fbfbfa] text-[#18181b] flex flex-col font-sans antialiased">
        {/* Persistent Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-md transition-shadow">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-3">
              {/* Brand & Subtitle */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/dashboard"
                  className="touch-target inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-stone-900 transition hover:text-teal-700"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white font-bold shadow-2xs">
                    N
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-base font-bold tracking-tight">NataSekolah</span>
                    {subtitle && (
                      <span className="block text-xs font-normal text-stone-500 line-clamp-1">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </Link>
              </div>

              {/* Center Quick Search Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="touch-target inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 shadow-2xs transition hover:border-stone-300 hover:bg-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
                  aria-label="Cari data (Ctrl+K)"
                >
                  <Search className="h-3.5 w-3.5 text-stone-400" />
                  <span className="hidden md:inline">Cari siswa, rombel, guru...</span>
                  <span className="md:hidden">Cari</span>
                  <kbd className="hidden sm:inline-block rounded-xs bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 border border-stone-200">
                    Ctrl K
                  </kbd>
                </button>
              </div>

              {/* Desktop 2-Level Navigation Links */}
              <nav className="hidden lg:flex items-center gap-1">
                {PRIMARY_WORKSPACES.map((link) => {
                  const Icon = link.icon;
                  const isActive =
                    link.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "touch-target inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none",
                        isActive
                          ? "bg-teal-700 text-white shadow-2xs"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {/* Level 2: Master Data Dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <div
                      className={cn(
                        "touch-target inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none",
                        isMasterDataActive
                          ? "bg-teal-50 text-teal-800 border border-teal-200"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      )}
                    >
                      <span>Kelola Lembaga</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </div>
                  </DropdownTrigger>
                  <DropdownContent align="right" className="w-56 p-1.5">
                    {MASTER_DATA_ITEMS.map((item) => {
                      const ItemIcon = item.icon;
                      const isItemActive = pathname.startsWith(item.href);

                      return (
                        <Link key={item.href} href={item.href} className="block">
                          <DropdownItem
                            className={cn(
                              "text-xs py-2",
                              isItemActive && "bg-teal-50 font-semibold text-teal-800"
                            )}
                          >
                            <ItemIcon className="h-4 w-4 text-stone-500 shrink-0" />
                            <span>{item.label}</span>
                          </DropdownItem>
                        </Link>
                      );
                    })}
                  </DropdownContent>
                </Dropdown>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Page Content Area */}
        <main className="flex-1 pb-24 lg:pb-12">
          <div key={pathname} className="animate-content-enter">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Thumb-Zone Friendly, min-h-[44px]) */}
        <nav
          aria-label="Navigasi Mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md px-2 py-1 shadow-md"
        >
          <div className="flex items-center justify-around">
            <Link
              href="/dashboard"
              className={cn(
                "touch-target flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-standard",
                pathname === "/dashboard" ? "text-teal-700 font-semibold" : "text-stone-500 hover:text-stone-900"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dasbor</span>
            </Link>

            <Link
              href="/teacher"
              className={cn(
                "touch-target flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-standard",
                pathname.startsWith("/teacher") ? "text-teal-700 font-semibold" : "text-stone-500 hover:text-stone-900"
              )}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Guru</span>
            </Link>

            <Link
              href="/attendance"
              className={cn(
                "touch-target flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-standard",
                pathname.startsWith("/attendance") ? "text-teal-700 font-semibold" : "text-stone-500 hover:text-stone-900"
              )}
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Presensi</span>
            </Link>

            <Link
              href="/finance"
              className={cn(
                "touch-target flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-standard",
                pathname.startsWith("/finance") ? "text-teal-700 font-semibold" : "text-stone-500 hover:text-stone-900"
              )}
            >
              <CreditCard className="h-4 w-4" />
              <span>Keuangan</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                "touch-target flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-md text-[11px] font-medium transition-colors duration-150 ease-standard",
                isMobileMenuOpen || isMasterDataActive
                  ? "text-teal-700 font-semibold"
                  : "text-stone-500 hover:text-stone-900"
              )}
              aria-label="Menu selengkapnya"
            >
              <Menu className="h-4 w-4" />
              <span>Menu</span>
            </button>
          </div>
        </nav>

        {/* Mobile Full Menu Drawer */}
        {isMobileMenuOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-xs lg:hidden animate-fade-in"
          >
            <div
              className="fixed inset-0"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-stone-200 bg-white p-5 shadow-lg animate-drawer-slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
                <h3 className="text-sm font-bold text-stone-900">Seluruh Menu NataSekolah</h3>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="touch-target p-1 text-stone-400 hover:text-stone-700"
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                    Aktivitas Harian
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIMARY_WORKSPACES.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "touch-target flex items-center gap-2.5 rounded-lg border border-stone-200 p-2.5 text-xs font-medium transition-colors",
                            isActive ? "bg-teal-50 border-teal-300 text-teal-900 font-semibold" : "hover:bg-stone-50 text-stone-700"
                          )}
                        >
                          <Icon className="h-4 w-4 text-teal-700 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                    Master Data & Administrasi
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {MASTER_DATA_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "touch-target flex items-center gap-2.5 rounded-lg border border-stone-200 p-2.5 text-xs font-medium transition-colors",
                            isActive ? "bg-teal-50 border-teal-300 text-teal-900 font-semibold" : "hover:bg-stone-50 text-stone-700"
                          )}
                        >
                          <Icon className="h-4 w-4 text-teal-700 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Search Dialog Modal (Single Singleton) */}
        <GlobalSearchDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </ToastProvider>
  </AppShellContext.Provider>
);
}
