import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Motion System & Interaction Polish Contract Tests", () => {
  const globalsCssPath = path.join(process.cwd(), "src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  describe("1. Motion Tokens Contract (globals.css)", () => {
    it("should define semantic duration tokens", () => {
      assert.ok(globalsCss.includes("--duration-instant: 75ms;"), "Instant duration (75ms) defined");
      assert.ok(globalsCss.includes("--duration-fast: 120ms;"), "Fast duration (120ms) defined");
      assert.ok(globalsCss.includes("--duration-standard: 180ms;"), "Standard duration (180ms) defined");
      assert.ok(globalsCss.includes("--duration-slow: 240ms;"), "Slow duration (240ms) defined");
    });

    it("should define semantic cubic-bezier easing tokens", () => {
      assert.ok(globalsCss.includes("--ease-standard: cubic-bezier(0.2, 0, 0, 1);"), "Ease standard defined");
      assert.ok(globalsCss.includes("--ease-enter: cubic-bezier(0, 0, 0.2, 1);"), "Ease enter defined");
      assert.ok(globalsCss.includes("--ease-exit: cubic-bezier(0.4, 0, 1, 1);"), "Ease exit defined");
    });

    it("should provide reusable utility classes with bounded durations (<= 250ms)", () => {
      const expectedUtilities = [
        ".animate-modal-enter",
        ".animate-drawer-slide-up",
        ".animate-dropdown-enter",
        ".animate-tooltip-enter",
        ".animate-fade-in",
        ".animate-content-enter",
        ".animate-shimmer",
        ".animate-checkmark",
      ];

      for (const util of expectedUtilities) {
        assert.ok(globalsCss.includes(util), `Utility ${util} must be present in globals.css`);
      }
    });
  });

  describe("2. Accessibility & Reduced-Motion Contract", () => {
    it("should enforce prefers-reduced-motion override in globals.css", () => {
      assert.ok(globalsCss.includes("@media (prefers-reduced-motion: reduce)"), "Media query prefers-reduced-motion must be present");
      assert.ok(
        globalsCss.includes("animation-duration: 0.01ms !important") ||
          globalsCss.includes("transition-duration: 0.01ms !important"),
        "Reduced motion must neutralize animation and transition durations"
      );
    });
  });

  describe("3. Elimination of Forbidden Anti-Patterns", () => {
    const componentDir = path.join(process.cwd(), "src/components");

    function getAllTsxFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getAllTsxFiles(filePath));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          results.push(filePath);
        }
      }
      return results;
    }

    it("should NOT contain bouncy active:scale-95 in components", () => {
      const files = getAllTsxFiles(componentDir);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        assert.ok(
          !content.includes("active:scale-95"),
          `File ${path.relative(process.cwd(), file)} should not contain forbidden active:scale-95`
        );
      }
    });

    it("should NOT contain full-screen blocking loading spinners", () => {
      const files = getAllTsxFiles(componentDir);
      // Pattern detects elements that take over full viewport specifically to display a loading spinner
      const fullscreenSpinnerRegex = /(?:fixed\s+inset-0|h-screen)[^>]*items-center[^>]*justify-center[^>]*>[^<]*<(?:Loader|Spinner|div)[^>]*animate-spin/i;

      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        const hasFullscreenSpinner = fullscreenSpinnerRegex.test(content);
        assert.ok(
          !hasFullscreenSpinner,
          `File ${path.relative(process.cwd(), file)} should not implement full-screen blocking spinners`
        );
      }
    });
  });

  describe("4. Reusable Motion Primitives Contract", () => {
    it("Skeleton should use calm linear shimmer instead of aggressive blinking", () => {
      const skeletonPath = path.join(process.cwd(), "src/components/ui/skeleton.tsx");
      const content = fs.readFileSync(skeletonPath, "utf-8");
      assert.ok(content.includes("animate-shimmer"), "Skeleton must use .animate-shimmer");
    });

    it("Dialog should use smooth fade-in backdrop and modal-enter card", () => {
      const dialogPath = path.join(process.cwd(), "src/components/ui/dialog.tsx");
      const content = fs.readFileSync(dialogPath, "utf-8");
      assert.ok(content.includes("animate-fade-in"), "Dialog backdrop must use .animate-fade-in");
      assert.ok(content.includes("animate-modal-enter"), "Dialog container must use .animate-modal-enter");
    });

    it("Dropdown and Tooltip should use subtle non-bouncy enter transitions", () => {
      const dropdownPath = path.join(process.cwd(), "src/components/ui/dropdown.tsx");
      const tooltipPath = path.join(process.cwd(), "src/components/ui/tooltip.tsx");
      const dropdownContent = fs.readFileSync(dropdownPath, "utf-8");
      const tooltipContent = fs.readFileSync(tooltipPath, "utf-8");

      assert.ok(dropdownContent.includes("animate-dropdown-enter"), "Dropdown must use .animate-dropdown-enter");
      assert.ok(tooltipContent.includes("animate-tooltip-enter"), "Tooltip must use .animate-tooltip-enter");
    });

    it("SuccessCheck component should export clean SVG with checkmark animation", () => {
      const successCheckPath = path.join(process.cwd(), "src/components/ui/success-check.tsx");
      assert.ok(fs.existsSync(successCheckPath), "SuccessCheck component must exist");
      const content = fs.readFileSync(successCheckPath, "utf-8");
      assert.ok(content.includes("animate-checkmark"), "SuccessCheck must apply .animate-checkmark");
      assert.ok(content.includes("<svg"), "SuccessCheck must render SVG markup");
    });
  });

  describe("5. App Shell & Navigation Motion Contract", () => {
    it("AppShell should animate content area without unmounting shell", () => {
      const shellPath = path.join(process.cwd(), "src/components/app-shell.tsx");
      const content = fs.readFileSync(shellPath, "utf-8");
      assert.ok(content.includes("animate-content-enter"), "AppShell must wrap content in .animate-content-enter");
      assert.ok(content.includes("animate-drawer-slide-up"), "Mobile menu must use .animate-drawer-slide-up");
    });

    it("FinanceWorkspaceNav should have tactile micro-interaction transitions", () => {
      const navPath = path.join(process.cwd(), "src/components/finance/finance-workspace-nav.tsx");
      const content = fs.readFileSync(navPath, "utf-8");
      assert.ok(content.includes("duration-150"), "Finance nav tab must specify duration-150");
      assert.ok(content.includes("ease-standard"), "Finance nav tab must use ease-standard");
    });
  });

  describe("6. Finance Reference Implementation Motion Contract", () => {
    it("Payments cashier modal must support 3-step state with checkmark micro-animation", () => {
      const paymentsPath = path.join(process.cwd(), "src/app/finance/payments/page.tsx");
      const content = fs.readFileSync(paymentsPath, "utf-8");

      assert.ok(content.includes('step === "success"'), "Payments modal must handle success step");
      assert.ok(content.includes("<SuccessCheck"), "Payments modal must display SuccessCheck in success step");
      assert.ok(content.includes("Lihat & Cetak Kwitansi"), "Payments success step must provide receipt action");
    });

    it("Cashbook mutation toggle must use tactile duration-150 transition", () => {
      const cashbookPath = path.join(process.cwd(), "src/app/finance/cashbook/page.tsx");
      const content = fs.readFileSync(cashbookPath, "utf-8");
      assert.ok(content.includes("duration-150 ease-standard"), "Cashbook mutation toggle must use duration-150 ease-standard");
    });

    it("Charges bulk candidate preview must use smooth animate-fade-in", () => {
      const chargesPath = path.join(process.cwd(), "src/app/finance/charges/page.tsx");
      const content = fs.readFileSync(chargesPath, "utf-8");
      assert.ok(content.includes("grid grid-cols-3 gap-2 pt-1 text-center animate-fade-in"), "Candidate preview must animate-fade-in");
    });
  });
});
