import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts", "bundle-report.mjs");
const PKG = join(ROOT, "package.json");
const STATIC_DIR = join(ROOT, ".next", "static");

describe("Phase 12.4 — Bundle Report & Code Split Tests", () => {
  describe("1. Struktur tooling", () => {
    it("skrip bundle-report ada dan berformat ESM (.mjs)", () => {
      assert.ok(existsSync(SCRIPT), "scripts/bundle-report.mjs harus ada");
      assert.ok(SCRIPT.endsWith(".mjs"));
    });

    it("diekspor sebagai npm script `bundle:report`", () => {
      const pkg = JSON.parse(readFileSync(PKG, "utf8"));
      assert.equal(pkg.scripts["bundle:report"], "node scripts/bundle-report.mjs");
    });

    it("tidak menyetel `type: module` (script CommonJS lama tetap aman)", () => {
      const pkg = JSON.parse(readFileSync(PKG, "utf8"));
      assert.equal(pkg.type, undefined);
    });

    it("skrip mengecek keberadaan .next/static (pesan bila belum build)", () => {
      const src = readFileSync(SCRIPT, "utf8");
      assert.match(src, /npm run build/);
      assert.match(src, /process\.exit\(1\)/);
    });
  });

  describe("2. Code split: dialog pencarian lazy", () => {
    it("app-shell memuat GlobalSearchDialog via dynamic import", () => {
      const src = readFileSync(
        join(ROOT, "src", "components", "app-shell.tsx"),
        "utf8"
      );
      assert.match(src, /import dynamic from "next\/dynamic"/);
      assert.match(src, /import\("\.\/global-search-dialog"\)/);
      assert.ok(
        !/^import \{ GlobalSearchDialog \} from/m.test(src),
        "impor statis dialog harus dihapus"
      );
    });

    it("nav-header memuat GlobalSearchDialog via dynamic import", () => {
      const src = readFileSync(
        join(ROOT, "src", "components", "nav-header.tsx"),
        "utf8"
      );
      assert.match(src, /import dynamic from "next\/dynamic"/);
      assert.match(src, /import\("\.\/global-search-dialog"\)/);
      assert.ok(!/^import \{ GlobalSearchDialog \} from/m.test(src));
    });

    it("kedua dynamic import memakai ssr:false (komponen interaktif murni klien)", () => {
      for (const f of ["app-shell.tsx", "nav-header.tsx"]) {
        const src = readFileSync(join(ROOT, "src", "components", f), "utf8");
        assert.match(src, /ssr:\s*false/, `${f} harus ssr:false`);
      }
    });
  });

  describe("3. Jalankan laporan (butuh artefak build — dilewati bila tidak ada)", () => {
    it("bundle:report sukses dan semua chunk dalam budget", (t) => {
      if (!existsSync(STATIC_DIR)) {
        t.skip("belum ada .next/static — jalankan `npm run build` dulu");
        return;
      }
      let out = "";
      try {
        out = execFileSync(process.execPath, [SCRIPT], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        // Exit 1 = ada chunk melewati budget: laporkan chunk pelanggarnya.
        const e = err as { status?: number; stderr?: string; stdout?: string };
        assert.fail(
          `bundle:report exit=${e.status}\n${e.stdout ?? ""}${e.stderr ?? ""}`
        );
      }
      assert.match(out, /Chunk\s+:\s+\d+/);
      assert.match(out, /Total gzip/);
      assert.match(out, /semua chunk klien dalam budget/);
      assert.ok(statSync(STATIC_DIR).isDirectory());
    });
  });
});
