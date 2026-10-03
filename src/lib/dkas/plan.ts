/**
 * DKAS Bot — Validasi Rencana Query (Phase 12.7).
 *
 * `validatePlan` adalah gerbang tunggal yang dipakai SEMUA sumber rencana
 * (rule planner deterministik maupun LLM). Apa pun yang keluar dari fungsi
 * ini dijamin:
 *  - dataset dikenal & field/op ada di whitelist katalog,
 *  - tipe & rentang nilai sah (string ≤120 char, angka terbatas, tanggal valid),
 *  - jumlah kondisi ≤ 5, limit 1–50 (di-clamp, bukan ditolak — non-blocking),
 *  - tanpa kunci rahasia tenant (`institutionId` dsb. tidak ada di katalog).
 */

import { ValidationError } from "../validation/common";
import {
  DATASETS,
  DKAS_CONDITIONS_MAX,
  DKAS_LIMIT_DEFAULT,
  DKAS_LIMIT_MAX,
  DKAS_LIMIT_MIN,
  DKAS_NUMBER_MAX,
  DKAS_NUMBER_MIN,
  DKAS_VALUE_MAX,
  isDatasetId,
  PLAN_OPERATORS,
  type DatasetId,
  type PlanCondition,
  type PlanOperator,
  type QueryPlan,
} from "./catalog";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new ValidationError(message);
}

/**
 * Validasi nilai per field terhadap spesifikasi katalog (tipe, op, enum, rentang).
 * Terpisah agar mudah diuji dan dibaca.
 */
function validateConditionValue(
  field: string,
  operator: PlanOperator,
  rawValue: unknown,
  index: number,
  datasetId: DatasetId
): PlanCondition {
  const spec = DATASETS[datasetId];
  const fieldSpec = spec.fields[field];
  if (!fieldSpec) {
    const allowed = Object.keys(spec.fields).join(", ");
    fail(`Field "${field}" tidak ada di whitelist dataset "${datasetId}" (diizinkan: ${allowed}).`);
  }

  if (!fieldSpec.ops.includes(operator)) {
    fail(
      `Operator "${operator}" tidak didukung untuk field "${field}" (diizinkan: ${fieldSpec.ops.join(", ")}).`
    );
  }

  let value: string | number | string[];

  if (fieldSpec.type === "number") {
    if (operator === "in" || Array.isArray(rawValue)) {
      fail(`Field "${field}" bertipe angka dan tidak menerima daftar nilai.`);
    }
    const n = typeof rawValue === "string" ? Number(rawValue) : rawValue;
    if (typeof n !== "number" || !Number.isFinite(n)) {
      fail(`Nilai untuk "${field}" harus berupa angka yang valid.`);
    }
    if (n < DKAS_NUMBER_MIN || n > DKAS_NUMBER_MAX) {
      fail(`Nilai untuk "${field}" di luar rentang wajar (${DKAS_NUMBER_MIN}–${DKAS_NUMBER_MAX}).`);
    }
    value = n;
  } else if (fieldSpec.type === "date") {
    if (Array.isArray(rawValue)) {
      fail(`Field "${field}" bertipe tanggal dan tidak menerima daftar nilai.`);
    }
    const iso = String(rawValue).trim();
    if (!ISO_DATE.test(iso) || Number.isNaN(new Date(`${iso}T00:00:00.000Z`).getTime())) {
      fail(`Nilai untuk "${field}" harus tanggal valid berformat YYYY-MM-DD.`);
    }
    value = iso;
  } else if (fieldSpec.type === "enum") {
    const allowed = fieldSpec.enumValues ?? [];
    if (operator === "in") {
      if (!Array.isArray(rawValue) || rawValue.length === 0) {
        fail(`Operator "in" untuk field "${field}" membutuhkan daftar nilai.`);
      }
      if (rawValue.length > allowed.length) {
        fail(`Daftar nilai untuk "${field}" terlalu panjang.`);
      }
      for (const item of rawValue) {
        if (typeof item !== "string" || !allowed.includes(item)) {
          fail(`Nilai "${String(item)}" tidak valid untuk field "${field}" (diizinkan: ${allowed.join(", ")}).`);
        }
      }
      value = rawValue as string[];
    } else {
      if (Array.isArray(rawValue)) {
        fail(`Field "${field}" bertipe enum dan tidak menerima daftar nilai untuk operator "${operator}".`);
      }
      const single = String(rawValue).trim();
      if (!allowed.includes(single)) {
        fail(`Nilai "${single}" tidak valid untuk field "${field}" (diizinkan: ${allowed.join(", ")}).`);
      }
      value = single;
    }
  } else {
    // string
    if (operator === "in") {
      if (!Array.isArray(rawValue) || rawValue.length === 0) {
        fail(`Operator "in" untuk field "${field}" membutuhkan daftar nilai.`);
      }
      if (rawValue.length > 20) {
        fail(`Daftar nilai untuk "${field}" maksimal 20 entri.`);
      }
      for (const item of rawValue) {
        if (typeof item !== "string" || item.trim().length === 0 || item.length > DKAS_VALUE_MAX) {
          fail(`Nilai daftar untuk "${field}" harus teks 1–${DKAS_VALUE_MAX} karakter.`);
        }
      }
      value = (rawValue as string[]).map((v) => v.trim());
    } else {
      if (Array.isArray(rawValue)) {
        fail(`Field "${field}" bertipe teks dan tidak menerima daftar nilai untuk operator "${operator}".`);
      }
      const text = String(rawValue).trim();
      if (text.length === 0 || text.length > DKAS_VALUE_MAX) {
        fail(`Nilai untuk "${field}" harus teks 1–${DKAS_VALUE_MAX} karakter.`);
      }
      value = text;
    }
  }

  void index;
  return { field, op: operator, value };
}

