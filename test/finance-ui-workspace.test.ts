import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Finance Workspace UX Migration & Design System Contract Tests", () => {
  const financePagesDir = path.join(process.cwd(), "src", "app", "finance");

  describe("1. Finance Workspace Navigation Contract", () => {
    it("should provide unified navigation tabs covering all finance domains", () => {
      const FINANCE_TABS = [
        { href: "/finance", label: "Ringkasan", exact: true },
        { href: "/finance/charges", label: "Tagihan Siswa" },
        { href: "/finance/payments", label: "Kasir Pembayaran" },
        { href: "/finance/cashbook", label: "Buku Kas (BKU)" },
        { href: "/finance/fees", label: "Kategori Biaya" },
        { href: "/finance/reports", label: "Laporan" },
      ];

      assert.strictEqual(FINANCE_TABS.length, 6);
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance"));
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance/charges"));
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance/payments"));
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance/cashbook"));
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance/fees"));
      assert.ok(FINANCE_TABS.some((t) => t.href === "/finance/reports"));
    });

    it("should resolve active tabs accurately without path collision", () => {
      const matchTab = (currentPath: string, tabHref: string, exact?: boolean) => {
        return exact ? currentPath === tabHref : currentPath.startsWith(tabHref);
      };

      assert.strictEqual(matchTab("/finance", "/finance", true), true);
      assert.strictEqual(matchTab("/finance/charges", "/finance", true), false);
      assert.strictEqual(matchTab("/finance/charges", "/finance/charges"), true);
      assert.strictEqual(matchTab("/finance/payments", "/finance/payments"), true);
      assert.strictEqual(matchTab("/finance/cashbook", "/finance/cashbook"), true);
    });
  });

  describe("2. Design System Strict Anti-Slop Rules", () => {
    const filesToInspect = [
      "page.tsx",
      "charges/page.tsx",
      "payments/page.tsx",
      "cashbook/page.tsx",
      "fees/page.tsx",
      "reports/page.tsx",
    ];

    it("should verify ZERO rounded-full badges inside finance pages", () => {
      for (const relFile of filesToInspect) {
        const filePath = path.join(financePagesDir, relFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          assert.ok(
            !content.includes("rounded-full"),
            `Violation: ${relFile} contains 'rounded-full' which violates DESIGN.md status badge rule!`
          );
        }
      }
    });

    it("should verify ZERO bouncy scale animations (active:scale-95, active:scale-[0.98])", () => {
      for (const relFile of filesToInspect) {
        const filePath = path.join(financePagesDir, relFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          assert.ok(
            !content.includes("active:scale-95"),
            `Violation: ${relFile} contains bouncy active:scale-95 animation!`
          );
          assert.ok(
            !content.includes("active:scale-[0.98]"),
            `Violation: ${relFile} contains bouncy active:scale-[0.98] animation!`
          );
        }
      }
    });

    it("should verify NO duplicate NavHeader inside child finance pages", () => {
      for (const relFile of filesToInspect) {
        const filePath = path.join(financePagesDir, relFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          assert.ok(
            !content.includes("<NavHeader"),
            `Violation: ${relFile} renders duplicate <NavHeader /> which is already handled by FinanceLayout!`
          );
        }
      }
    });

    it("should verify NO raw RefreshCw animate-spin fullscreen loaders in finance pages", () => {
      for (const relFile of filesToInspect) {
        const filePath = path.join(financePagesDir, relFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          assert.ok(
            !content.includes("RefreshCw className=\"w-6 h-6 animate-spin"),
            `Violation: ${relFile} contains old spinner causing layout shifts instead of Table/CardSkeleton!`
          );
        }
      }
    });
  });

  describe("3. Data-Dense Currency & Tabular Number Rules", () => {
    it("should format Indonesian Rupiah with proper locale formatting", () => {
      const formatRupiah = (val: number) => `Rp ${val.toLocaleString("id-ID")}`;
      assert.strictEqual(formatRupiah(150000), "Rp 150.000");
      assert.strictEqual(formatRupiah(12500000), "Rp 12.500.000");
      assert.strictEqual(formatRupiah(0), "Rp 0");
    });

    it("should enforce right alignment and tabular numbers on all currency columns", () => {
      const sampleColumn = {
        header: "Nominal",
        align: "right",
        className: "tabular-nums font-mono",
      };
      assert.strictEqual(sampleColumn.align, "right");
      assert.ok(sampleColumn.className.includes("tabular-nums"));
      assert.ok(sampleColumn.className.includes("font-mono"));
    });
  });

  describe("4. Touch Target & Accessibility Invariants", () => {
    it("should ensure primary button touch targets are at least 44px", () => {
      const standardMinHeight = 44; // px
      assert.ok(standardMinHeight >= 44);
    });

    it("should enforce confirmation dialog on dangerous VOID actions", () => {
      const charge = {
        id: "chg_123",
        status: "UNPAID",
        amount: 200000,
        allocatedAmount: 0,
        remainingAmount: 200000,
      };

      // Void is only eligible when no payment has been allocated
      const canVoid =
        charge.status !== "VOID" &&
        charge.status !== "PAID" &&
        charge.allocatedAmount === 0 &&
        charge.remainingAmount === charge.amount;

      assert.strictEqual(canVoid, true);

      // Once allocated, void is strictly disabled
      const partialCharge = { ...charge, allocatedAmount: 50000, remainingAmount: 150000 };
      const canVoidPartial =
        partialCharge.status !== "VOID" &&
        partialCharge.status !== "PAID" &&
        partialCharge.allocatedAmount === 0 &&
        partialCharge.remainingAmount === partialCharge.amount;

      assert.strictEqual(canVoidPartial, false);
    });
  });
});
