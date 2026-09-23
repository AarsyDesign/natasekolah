"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  CreditCard,
  Award,
  BookMarked,
  Home,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
  User,
} from "lucide-react";
import { logoutGuardianAction } from "../actions/guardian";
import type { GuardianLinkedStudent } from "../lib/guardian/types";

interface GuardianNavProps {
  guardianName: string;
  institutionName: string;
  childrenList: GuardianLinkedStudent[];
  activeStudentId: string;
}

export function GuardianNav({
  guardianName,
  institutionName,
  childrenList,
  activeStudentId,
}: GuardianNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeChild =
    childrenList.find((c) => c.student.id === activeStudentId) || childrenList[0];

  const handleStudentChange = (newStudentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("studentId", newStudentId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar dari portal wali?")) {
      setIsLoggingOut(true);
      await logoutGuardianAction();
      window.location.href = "/login";
    }
  };

  const navLinks = [
    { href: "/wali", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/wali/kehadiran", label: "Kehadiran", icon: ClipboardCheck },
    { href: "/wali/keuangan", label: "Keuangan", icon: CreditCard },
    { href: "/wali/akademik", label: "Akademik", icon: Award },
    { href: "/wali/tahfidz", label: "Tahfidz", icon: BookMarked },
    { href: "/wali/asrama", label: "Asrama", icon: Home },
    { href: "/wali/notifikasi", label: "Notifikasi", icon: Bell },
  ];

  const bottomNavItems = [
    { href: "/wali", label: "Ringkasan", icon: LayoutDashboard, exact: true },
    { href: "/wali/kehadiran", label: "Kehadiran", icon: ClipboardCheck },
    { href: "/wali/keuangan", label: "Keuangan", icon: CreditCard },
    { href: "/wali/akademik", label: "Akademik", icon: Award },
  ];

  const isLinkActive = (itemHref: string, exact = false) => {
    if (exact) {
      return pathname === itemHref;
    }
    return pathname.startsWith(itemHref);
  };

  const studentQuery = activeStudentId ? `?studentId=${activeStudentId}` : "";

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            {/* Logo & Institution */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/wali${studentQuery}`}
                className="flex items-center gap-2.5 touch-target min-h-[44px] min-w-[44px]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white font-bold shadow-xs">
                  W
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-teal-700">
                    Portal Wali Murid
                  </span>
                  <span className="block truncate text-sm font-bold text-zinc-900">
                    {institutionName}
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isLinkActive(link.href, link.exact);
                return (
                  <Link
                    key={link.href}
                    href={`${link.href}${studentQuery}`}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition touch-target min-h-[44px] ${
                      active
                        ? "bg-teal-50 text-teal-800 font-semibold"
                        : "text-zinc-600 hover:bg-stone-100 hover:text-zinc-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Parent Profile & Logout */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <span className="block text-xs font-medium text-zinc-900">{guardianName}</span>
                <span className="block text-[11px] text-zinc-500">Wali Santri</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Keluar"
                className="hidden lg:flex items-center justify-center h-10 w-10 rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-700 transition touch-target min-h-[44px] min-w-[44px]"
              >
                <LogOut className="h-4 w-4" />
              </button>

              {/* Mobile Menu Button for Extra Items */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex lg:hidden items-center justify-center h-10 w-10 rounded-lg text-zinc-700 hover:bg-stone-100 transition touch-target min-h-[44px] min-w-[44px]"
                aria-label="Buka Menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Child Selector Banner (If multiple or single child) */}
          {childrenList.length > 0 && (
            <div className="border-t border-stone-100 py-2.5">
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-zinc-500">
                  <User className="h-3.5 w-3.5 text-teal-700" />
                  <span>Santri:</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {childrenList.map((c) => {
                    const isSelected = c.student.id === activeChild?.student.id;
                    const classroom = c.activeEnrollment?.classroom.name || "Belum ada kelas";
                    return (
                      <button
                        key={c.student.id}
                        type="button"
                        onClick={() => handleStudentChange(c.student.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition touch-target min-h-[44px] shrink-0 ${
                          isSelected
                            ? "bg-teal-700 text-white shadow-xs"
                            : "bg-stone-100 text-zinc-700 hover:bg-stone-200"
                        }`}
                      >
                        <span className="font-semibold">{c.student.fullName}</span>
                        <span
                          className={`text-[11px] ${
                            isSelected ? "text-teal-100" : "text-zinc-500"
                          }`}
                        >
                          ({classroom})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Menu (Menu Selengkapnya) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-2xl p-5 border-t border-stone-200 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Menu Portal Wali</h3>
                <p className="text-xs text-zinc-500">{guardianName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-700 touch-target min-h-[44px] min-w-[44px]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 py-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = isLinkActive(link.href, link.exact);
                return (
                  <Link
                    key={link.href}
                    href={`${link.href}${studentQuery}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition touch-target min-h-[48px] ${
                      active
                        ? "border-teal-600 bg-teal-50 text-teal-800 font-semibold"
                        : "border-stone-200 bg-stone-50 text-zinc-700 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-teal-700" : "text-zinc-500"}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 hover:bg-red-100 transition touch-target min-h-[48px]"
              >
                <LogOut className="h-4 w-4" />
                <span>Keluar dari Portal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Bar (Thumb-Zone First >= 44px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-2">
          <div className="grid grid-cols-5 h-16 items-center">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = isLinkActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${studentQuery}`}
                  className={`flex flex-col items-center justify-center gap-1 h-full touch-target min-h-[44px] transition ${
                    active ? "text-teal-700 font-semibold" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                  <span className="text-[10px] tracking-tight">{item.label}</span>
                </Link>
              );
            })}

            {/* Menu Lainnya Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center gap-1 h-full touch-target min-h-[44px] text-zinc-500 hover:text-zinc-800 transition"
            >
              <Menu className="h-5 w-5 stroke-[1.8]" />
              <span className="text-[10px] tracking-tight">Lainnya</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
