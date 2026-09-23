"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavHeader } from "../../components/nav-header";
import {
  Building2,
  Boxes,
  Languages,
  Sliders,
  Users2,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const settingsTabs = [
    { href: "/settings", label: "Ikhtisar", icon: LayoutDashboard, exact: true },
    { href: "/settings/institution", label: "Profil Lembaga", icon: Building2 },
    { href: "/settings/plugins", label: "Modul & Plugin", icon: Boxes },
    { href: "/settings/terminology", label: "Terminologi", icon: Languages },
    { href: "/settings/operations", label: "Aturan Operasional", icon: Sliders },
    { href: "/settings/users", label: "Pengguna & Akses", icon: Users2 },
  ];

  return (
    <div className="min-h-screen bg-stone-100/60 pb-16 font-sans text-stone-900">
      <NavHeader subtitle="Pengaturan & Konfigurasi" />

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Breadcrumb & Title */}
        <div className="mb-6 flex flex-col gap-2">
          <nav className="flex items-center gap-1.5 text-xs text-stone-500">
            <Link href="/dashboard" className="hover:text-teal-700">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/settings" className="hover:text-teal-700">
              Pengaturan
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Konfigurasi Lembaga
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              SaaS Multi-Tenant
            </span>
          </div>
          <p className="text-xs text-stone-500 sm:text-sm">
            Kelola profil resmi, modul domain aktif, kamus istilah, dan otorisasi staf internal lembaga.
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="mb-8 border-b border-stone-200 bg-white rounded-t-xl px-2 shadow-2xs">
          <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`touch-target inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                    isActive
                      ? "bg-teal-700 text-white shadow-2xs font-semibold"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Subpage Content */}
        {children}
      </main>
    </div>
  );
}
