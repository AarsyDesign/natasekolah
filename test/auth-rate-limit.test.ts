import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  FailureRateLimiter,
  LOGIN_RATE_LIMITS,
  LoginRateLimiter,
  buildLoginAttemptKey,
  loginRateLimiter,
} from "../src/lib/auth/rate-limit";
import { loginAction } from "../src/actions/auth";

const THROTTLE_MARK = "Terlalu banyak percobaan gagal.";
const GENERIC_MARK = "tidak valid";

/** Percobaan login dengan kredensial yang pasti salah. */
async function attempt(email: string, password = "salah-satu-dua-tiga"): Promise<string> {
  const res = await loginAction({
    institutionSlug: "lembaga-tidak-ada",
    email,
    password,
  });
  assert.equal(res.success, false);
  return res.success === false ? res.error : "";
}

describe("FailureRateLimiter (sliding window)", () => {
  it("mengizinkan hingga batas lalu memblokir dengan retryAfter", () => {
    const limiter = new FailureRateLimiter({ maxFailures: 3, windowMs: 10_000 });
    const key = "ip:10.0.0.1";
    const t0 = 1_000_000;

    assert.equal(limiter.check(key, t0).allowed, true);
    assert.equal(limiter.recordFailure(key, t0).allowed, true, "kegagalan ke-1 masih boleh");
    assert.equal(limiter.recordFailure(key, t0).allowed, true, "kegagalan ke-2 masih boleh");

    const blocked = limiter.recordFailure(key, t0);
    assert.equal(blocked.allowed, false, "kegagalan ke-3 melewati batas");
    assert.ok(!blocked.allowed && blocked.retryAfterMs > 0, "retryAfter harus positif");
    assert.ok(
      !blocked.allowed && blocked.retryAfterMs <= 10_000,
      "retryAfter tidak boleh melebihi window"
    );
    assert.equal(limiter.check(key, t0).allowed, false, "key tetap terblokir");
  });

  it("membuka kembali setelah window lewat (tanpa tidur, clock disuntikkan)", () => {
    const limiter = new FailureRateLimiter({ maxFailures: 2, windowMs: 1_000 });
    const key = "acct:a@b.c";
    const t0 = 5_000;

    limiter.recordFailure(key, t0);
    const blocked = limiter.recordFailure(key, t0);
    assert.equal(blocked.allowed, false);

    assert.equal(limiter.check(key, t0 + 999).allowed, false, "masih di dalam window");
    assert.equal(limiter.check(key, t0 + 1_000).allowed, true, "window lewat -> boleh lagi");
  });

  it("reset menghapus hitungan (login berhasil tidak dihukum)", () => {
    const limiter = new FailureRateLimiter({ maxFailures: 2, windowMs: 60_000 });
    const t0 = 0;
    limiter.recordFailure("k", t0);
    limiter.recordFailure("k", t0);
    assert.equal(limiter.check("k", t0).allowed, false);

    limiter.reset("k");
    assert.equal(limiter.check("k", t0).allowed, true);
    assert.equal(limiter.size(), 0, "state bersih setelah reset");
  });

  it("key berbeda tidak saling mempengaruhi", () => {
    const limiter = new FailureRateLimiter({ maxFailures: 1, windowMs: 60_000 });
    const t0 = 0;
    limiter.recordFailure("ip:1.1.1.1", t0);
    assert.equal(limiter.check("ip:1.1.1.1", t0).allowed, false);
    assert.equal(limiter.check("ip:2.2.2.2", t0).allowed, true, "key lain tetap bebas");
  });

  it("jumlah key dibatasi agar memori tidak bocor saat diserang banyak key", () => {
    const limiter = new FailureRateLimiter({ maxFailures: 5, windowMs: 60_000 }, 3);
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure(`ip:10.0.0.${i}`, 1_000 + i);
    }
    assert.ok(limiter.size() <= 3, `size=${limiter.size()} harus <= 3`);
  });
});

