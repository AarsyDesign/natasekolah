import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSafePostLoginPath, DEFAULT_AUTHENTICATED_PATH } from "../src/lib/auth/navigation";

describe("Post-login navigation", () => {
  it("mengizinkan path internal aplikasi", () => {
    assert.equal(getSafePostLoginPath("/attendance?date=2026-09-22"), "/attendance?date=2026-09-22");
  });

  it("menolak redirect eksternal dan path ambigu", () => {
    assert.equal(getSafePostLoginPath("https://penyerang.example"), "/dashboard");
    assert.equal(getSafePostLoginPath("//penyerang.example"), "/dashboard");
    assert.equal(getSafePostLoginPath("/\\penyerang.example"), "/dashboard");
    assert.equal(getSafePostLoginPath(null), "/dashboard");
    assert.equal(DEFAULT_AUTHENTICATED_PATH, "/dashboard");
  });
});
