import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Phase 12.5 — Gerbang lint (DoD Strict: `npm run lint` → **0 error**).
 *
 * Menjalankan ESLINT sungguhan lalu memilah output JSON-nya: error apa pun
 * membuat test gagal. Warning dibolehkan (utang bersih yang dilacak terpisah)
 * tetapi jumlahnya dicetak agar regresi tetap terlihat.
 */
describe("Phase 12.5 — Lint Gate Tests", () => {
  describe("1. Konfigurasi lint", () => {
    it(".eslintrc.json ada dan memuat jsx-a11y recommended", () => {
      const path = join(ROOT, ".eslintrc.json");
      assert.ok(existsSync(path), ".eslintrc.json harus ada");
      const cfg = JSON.parse(readFileSync(path, "utf8"));
      assert.ok(cfg.extends.includes("plugin:jsx-a11y/recommended"));
      assert.ok(cfg.extends.includes("next/core-web-vitals"));
      assert.ok(cfg.extends.includes("next/typescript"));
    });

    it("npm script `lint` dan `lint:fix` tersedia", () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
      assert.equal(pkg.scripts.lint, "eslint .");
      assert.equal(pkg.scripts["lint:fix"], "eslint . --fix");
    });

    it("node_modules eslint + plugin jsx-a11y terpasang", () => {
      assert.ok(existsSync(join(ROOT, "node_modules", "eslint")), "eslint");
      assert.ok(
        existsSync(join(ROOT, "node_modules", "eslint-plugin-jsx-a11y")),
        "eslint-plugin-jsx-a11y"
      );
    });
  });

  describe("2. Jalankan ESLint — wajib 0 error", () => {
    it("eslint . menghasilkan 0 error", (t) => {
      if (!existsSync(join(ROOT, "node_modules", "eslint"))) {
        t.skip("eslint belum terpasang — jalankan npm install dulu");
        return;
      }
      const reportPath = join(ROOT, ".next", "eslint-report.json");
      let exitOk = true;
      try {
        execFileSync(
          process.execPath,
          [
            join(ROOT, "node_modules", "eslint", "bin", "eslint.js"),
            ".",
            "-f",
            "json",
            "-o",
            reportPath,
          ],
          { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        );
      } catch (err) {
        // eslint exit 1 = ada error (atau --quiet). Baca laporan utk memastikan.
        exitOk = false;
      }
      assert.ok(existsSync(reportPath), "laporan eslint harus ditulis");

      interface EslintFile {
        filePath: string;
        errorCount: number;
        warningCount: number;
      }
      const report: EslintFile[] = JSON.parse(readFileSync(reportPath, "utf8"));
      const offenders: string[] = [];
      let warnings = 0;
      for (const file of report) {
        warnings += file.warningCount;
        if (file.errorCount > 0) {
          offenders.push(
            `${file.filePath.replace(ROOT + "/", "")}: ${file.errorCount} error`
          );
        }
      }

      if (offenders.length > 0) {
        assert.fail(
          `ESLint menemukan error di ${offenders.length} file:\n` +
            offenders.slice(0, 20).join("\n")
        );
      }
      // exit 1 tanpa error berarti ada error lint yang tercatat;
      // tetap pastikan jumlah error benar-benar nol.
      const totalErrors = report.reduce(
        (sum: number, file: EslintFile) => sum + file.errorCount,
        0
      );
      assert.equal(totalErrors, 0);
      if (!exitOk) {
        assert.fail("eslint exit non-nol padahal errorCount 0 — cek output");
      }
      console.log(`      → ESLint: 0 error, ${warnings} warning (dilacak)`);
    });
  });
});
