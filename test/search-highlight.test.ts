import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  highlightSearchMatches,
  hasSearchMatch,
  normalizeHighlightQuery,
} from "../src/lib/operations/search-highlight";

describe("Phase 12.1 — Search Highlight (Global Search UX)", () => {
  describe("1. Segmen dasar", () => {
    it("menandai satu kecocokan case-insensitive", () => {
      const segments = highlightSearchMatches("Ahmad Fauzi", "fauz");
      assert.deepEqual(segments, [
        { text: "Ahmad ", matched: false },
        { text: "Fauz", matched: true },
        { text: "i", matched: false },
      ]);
    });

    it("menandai SEMUA kecocokan berulang", () => {
      const segments = highlightSearchMatches("Budi Budi Budi", "budi");
      const matched = segments.filter((s) => s.matched);
      assert.equal(matched.length, 3);
      assert.ok(matched.every((s) => s.text === "Budi"));
    });

    it("rekonstruksi teks asli utuh (tidak ada kehilangan karakter)", () => {
      const source = "NIS: 2024001 • NISN: 0091234567";
      const segments = highlightSearchMatches(source, "2024");
      assert.equal(segments.map((s) => s.text).join(""), source);
    });
  });

  describe("2. Boundary & edge case", () => {
    it("query < 2 karakter tidak menghasilkan highlight", () => {
      const segments = highlightSearchMatches("Budi", "b");
      assert.deepEqual(segments, [{ text: "Budi", matched: false }]);
    });

    it("query kosong / whitespace hanya mengembalikan satu segmen non-match", () => {
      assert.deepEqual(highlightSearchMatches("Budi", "   "), [
        { text: "Budi", matched: false },
      ]);
      assert.deepEqual(highlightSearchMatches("Budi", ""), [
        { text: "Budi", matched: false },
      ]);
    });

    it("teks kosong menghasilkan array kosong", () => {
      assert.deepEqual(highlightSearchMatches("", "budi"), []);
      assert.deepEqual(highlightSearchMatches("", ""), []);
    });

    it("tidak ada kecocokan → satu segmen non-match penuh", () => {
      const segments = highlightSearchMatches("Siti Aminah", "budi");
      assert.deepEqual(segments, [{ text: "Siti Aminah", matched: false }]);
    });

    it("kueri multi-spasi dinormalisasi sebelum dicocokkan", () => {
      assert.equal(normalizeHighlightQuery("  AHMAD   FAUZ "), "ahmad fauz");
      const segments = highlightSearchMatches("Ahmad Fauzi", "  ahmad   fauz ");
      assert.deepEqual(segments, [
        { text: "Ahmad Fauz", matched: true },
        { text: "i", matched: false },
      ]);
      assert.ok(hasSearchMatch("Ahmad Fauzi", "ahmad fauz"));
    });
  });

  describe("3. Keamanan / anti-injection", () => {
    it("potongan HTML tetap sebagai teks (tidak di-interpretasi)", () => {
      const segments = highlightSearchMatches("<script>alert(1)</script>", "script");
      const matched = segments.filter((s) => s.matched);
      assert.equal(matched.length, 2); // dua kata "script"
      assert.equal(segments.map((s) => s.text).join(""), "<script>alert(1)</script>");
    });

    it("hasSearchMatch true hanya bila ada segmen matched", () => {
      assert.equal(hasSearchMatch("Nurul Hikmah", "hikm"), true);
      assert.equal(hasSearchMatch("Nurul Hikmah", "zainab"), false);
    });
  });

  describe("4. Query dipakai dialog (substring NIS/Nama)", () => {
    it("highlight NIS parsial pada subtitle", () => {
      const segments = highlightSearchMatches("NIS: 2024001 • NISN: 0091234567", "001");
      assert.ok(segments.some((s) => s.matched && s.text === "001"));
    });

    it("highlight nama tengah", () => {
      const segments = highlightSearchMatches("Muhammad Rizky", "rizky");
      assert.ok(segments.some((s) => s.matched && s.text.toLowerCase() === "rizky"));
    });
  });
});

describe("Phase 12.2 — Error Boundary & Recovery UI", () => {
  const appDir = path.join(__dirname, "..", "src", "app");

  it("app/error.tsx ada, client component, punya handler reset", () => {
    const file = path.join(appDir, "error.tsx");
    assert.ok(fs.existsSync(file), "src/app/error.tsx harus ada");
    const src = fs.readFileSync(file, "utf8");
    assert.match(src, /^"use client"/, "error boundary wajib client component");
    assert.match(src, /reset/, "harus menawarkan aksi pulih (reset)");
    assert.match(src, /Coba Lagi|Muat Ulang/, "harus ada label aksi yang manusiawi");
    // Jangan bocorkan pesan error mentah ke pengguna
    assert.doesNotMatch(src, /\{error\.message\}/, "pesan error mentah tidak boleh dirender");
  });

  it("app/global-error.tsx ada dan merender <html>/<body> sendiri", () => {
    const file = path.join(appDir, "global-error.tsx");
    assert.ok(fs.existsSync(file), "src/app/global-error.tsx harus ada");
    const src = fs.readFileSync(file, "utf8");
    assert.match(src, /^"use client"/);
    assert.match(src, /<html/, "global-error wajib merender <html>");
    assert.match(src, /<body/, "global-error wajib merender <body>");
    assert.match(src, /reset/);
    assert.doesNotMatch(src, /\{error\.message\}/);
  });

  it("tidak ada stack trace / teknis yang terekspos ke pengguna", () => {
    const src = fs.readFileSync(path.join(appDir, "error.tsx"), "utf8");
    // Yang dilarang: dirender sebagai JSX, bukan disebut di komentar.
    assert.doesNotMatch(src, /\{error\.stack/, "error.stack tidak boleh dirender");
    assert.doesNotMatch(
      src,
      /<code[^>]*>\{[^}]*error\.message/,
      "pesan error mentah tidak boleh dibungkus elemen tampilan"
    );
    // digest boleh ditampilkan sebagai kode pendek (bukan pesan mentah)
    assert.match(src, /digest/, "kode gangguan pendek boleh ditampilkan untuk dukungan");
  });
});
