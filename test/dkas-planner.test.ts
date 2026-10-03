import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TenantContext } from "../src/lib/tenant/context";
import {
  DATASETS,
  DATASET_IDS,
  DKAS_LIMIT_MAX,
  type QueryPlan,
} from "../src/lib/dkas/catalog";
import { describePlan, validatePlan } from "../src/lib/dkas/plan";
import { detectDataset, planWithRules } from "../src/lib/dkas/rule-planner";
import { buildPlannerPrompt, parsePlanContent } from "../src/lib/dkas/llm-planner";
import { planQuery } from "../src/lib/dkas/planner";
import {
  buildCompiledQuery,
  executePlanQuery,
} from "../src/lib/dkas/executor";
import {
  enforceDkasRateLimit,
  resetDkasRateLimit,
} from "../src/lib/dkas/rate-limit";
import { validateDkasQueryInput } from "../src/lib/validation/dkas";
import { ValidationError } from "../src/lib/validation/common";
import { AuthorizationError, ROLE_PERMISSIONS } from "../src/lib/auth/permissions";

// ---------------------------------------------------------------------------
// Konteks uji (permissions eksplisit —TenantContext memakai array permissions)
// ---------------------------------------------------------------------------

const instId = "inst_dkas_a";
const otherInstId = "inst_dkas_b";

function makeCtx(
  roles: string[],
  permissions: string[],
  institutionId = instId
): TenantContext {
  return {
    userId: "usr_dkas",
    institutionId,
    roles,
    permissions,
    isSuperAdmin: false,
  };
}

const adminCtx: TenantContext = {
  ...makeCtx(["ADMIN"], [...ROLE_PERMISSIONS.ADMIN]),
  isSuperAdmin: false,
};

const teacherCtx = makeCtx(
  ["TEACHER"],
  [...ROLE_PERMISSIONS.TEACHER],
  instId
);

const financeCtx = makeCtx(
  ["FINANCE_STAFF"],
  [...ROLE_PERMISSIONS.FINANCE_STAFF],
  instId
);

const waliCtx = {
  userId: undefined,
  guardianId: "gd_1",
  institutionId: instId,
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  subjectType: "GUARDIAN",
} as unknown as TenantContext;

/** Izin minimal untuk fitur tapi tidak untuk satu domain tertentu. */
const limitedCtx = makeCtx(["ADMIN"], ["dkas:query", "pesantren:view"], instId);

// ---------------------------------------------------------------------------
// 1. Whitelist katalog & validasi rencana query
// ---------------------------------------------------------------------------