describe("LoginRateLimiter (per-akun + per-IP)", () => {
  it("memblokir berdasarkan akun walau IP berbeda", () => {
    const limiter = new LoginRateLimiter();
    const acct1 = buildLoginAttemptKey({ institutionSlug: "SMA1", email: "Guru@Sekolah.id", ipAddress: "1.1.1.1" });
    const acct2 = buildLoginAttemptKey({ institutionSlug: "sma1", email: "guru@sekolah.id", ipAddress: "2.2.2.2" });

    assert.equal(acct1.account, acct2.account, "normalisasi huruf besar/kecil & spasi");
    assert.notEqual(acct1.ip, acct2.ip, "memang sengaja beda IP");

    for (let i = 0; i < LOGIN_RATE_LIMITS.perAccount.maxFailures - 1; i++) {
      const d = limiter.recordFailure(acct1, 1_000);
      assert.equal(d.allowed, true, `kegagalan ke-${i + 1} masih diizinkan`);
    }
    const trigger = limiter.recordFailure(acct1, 1_000);
    assert.equal(trigger.allowed, false, "kegagalan ke-5 memicu pembatasan");
    assert.equal(limiter.check(acct1, 1_000).allowed, false, "akun terkunci");

    const otherAcctSameIp = { account: "acct:lain@lain.id", ip: acct1.ip };
    assert.equal(limiter.check(otherAcctSameIp, 1_000).allowed, true, "IP belum kena pembatasan");
    assert.equal(limiter.check(acct2, 1_000).allowed, false, "akun sama dari IP lain tetap kena");
  });

  it("memblokir seluruh IP ketika satu IP melewati batasnya", () => {
    const limiter = new LoginRateLimiter();
    const base = { institutionSlug: "x", email: "y@z.id", ipAddress: "5.5.5.5" };

    for (let i = 0; i < LOGIN_RATE_LIMITS.perIp.maxFailures; i++) {
      // tiap percobaan pakai akun berbeda supaya hanya bucket IP yang terisi
      limiter.recordFailure(buildLoginAttemptKey({ ...base, email: `a${i}@z.id` }), 2_000);
    }
    const next = buildLoginAttemptKey({ ...base, email: "belom-dipakai@z.id" });
    assert.equal(limiter.check(next, 2_000).allowed, false, "IP sudah kena pembatasan");
    assert.equal(limiter.check({ ...next, ip: "ip:6.6.6.6" }, 2_000).allowed, true, "IP lain bebas");
  });
});

describe("loginAction — proteksi brute-force", () => {
  beforeEach(() => {
    loginRateLimiter.clear();
  });

  it("menolak dengan pesan generik sebelum kena pembatas", async () => {
    const err = await attempt(`umum-${Date.now()}@uji.test`);
    assert.ok(err.includes(GENERIC_MARK), `pesan generik, dapat: ${err}`);
    assert.ok(!err.includes(THROTTLE_MARK), "percobaan pertama tidak boleh kena throttle");
  });

  it("mengembalikan pesan pembatas setelah kegagalan beruntun", async () => {
    const email = `serang-${Date.now()}@uji.test`;
    const errors: string[] = [];
    const total = LOGIN_RATE_LIMITS.perAccount.maxFailures;

    for (let i = 0; i < total; i++) {
      errors.push(await attempt(email));
    }

    const throttled = errors.filter((e) => e.startsWith(THROTTLE_MARK));
    const generic = errors.filter((e) => e.includes(GENERIC_MARK));
    assert.equal(throttled.length, 1, `harus ada tepat satu pesan throttle, dapat ${throttled.length}`);
    assert.equal(generic.length, total - 1, "sisa percobaan memakai pesan generik");
    assert.match(throttled[0], /detik\.$/, "pesan throttle menyebut waktu tunggu");
  });

  it("pembatasan per-akun tidak mengunci akun lain", async () => {
    const lockedEmail = `kunci-${Date.now()}@uji.test`;
    for (let i = 0; i < LOGIN_RATE_LIMITS.perAccount.maxFailures; i++) {
      await attempt(lockedEmail);
    }

    const other = await attempt(`bebas-${Date.now()}@uji.test`);
    assert.ok(other.includes(GENERIC_MARK), `akun lain tetap boleh mencoba, dapat: ${other}`);
    assert.ok(!other.startsWith(THROTTLE_MARK), "akun lain tidak ikut terkunci");
  });

  it("login sukses mereset hitungan akun tersebut", async () => {
    // isi bucket akun mendekati batas lewat percobaan gagal
    const email = `reset-${Date.now()}@uji.test`;
    for (let i = 0; i < LOGIN_RATE_LIMITS.perAccount.maxFailures - 1; i++) {
      await attempt(email);
    }
    // reset manual meniru kondisi setelah login sukses
    loginRateLimiter.reset(buildLoginAttemptKey({ institutionSlug: "lembaga-tidak-ada", email, ipAddress: undefined }));

    const after = await attempt(email);
    assert.ok(after.includes(GENERIC_MARK), `setelah reset kembali normal, dapat: ${after}`);
    assert.ok(!after.startsWith(THROTTLE_MARK), "tidak boleh masih terkunci");
  });
});
