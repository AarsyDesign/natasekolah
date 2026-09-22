"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Calendar, School, BookOpen, GraduationCap, Briefcase, ClipboardCheck, WalletCards } from "lucide-react";

export function NavHeader({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/finance", label: "Keuangan", icon: WalletCards },
    { href: "/attendance", label: "Absensi", icon: ClipboardCheck },
    { href: "/students", label: "Buku Induk", icon: Users },
    { href: "/academic-years", label: "Tahun Ajaran", icon: Calendar },
    { href: "/classrooms", label: "Rombel", icon: School },
    { href: "/subjects", label: "Mata Pelajaran", icon: BookOpen },
    { href: "/teachers", label: "Direktori Guru", icon: GraduationCap },
    { href: "/teacher-assignments", label: "Penugasan", icon: Briefcase },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
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

          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`touch-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
