"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  DollarSign,
  BookOpen,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "../../lib/utils";

const FINANCE_TABS = [
  { href: "/finance", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/finance/charges", label: "Tagihan Siswa", icon: Receipt },
  { href: "/finance/payments", label: "Kasir Pembayaran", icon: CreditCard },
  { href: "/finance/cashbook", label: "Buku Kas (BKU)", icon: DollarSign },
  { href: "/finance/fees", label: "Kategori Biaya", icon: BookOpen },
  { href: "/finance/reports", label: "Laporan", icon: FileSpreadsheet },
];

export function FinanceWorkspaceNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
              Workspace Keuangan
            </h1>
            <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
              Kasir & Pembukuan
            </span>
          </div>
          <p className="text-xs text-stone-500 sm:text-sm mt-0.5">
            Pusat operasional penagihan syahriah, transaksi kasir, buku kas umum, dan laporan penerimaan.
          </p>
        </div>
      </div>

      {/* Internal Navigation Tabs (Desktop & Mobile Friendly, min-h-[44px]) */}
      <nav
        aria-label="Navigasi Keuangan"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-stone-200"
      >
        {FINANCE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "touch-target inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap select-none",
                isActive
                  ? "bg-teal-700 text-white font-semibold shadow-2xs"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
