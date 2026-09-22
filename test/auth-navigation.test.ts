import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSafePostLoginPath } from "../src/lib/auth/navigation";

describe("Post-login navigation", () => {
  it("mengizinkan path internal aplikasi", () => {
    assert.equal(getSafePostLoginPath("/attendance?date=2026-09-22"), "/attendance?date=2026-09-22");
  });

  it("menolak redirect eksternal dan path ambigu", () => {
    assert.equal(getSafePostLoginPath("https://penyerang.example"), "/students");
    assert.equal(getSafePostLoginPath("//penyerang.example"), "/students");
    assert.equal(getSafePostLoginPath("/\\penyerang.example"), "/students");
    assert.equal(getSafePostLoginPath(null), "/students");
  });
});
