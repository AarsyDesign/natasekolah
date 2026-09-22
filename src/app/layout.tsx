import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NataSekolah - Menata Pendidikan, Merapikan Masa Depan",
  description: "Pusat data dan operasional terpadu sekolah, pesantren, rumah tahfidz, dan PKBM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-[#fbfbfa] text-[#18181b] antialiased selection:bg-[#0f766e] selection:text-white">
        {children}
      </body>
    </html>
  );
}