describe("12.7.1 Whitelist katalog & validatePlan", () => {
  it("menerima rencana sah dan mengisi orderBy default", () => {
    const plan = validatePlan({
      dataset: "santri",
      conditions: [{ field: "status", op: "equals", value: "ACTIVE" }],
      limit: 10,
    });
    assert.equal(plan.dataset, "santri");
    assert.equal(plan.conditions.length, 1);
    assert.equal(plan.limit, 10);
    assert.equal(plan.orderBy, "nama");
  });

  it("menolak dataset yang tidak dikenal", () => {
    assert.throws(
      () => validatePlan({ dataset: "keuangan", conditions: [] }),
      (err: unknown) => err instanceof ValidationError
    );
  });

  it("menolak field di luar whitelist — termasuk kolom tenant", () => {
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "institutionId", op: "equals", value: otherInstId }],
        }),
      /tidak ada di whitelist/
    );
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "passwordHash", op: "contains", value: "x" }],
        }),
      ValidationError
    );
  });

  it("menolak operator di luar whitelist", () => {
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "nama", op: "regex", value: ".*" }],
        }),
      /tidak diizinkan/
    );
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "status", op: "contains", value: "ACT" }],
        }),
      /tidak didukung/
    );
  });

  it("menolak nilai enum di luar daftar resmi", () => {
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "status", op: "equals", value: "SUSPENDED" }],
        }),
      /tidak valid untuk field/
    );
    assert.throws(
      () =>
        validatePlan({
          dataset: "kehadiran",
          conditions: [{ field: "status", op: "in", value: ["PRESENT", "MAYBE"] }],
        }),
      ValidationError
    );
  });

  it("menolak nilai terlalu panjang, angka di luar rentang, dan tanggal rusak", () => {
    assert.throws(
      () =>
        validatePlan({
          dataset: "santri",
          conditions: [{ field: "nama", op: "contains", value: "x".repeat(121) }],
        }),
      /1–120 karakter/
    );
    assert.throws(
      () =>
        validatePlan({
          dataset: "nilai",
          conditions: [{ field: "skor", op: "gte", value: 1_000_000 }],
        }),
      /rentang wajar/
    );
    assert.throws(
      () =>
        validatePlan({
          dataset: "kehadiran",
          conditions: [{ field: "tanggal", op: "gte", value: "03-10-2026" }],
        }),
      /YYYY-MM-DD/
    );
  });

  it("membatasi jumlah kondisi (maks 5)", () => {
    const conditions = Array.from({ length: 6 }, (_, i) => ({
      field: "nama",
      op: "contains",
      value: `a${i}`,
    }));
    assert.throws(
      () => validatePlan({ dataset: "santri", conditions }),
      /Maksimal 5 kondisi/
    );
  });

  it("men-clamp limit liar (non-blocking) — 9999 → 50, 0 → 1", () => {
    const high = validatePlan({ dataset: "santri", conditions: [], limit: 9999 });
    assert.equal(high.limit, DKAS_LIMIT_MAX);
    const low = validatePlan({ dataset: "santri", conditions: [], limit: 0 });
    assert.equal(low.limit, 1);
    assert.throws(
      () => validatePlan({ dataset: "santri", conditions: [], limit: "banyak" }),
      /harus berupa angka/
    );
  });

  it("menolak orderBy di luar daftar dan mengembalikan ringkasan manusiawi", () => {
    assert.throws(
      () => validatePlan({ dataset: "santri", conditions: [], orderBy: "password" }),
      /tidak diizinkan/
    );
    const plan = validatePlan({
      dataset: "nilai",
      conditions: [{ field: "skor", op: "lte", value: 70 }],
      limit: 15,
    });
    const text = describePlan(plan);
    assert.match(text, /Nilai \(skor\)/);
    assert.match(text, /≤ 70/);
    assert.match(text, /Nilai \/ Penilaian/);
  });

  it("setiap dataset punya minimal satu field teks, izin, model, dan contoh", () => {
    for (const id of DATASET_IDS) {
      const spec = DATASETS[id];
      assert.ok(Object.keys(spec.fields).length >= 3, `${id} minimal 3 field`);
      assert.ok(spec.permission, `${id} punya permission`);
      assert.ok(spec.model, `${id} punya delegate prisma`);
      assert.ok(spec.samples.length >= 2, `${id} punya contoh pertanyaan`);
      assert.ok(spec.defaultOrderBy in spec.orderBy, `${id} orderBy default valid`);
      // Kolom tenant tidak boleh muncul sebagai field yang bisa difilter.
      assert.equal(
        Object.prototype.hasOwnProperty.call(spec.fields, "institutionId"),
        false
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Rule planner deterministik
// ---------------------------------------------------------------------------

describe("12.7.2 Rule planner (bahasa Indonesia)", () => {
  const now = new Date("2026-10-03T10:00:00.000Z");

  it("mendeteksi dataset dari kata kunci", () => {
    assert.equal(detectDataset("siswa yang alpha hari ini"), "kehadiran");
    assert.equal(detectDataset("izin yang belum disetujui"), "izin");
    assert.equal(detectDataset("nilai di bawah 70"), "nilai");
    assert.equal(detectDataset("santri kelas 7A"), "santri");
    assert.equal(detectDataset("bagaimana cuaca hari ini"), null);
  });

  it("menyusun rencana presensi + tanggal relatif", () => {
    const plan = planWithRules("siswa yang alpha hari ini", now);
    assert.equal(plan.dataset, "kehadiran");
    assert.deepEqual(plan.conditions, [
      { field: "status", op: "equals", value: "ABSENT" },
      { field: "tanggal", op: "equals", value: "2026-10-03" },
    ]);
  });

  it("menyusun rencana nilai dengan ambang batas", () => {
    const plan = planWithRules("nilai di bawah 70", now);
    assert.equal(plan.dataset, "nilai");
    assert.deepEqual(plan.conditions, [{ field: "skor", op: "lte", value: 70 }]);

    const above = planWithRules("nilai di atas 85 minggu ini", now);
    assert.deepEqual(above.conditions, [{ field: "skor", op: "gte", value: 85 }]);
  });

  it("menangani negasi status izin tanpa salah tangkap jadi disetujui", () => {
    const plan = planWithRules("izin yang belum disetujui", now);
    assert.equal(plan.dataset, "izin");
    assert.deepEqual(plan.conditions, [
      { field: "status", op: "equals", value: "PENDING" },
    ]);
  });

  it("menggabungkan banyak status menjadi operator in", () => {
    const plan = planWithRules("presensi siswa yang sakit atau alpha kemarin", now);
    assert.equal(plan.dataset, "kehadiran");
    const status = plan.conditions.find((c) => c.field === "status");
    assert.deepEqual(status, {
      field: "status",
      op: "in",
      // Urutan mengikuti urutan aturan status (ABSENT didahulukan agar
      // "tidak hadir" tidak salah ditangkap sebagai PRESENT).
      value: ["ABSENT", "SICK"],
    });
    const range = plan.conditions.filter((c) => c.field === "tanggal");
    assert.equal(range.length, 2);
  });

  it("menyusun rencana buku induk: status, gender, rombel", () => {
    const plan = planWithRules("santri perempuan kelas 7A berstatus aktif", now);
    assert.equal(plan.dataset, "santri");
    const byField = Object.fromEntries(
      plan.conditions.map((c) => [c.field, `${c.op}:${String(c.value)}`])
    );
    assert.equal(byField.gender, "equals:P");
    assert.equal(byField.rombel, "contains:7a");
    assert.equal(byField.status, "equals:ACTIVE");
  });

  it("membatasi pertanyaan tak dikenal dengan pesan berisi contoh", () => {
    assert.throws(
      () => planWithRules("berapa hari umur bumi?", now),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match((err as Error).message, /contoh/i);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Planner LLM: gate, validasi, fallback non-blocking
// ---------------------------------------------------------------------------

describe("12.7.3 Orkestrasi planner (gate AI + fallback)", () => {
  it("AI nonaktif → mode 'rule' tanpa menyentuh jaringan", async () => {
    const planned = await planQuery("santri berstatus aktif", adminCtx, {
      llmEnabled: false,
    });
    assert.equal(planned.mode, "rule");
    assert.equal(planned.aiEnabled, false);
    assert.equal(planned.plan.dataset, "santri");
    assert.equal(planned.fallbackReason, undefined);
  });

  it("AI aktif + rencana valid → mode 'ai' (dan limit liar tetap di-clamp)", async () => {
    const planned = await planQuery("santri berstatus aktif", adminCtx, {
      llmEnabled: true,
      llmPlanner: async () => ({
        dataset: "santri",
        conditions: [{ field: "status", op: "equals", value: "ACTIVE" }],
        limit: 9999,
      }),
    });
    assert.equal(planned.mode, "ai");
    assert.equal(planned.plan.limit, DKAS_LIMIT_MAX);
    assert.equal(planned.fallbackReason, undefined);
  });

  it("rencana LLM yang membawa kolom tenant DITOLAK lalu jatuh ke aturan", async () => {
    const planned = await planQuery("santri berstatus aktif", adminCtx, {
      llmEnabled: true,
      llmPlanner: async () => ({
        dataset: "santri",
        conditions: [{ field: "institutionId", op: "equals", value: otherInstId }],
        limit: 50,
      }),
    });
    assert.equal(planned.mode, "rule");
    assert.match(planned.fallbackReason ?? "", /whitelist/);
    assert.equal(planned.plan.dataset, "santri");
  });

  it("LLM error jaringan / JSON rusak → tetap terjawab lewat aturan", async () => {
    const planned = await planQuery("siswa yang alpha hari ini", adminCtx, {
      llmEnabled: true,
      llmPlanner: async () => {
        throw new Error("fetch failed");
      },
    });
    assert.equal(planned.mode, "rule");
    assert.equal(planned.fallbackReason, "fetch failed");
    assert.equal(planned.plan.dataset, "kehadiran");
  });

  it("prompt planner hanya memuat katalog aman + isi ekstraksi JSON mentah", () => {
    const prompt = buildPlannerPrompt("siswa alpha");
    assert.match(prompt, /KATALOG/);
    assert.match(prompt, /"dataset"/);
    assert.doesNotMatch(prompt, /password|prisma/i);

    const parsed = parsePlanContent(
      '```json\n{"dataset":"santri","conditions":[]}\n```'
    );
    assert.deepEqual(parsed, { dataset: "santri", conditions: [] });
    assert.throws(() => parsePlanContent("maaf, saya tidak bisa"), ValidationError);
  });
});

// ---------------------------------------------------------------------------
// 4. Guard izin (RBAC) & isolasi tenant
// ---------------------------------------------------------------------------

describe("12.7.4 Guard izin & isolasi tenant", () => {
  it("matriks RBAC: 5 peran punya dkas:query, FINANCE_STAFF tidak", () => {
    for (const role of ["SUPER_ADMIN", "FOUNDATION_HEAD", "PRINCIPAL", "ADMIN", "TEACHER"]) {
      assert.ok(
        ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS].includes("dkas:query"),
        `${role} harus punya dkas:query`
      );
    }
    assert.equal(ROLE_PERMISSIONS.FINANCE_STAFF.includes("dkas:query"), false);
  });

  it("tanpa dkas:query ditolak 403 (staf keuangan)", async () => {
    await assert.rejects(
      planQuery("santri berstatus aktif", financeCtx, { llmEnabled: false }),
      (err: unknown) => err instanceof AuthorizationError
    );
  });

  it("sesi wali (GUARDIAN) ditolak total dari RBAC internal", async () => {
    await assert.rejects(
      planQuery("santri berstatus aktif", waliCtx, { llmEnabled: false }),
      AuthorizationError
    );
  });

  it("guru tanpa pesantren:view tidak bisa menarik dataset izin", async () => {
    await assert.rejects(
      planQuery("izin yang belum disetujui", teacherCtx, { llmEnabled: false }),
      (err: unknown) => {
        assert.ok(err instanceof AuthorizationError);
        assert.match((err as Error).message, /pesantren:view/);
        return true;
      }
    );
  });

  it("izin terbatas: boleh izin, tetapi buku induk siswa ditolak", async () => {
    const ok = await planQuery("izin yang terlambat kembali", limitedCtx, {
      llmEnabled: false,
    });
    assert.equal(ok.plan.dataset, "izin");

    await assert.rejects(
      planQuery("santri berstatus aktif", limitedCtx, { llmEnabled: false }),
      AuthorizationError
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Eksekutor: tenant selalu disuntikkan, order/take terkunci
// ---------------------------------------------------------------------------

describe("12.7.5 Eksekutor query Prisma", () => {
  it("where selalu berisi institutionId dari ctx (bukan dari rencana)", () => {
    const plan: QueryPlan = validatePlan({
      dataset: "santri",
      conditions: [{ field: "status", op: "equals", value: "ACTIVE" }],
      limit: 10,
    });
    const compiled = buildCompiledQuery(adminCtx, plan);
    const and = compiled.where.AND as Array<Record<string, unknown>>;
    assert.equal(and[0].institutionId, instId);
    assert.equal(compiled.take, 10);
    assert.deepEqual(compiled.orderBy, { fullName: "asc" });

    // Context lembaga lain menghasilkan where lembaga lain — batas tetap ketat.
    const other = buildCompiledQuery(
      makeCtx(["ADMIN"], [...ROLE_PERMISSIONS.ADMIN], otherInstId),
      plan
    );
    assert.equal((other.where.AND as Array<Record<string, unknown>>)[0].institutionId, otherInstId);
  });

  it("fragmen where memakai key kolom Prisma yang benar (bukan objek telanjang)", () => {
    const compiled = buildCompiledQuery(
      adminCtx,
      validatePlan({
        dataset: "kehadiran",
        conditions: [
          { field: "status", op: "equals", value: "ABSENT" },
          { field: "tanggal", op: "equals", value: "2026-10-03" },
          { field: "siswa", op: "contains", value: "budi" },
        ],
        limit: 10,
      })
    );
    const and = compiled.where.AND as Array<Record<string, any>>;
    assert.deepEqual(and[1], { status: { equals: "ABSENT" } });
    assert.ok(and[2].session?.attendanceDate?.gte instanceof Date);
    assert.ok(and[2].session?.attendanceDate?.lte instanceof Date);
    assert.equal(and[3].student?.fullName?.mode, "insensitive");

    const nilai = buildCompiledQuery(
      adminCtx,
      validatePlan({
        dataset: "nilai",
        conditions: [{ field: "skor", op: "lte", value: 70 }],
        limit: 5,
      })
    );
    assert.deepEqual(
      (nilai.where.AND as Array<Record<string, unknown>>)[1],
      { score: { lte: 70 } }
    );
  });

  it("menjalankan findMany dengan select/orderBy/take milik katalog dan memetakan baris", async () => {
    const plan = planWithRules("santri berstatus aktif");
    const box: { args?: Record<string, any> } = {};
    const tx = {
      student: {
        findMany: async (args: Record<string, any>) => {
          box.args = args;
          return [
            {
              id: "s1",
              fullName: "Ahmad Fauzi",
              nis: "2024001",
              nisn: "009123",
              status: "ACTIVE",
              gender: "L",
            },
          ];
        },
      },
    };

    const result = await executePlanQuery(adminCtx, validatePlan(plan), tx as any);
    assert.ok(box.args, "findMany harus terpanggil");
    const captured = box.args;
    assert.equal(captured.take, plan.limit);
    assert.equal((captured.where.AND as Array<Record<string, unknown>>)[0].institutionId, instId);
    assert.equal(captured.select.fullName, true);
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].title, "Ahmad Fauzi");
    assert.equal(result.rows[0].badge, "Aktif");
    assert.match(result.rows[0].subtitle, /NIS 2024001/);
    assert.match(result.summary, /Buku Induk Santri/);
  });

  it("eksekutor mengulang guard izin dataset (defense in depth)", async () => {
    const plan = planWithRules("izin yang belum disetujui");
    await assert.rejects(
      executePlanQuery(teacherCtx, validatePlan(plan), {} as any),
      AuthorizationError
    );
  });

  it("menolak rencana yang ternodai field tak dikenal (jaring pengaman)", () => {
    const forged = {
      dataset: "santri" as const,
      conditions: [{ field: "nik", op: "equals" as const, value: "x" }],
      limit: 10,
    };
    assert.throws(() => buildCompiledQuery(adminCtx, forged), /tidak ada di katalog/);
  });

  it("mapRow kehadiran menampilkan status & tanggal dari relasi", async () => {
    const plan = planWithRules("presensi siswa sakit hari ini");
    const tx = {
      attendanceRecord: {
        findMany: async () => [
          {
            id: "a1",
            status: "SICK",
            note: null,
            session: { attendanceDate: "2026-10-03T00:00:00.000Z", context: "ACADEMIC" },
            student: { fullName: "Budi Santoso", nis: "2024002" },
          },
        ],
      },
    };
    const result = await executePlanQuery(adminCtx, validatePlan(plan), tx as any);
    assert.equal(result.rows[0].title, "Budi Santoso");
    assert.equal(result.rows[0].badge, "Sakit");
    assert.match(result.rows[0].subtitle, /2026-10-03/);
  });
});

// ---------------------------------------------------------------------------
// 6. Rate limit per pengguna
// ---------------------------------------------------------------------------

describe("12.7.6 Rate limit pertanyaan", () => {
  it("memblokir pengguna setelah melewati batas jendela", async () => {
    const prevMax = process.env.DKAS_RATE_LIMIT_MAX;
    const prevWindow = process.env.DKAS_RATE_LIMIT_WINDOW_MS;
    process.env.DKAS_RATE_LIMIT_MAX = "3";
    process.env.DKAS_RATE_LIMIT_WINDOW_MS = "60000";
    resetDkasRateLimit();

    const now = Date.now();
    await enforceDkasRateLimit("usr_rate", now);
    await enforceDkasRateLimit("usr_rate", now);
    await enforceDkasRateLimit("usr_rate", now);

    await assert.rejects(
      enforceDkasRateLimit("usr_rate", now),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match((err as Error).message, /Coba lagi dalam/);
        return true;
      }
    );

    // Pengguna lain tidak terdampak (kunci per pengguna).
    await enforceDkasRateLimit("usr_lain", now);

    // Jendela baru (waktu bergeser) → kembali diizinkan.
    await enforceDkasRateLimit("usr_rate", now + 61_000);

    resetDkasRateLimit();
    if (prevMax === undefined) delete process.env.DKAS_RATE_LIMIT_MAX;
    else process.env.DKAS_RATE_LIMIT_MAX = prevMax;
    if (prevWindow === undefined) delete process.env.DKAS_RATE_LIMIT_WINDOW_MS;
    else process.env.DKAS_RATE_LIMIT_WINDOW_MS = prevWindow;
  });
});

// ---------------------------------------------------------------------------
// 7. Validasi input server action & struktur UI
// ---------------------------------------------------------------------------

describe("12.7.7 Validasi input & struktur UI", () => {
  it("query dipotong spasi dan dibatasi 3–300 karakter", () => {
    assert.deepEqual(validateDkasQueryInput({ query: "  siswa aktif  " }), {
      query: "siswa aktif",
    });
    assert.throws(() => validateDkasQueryInput({ query: "ab" }), ValidationError);
    assert.throws(
      () => validateDkasQueryInput({ query: "x".repeat(301) }),
      ValidationError
    );
    assert.throws(() => validateDkasQueryInput({ query: "siswa aktif", limit: 999 }), ValidationError);
    assert.throws(() => validateDkasQueryInput({}), ValidationError);
  });

  it("halaman & komponen DKAS ada, klien, dan terdaftar di navigasi", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/app/dkas/page.tsx", "utf8");
    assert.match(page, /"use client"/);
    assert.match(page, /export default function/);
    assert.match(page, /DkasChat/);

    const chat = readFileSync("src/components/dkas-chat.tsx", "utf8");
    assert.match(chat, /"use client"/);
    assert.match(chat, /aria-live="polite"/);
    assert.match(chat, /dkasQueryAction/);

    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const nav = readFileSync("src/components/nav-header.tsx", "utf8");
    assert.match(shell, /href: "\/dkas"/);
    assert.match(nav, /href: "\/dkas"/);
  });

  it("server action DKAS hanya mengekspor fungsi async (kaidah Next.js)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/actions/dkas.ts", "utf8");
    assert.match(source, /^"use server";/);
    const exports = source.match(/^export (?:async )?function \w+/gm) ?? [];
    assert.ok(exports.length >= 2, "minimal 2 export action");
    for (const line of exports) {
      assert.match(line, /^export async function /, `export non-async: ${line}`);
    }
  });
});