/**
 * Validasi + normalisasi rencana query mentah (dari rule planner maupun LLM).
 * Melempar `ValidationError` (400) bila ada pelanggaran whitelist.
 */
export function validatePlan(raw: unknown, source = "planner"): QueryPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`Rencana query dari ${source} bukan objek yang valid.`);
  }
  const input = raw as Record<string, unknown>;

  const datasetId = input.dataset;
  if (!isDatasetId(datasetId)) {
    fail(
      `Dataset "${String(datasetId)}" tidak dikenal. Pilihan dataset: ${Object.keys(DATASETS).join(", ")}.`
    );
  }

  const rawConditions = input.conditions;
  const conditions: PlanCondition[] = [];
  if (rawConditions !== undefined) {
    if (!Array.isArray(rawConditions)) {
      fail("Kondisi query harus berupa daftar (array).");
    }
    if (rawConditions.length > DKAS_CONDITIONS_MAX) {
      fail(`Maksimal ${DKAS_CONDITIONS_MAX} kondisi per pertanyaan.`);
    }
    for (let i = 0; i < rawConditions.length; i += 1) {
      conditions.push(validateConditionInternal(rawConditions[i], i, datasetId));
    }
  }

  // Limit: clamp (non-blocking) — angka liar dari LLM tidak menggagalkan query.
  const rawLimit = input.limit;
  let limit = DKAS_LIMIT_DEFAULT;
  if (rawLimit !== undefined && rawLimit !== null) {
    const n = typeof rawLimit === "string" ? Number(rawLimit) : rawLimit;
    if (typeof n !== "number" || !Number.isFinite(n)) {
      fail("Limit hasil harus berupa angka.");
    }
    limit = Math.min(DKAS_LIMIT_MAX, Math.max(DKAS_LIMIT_MIN, Math.round(n)));
  }

  // orderBy: hanya key yang terdaftar per dataset.
  const spec = DATASETS[datasetId];
  let orderBy: string | undefined;
  if (input.orderBy !== undefined && input.orderBy !== null && input.orderBy !== "") {
    const key = String(input.orderBy);
    if (!Object.prototype.hasOwnProperty.call(spec.orderBy, key)) {
      fail(
        `Pengurutan "${key}" tidak diizinkan untuk dataset "${datasetId}" (diizinkan: ${Object.keys(spec.orderBy).join(", ")}).`
      );
    }
    orderBy = key;
  } else {
    orderBy = spec.defaultOrderBy;
  }

  const plan: QueryPlan = { dataset: datasetId, conditions, limit };
  plan.orderBy = orderBy;
  return plan;
}

/** Validasi satu kondisi terhadap katalog dataset terpilih. */
function validateConditionInternal(
  raw: unknown,
  index: number,
  datasetId: DatasetId
): PlanCondition {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`Kondisi ke-${index + 1} bukan objek yang valid.`);
  }
  const input = raw as Record<string, unknown>;
  const { field, op, value } = input;

  if (typeof field !== "string" || field.trim().length === 0) {
    fail(`Kondisi ke-${index + 1} tidak memiliki nama field.`);
  }
  if (typeof op !== "string" || !(PLAN_OPERATORS as readonly string[]).includes(op)) {
    fail(
      `Operator "${String(op)}" pada field "${String(field)}" tidak diizinkan (whitelist: ${PLAN_OPERATORS.join(", ")}).`
    );
  }
  if (value === undefined || value === null) {
    fail(`Kondisi untuk field "${String(field)}" tidak memiliki nilai.`);
  }

  return validateConditionValue(
    field.trim(),
    op as PlanOperator,
    value,
    index,
    datasetId
  );
}

/** Ringkas rencana menjadi kalimat manusiawi untuk UI chat. */
export function describePlan(plan: QueryPlan): string {
  const spec = DATASETS[plan.dataset];
  if (plan.conditions.length === 0) {
    return `Menampilkan hingga ${plan.limit} data ${spec.label} (tanpa filter).`;
  }
  const parts = plan.conditions.map((c) => {
    const label = spec.fields[c.field]?.label ?? c.field;
    const value = Array.isArray(c.value) ? c.value.join(" / ") : String(c.value);
    const opText: Record<PlanOperator, string> = {
      equals: "adalah",
      notEquals: "bukan",
      in: "termasuk",
      contains: "berisi",
      gte: "≥",
      lte: "≤",
    };
    return `${label} ${opText[c.op]} ${value}`;
  });
  return `Menampilkan hingga ${plan.limit} data ${spec.label} — ${parts.join("; ")}.`;
}
