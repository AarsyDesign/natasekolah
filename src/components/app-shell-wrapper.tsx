"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Route exclusions: Login, Landing Page, and Guardian Portal (which has its own GuardianNav shell)
  const isExcluded =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/wali");

  if (isExcluded) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
