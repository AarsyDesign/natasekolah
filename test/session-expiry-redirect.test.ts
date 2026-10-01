import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SESSION_EXPIRED_PATH,
  isSessionExpiredError,
  rethrowIfSessionExpired,
  requireActionSession,
} from "../src/lib/auth/action-session";
import { TenantContextMissingError } from "../src/lib/tenant/context";

/** Ekstrak digest/message error pengalihan Next.js untuk bisa di-assert. */
function redirectInfo(err: unknown): string {
  const e = err as { digest?: unknown; message?: unknown };
  const digest = typeof e?.digest === "string" ? e.digest : "";
  const message = typeof e?.message === "string" ? e.message : "";
  return `${digest}${message}`;
}

function assertRedirectsToLogin(err: unknown): true {
  assert.match(redirectInfo(err), /\/login\?expired=1/);
  return true;
}

describe("Sesi berakhir diarahkan ke halaman masuk", () => {
  it("SESSION_MISSING (tanpa cookie) menjadi redirect /login?expired=1", () => {
    const err = new TenantContextMissingError(
      "Sesi otentikasi tidak ditemukan. Harap masuk terlebih dahulu.",
      "SESSION_MISSING"
    );
    assert.equal(isSessionExpiredError(err), true);
    assert.throws(() => rethrowIfSessionExpired(err), assertRedirectsToLogin);
  });

  it("SESSION_INVALID (token kedaluwarsa/dicabut) menjadi redirect", () => {
    const err = new TenantContextMissingError(
      "Sesi Anda tidak valid atau telah kedaluwarsa. Harap masuk kembali.",
      "SESSION_INVALID"
    );
    assert.equal(isSessionExpiredError(err), true);
    assert.throws(() => rethrowIfSessionExpired(err), assertRedirectsToLogin);
  });

  it("sesi non-internal (wali murid) TIDAK di-redirect", () => {
    const err = new TenantContextMissingError(
      "Sesi ini bukan sesi pengguna internal lembaga.",
      "NOT_INTERNAL"
    );
    assert.equal(isSessionExpiredError(err), false);
    assert.doesNotThrow(() => rethrowIfSessionExpired(err));
  });

  it("konteks AsyncLocalStorage yang belum di-set TIDAK di-redirect", () => {
    const err = new TenantContextMissingError();
    assert.equal(err.reason, "NO_CONTEXT");
    assert.equal(isSessionExpiredError(err), false);
    assert.doesNotThrow(() => rethrowIfSessionExpired(err));
  });

  it("error biasa tetap diteruskan sebagai kegagalan biasa", () => {
    const err = new Error("Gagal memuat data siswa.");
    assert.equal(isSessionExpiredError(err), false);
    assert.doesNotThrow(() => rethrowIfSessionExpired(err));
  });

  it("requireActionSession menolak token tidak valid berupa redirect", async () => {
    await assert.rejects(
      requireActionSession("token-yang-tidak-pernah-ada"),
      assertRedirectsToLogin
    );
  });

  it("tujuan pengalihan konsisten dengan params expired di halaman masuk", () => {
    assert.equal(SESSION_EXPIRED_PATH, "/login?expired=1");
  });
});

describe("Struktur server action: penjaga sesi wajib ada", () => {
  const actionsDir = path.join(import.meta.dirname, "..", "src", "actions");
  // auth & guardian tidak memakai sesi internal (alur masuk/aktivasi publik)
  const SKIP = new Set(["auth.ts", "guardian.ts"]);
  const CATCH_RE = /\} catch \((err|error)(?:: [^)]+)?\) \{\n(\s*)([^\n]*)/g;

  it("setiap blok catch di action memanggil rethrowIfSessionExpired lebih dulu", () => {
    const files = fs
      .readdirSync(actionsDir)
      .filter((f) => f.endsWith(".ts") && !SKIP.has(f));

    assert.ok(files.length > 0, "file server action harus ditemukan");

    for (const file of files) {
      const src = fs.readFileSync(path.join(actionsDir, file), "utf8");
      CATCH_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      let count = 0;
      while ((match = CATCH_RE.exec(src)) !== null) {
        count += 1;
        assert.equal(
          match[3].trim(),
          `rethrowIfSessionExpired(${match[1]});`,
          `${file}: catch harus diawali rethrowIfSessionExpired(${match[1]}), dapat "${match[3].trim()}"`
        );
      }
      const tanpaCatch = file === "finance.ts" || file === "notification.ts";
      if (!tanpaCatch) {
        assert.ok(count > 0, `${file}: harus punya blok catch`);
      }
    }
  });

  it("action tanpa catch (finance & notifikasi) memakai requireActionSession", () => {
    for (const file of ["finance.ts", "notification.ts"]) {
      const src = fs.readFileSync(path.join(actionsDir, file), "utf8");
      assert.ok(
        !src.includes("getAuthenticatedTenantContext"),
        `${file}: wajib memakai requireActionSession agar sesi berakhir di-redirect`
      );
      assert.ok(
        src.includes("await requireActionSession()"),
        `${file}: pemanggilan sesi belum diganti`
      );
      assert.ok(!src.includes("catch ("), `${file}: struktur tanpa catch berubah`);
    }
  });
});
