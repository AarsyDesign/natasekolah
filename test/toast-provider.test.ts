/**
 * Regresi: ToastProvider harus tersedia di ROOT layout.
 *
 * Bug Phase 11.1 (2026-10-03): halaman /login memakai `useToast()` tetapi
 * `ToastProvider` hanya dipasang di dalam `AppShell` — dan `AppShellWrapper`
 * mengecualikan `/login`, `/`, serta `/wali` dari shell → error
 * "useToast must be used within a ToastProvider" → error boundary
 * ("Terjadi gangguan tak terduga") tampil saat pengguna membuka halaman login.
 *
 * Test ini memastikan provider tetap global sehingga halaman di luar shell
 * tetap bisa memakai toast.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = () => readFileSync("src/app/layout.tsx", "utf8");
const shell = () => readFileSync("src/components/app-shell.tsx", "utf8");
const shellWrapper = () => readFileSync("src/components/app-shell-wrapper.tsx", "utf8");
const login = () => readFileSync("src/app/login/page.tsx", "utf8");

describe("ToastProvider — cakupan global (regresi login crash)", () => {
  it("root layout membungkus seluruh aplikasi dengan ToastProvider", () => {
    assert.match(layout(), /import \{ ToastProvider \} from "\.\.\/components\/ui\/toast"/);
    assert.match(layout(), /<ToastProvider>/);
    assert.match(layout(), /<\/ToastProvider>/);
    // provider harus membungkus AppShellWrapper sehingga mencakup route di luar shell
    assert.match(layout(), /<ToastProvider>\s*<AppShellWrapper>/);
  });

  it("AppShellWrapper tetap mengecualikan /login dari shell (dan karena itu membutuhkan provider global)", () => {
    const src = shellWrapper();
    assert.match(src, /pathname === "\/"/);
    assert.match(src, /pathname === "\/login"/);
    assert.match(src, /pathname\.startsWith\("\/wali"\)/);
  });

  it("halaman login memakai useToast — aman hanya bila provider ada di layout", () => {
    assert.match(login(), /useToast\(\)/);
    // shell tidak lagi memasang provider sendiri (hindari provider ganda)
    assert.doesNotMatch(shell(), /<ToastProvider>/);
    assert.doesNotMatch(shell(), /<\/ToastProvider>/);
  });
});
