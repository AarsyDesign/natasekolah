import React from "react";
import { FinanceWorkspaceNav } from "../../components/finance/finance-workspace-nav";
import { NavHeader } from "../../components/nav-header";

export const metadata = {
  title: "Workspace Keuangan - NataSekolah",
  description: "Pusat kendali penagihan syahriah, kasir pembayaran, buku kas umum, dan laporan operasional.",
};

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#18181b] pb-16 font-sans">
      <NavHeader subtitle="Workspace Keuangan" />
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <FinanceWorkspaceNav />
        {children}
      </div>
    </div>
  );
}
