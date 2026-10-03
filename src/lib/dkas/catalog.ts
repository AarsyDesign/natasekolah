/**
 * DKAS Bot — Katalog Dataset & Whitelist Field/Operator (Phase 12.7).
 *
 * Prinsip keamanan (sumber kebenaran tunggal):
 * - Klien / LLM TIDAK PERNAH mengirim objek Prisma. Yang dikirim hanya
 *   `{ field, op, value }` dengan `field` & `op` wajib ada di katalog ini,
 *   lalu diterjemahkan menjadi fragmen where oleh `FieldSpec.where`.
 * - Kolom identitas tenant (`institutionId`) TIDAK PERNAH muncul di katalog;
 *   selalu disuntikkan dari `ctx.institutionId` di executor.
 * - Setiap dataset punya izin minimum sendiri sehingga guru/staf hanya bisa
 *   menarik domain yang memang berhak mereka lihat.
 */

import type { Permission } from "../auth/permissions";

export type DatasetId = "santri" | "kehadiran" | "nilai" | "izin";

/** Operator yang diizinkan planner (whitelist ketat — tanpa operator raw). */
export type PlanOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "contains"
  | "gte"
  | "lte";

export const PLAN_OPERATORS: readonly PlanOperator[] = [
  "equals",
  "notEquals",
  "in",
  "contains",
  "gte",
  "lte",
];

export type PlanValue = string | number | string[];

/** Batas nilai yang diterima planner (mencegah query liar / DoS). */
export const DKAS_VALUE_MAX = 120;
export const DKAS_NUMBER_MIN = 0;
export const DKAS_NUMBER_MAX = 100_000;
export const DKAS_CONDITIONS_MAX = 5;
export const DKAS_LIMIT_MIN = 1;
export const DKAS_LIMIT_MAX = 50;
export const DKAS_LIMIT_DEFAULT = 20;
export const DKAS_QUERY_MAX = 300;

export interface PlanCondition {
  field: string;
  op: PlanOperator;
  value: PlanValue;
}

/** Rencana query aman (bentuk netral, bebas dari detail Prisma). */
export interface QueryPlan {
  dataset: DatasetId;
  conditions: PlanCondition[];
  orderBy?: string;
  limit: number;
}

/** Satu baris hasil siap tampil (dipakai UI chat & fallback daftar). */
export interface DkasRow {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  meta?: Record<string, string | number>;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: "string" | "enum" | "number" | "date";
  enumValues?: readonly string[];
  ops: readonly PlanOperator[];
  /** Susun fragmen where Prisma UTUH (sudah termasuk key kolom/relnya). */
  where: (op: PlanOperator, value: PlanValue) => Record<string, unknown>;
}

function containsInsensitive(value: string): Record<string, unknown> {
  return { contains: value, mode: "insensitive" };
}

/** Susun objek bersarang dari path kolom, mis. ["session","attendanceDate"]. */
function nest(path: string[], value: unknown): Record<string, unknown> {
  let node: Record<string, unknown> = { [path[path.length - 1]]: value };
  for (let i = path.length - 2; i >= 0; i -= 1) {
    node = { [path[i]]: node };
  }
  return node;
}

/** Tanggal `YYYY-MM-DD` → rentang UTC sehari penuh. */
function utcDayRange(iso: string): { gte: Date; lte: Date } {
  const start = new Date(`${iso}T00:00:00.000Z`);
  return { gte: start, lte: new Date(start.getTime() + 86_399_999) };
}

/**
 * SEMUA builder field mengembalikan fragmen where UTUH yang sudah dibungkus
 * nama kolom/relnya (contoh: `{ status: { equals: "ACTIVE" } }`), sehingga
 * executor cukup mendorongnya ke dalam `AND` — tanpa perlu menebak key.
 */
function textField(key: string, label: string, path: string[] = [key]): FieldSpec {
  return {
    key,
    label,
    type: "string",
    ops: ["equals", "notEquals", "contains", "in"],
    where: (op, value) => {
      if (op === "contains") return nest(path, containsInsensitive(String(value)));
      if (op === "notEquals") return nest(path, { not: String(value) });
      if (op === "in") return nest(path, { in: value as string[] });
      return nest(path, { equals: String(value) });
    },
  };
}

function enumField(
  key: string,
  label: string,
  enumValues: readonly string[],
  path: string[] = [key]
): FieldSpec {
  return {
    key,
    label,
    type: "enum",
    enumValues,
    ops: ["equals", "notEquals", "in"],
    where: (op, value) => {
      if (op === "notEquals") return nest(path, { not: String(value) });
      if (op === "in") return nest(path, { in: value as string[] });
      return nest(path, { equals: String(value) });
    },
  };
}

function numberField(key: string, label: string, path: string[] = [key]): FieldSpec {
  return {
    key,
    label,
    type: "number",
    ops: ["equals", "gte", "lte"],
    where: (op, value) => {
      const n = Number(value);
      if (op === "gte") return nest(path, { gte: n });
      if (op === "lte") return nest(path, { lte: n });
      return nest(path, { equals: n });
    },
  };
}

function dateField(key: string, label: string, path: string[] = [key]): FieldSpec {
  return {
    key,
    label,
    type: "date",
    ops: ["equals", "gte", "lte"],
    where: (op, value) => {
      const range = utcDayRange(String(value));
      if (op === "gte") return nest(path, { gte: range.gte });
      if (op === "lte") return nest(path, { lte: range.lte });
      return nest(path, range);
    },
  };
}

// ---------------------------------------------------------------------------
// Label & daftar nilai resmi
// ---------------------------------------------------------------------------

export const STUDENT_STATUS = [
  "ACTIVE",
  "INACTIVE",
  "GRADUATED",
  "TRANSFERRED",
  "ALUMNI",
] as const;
export const ATTENDANCE_STATUS = ["PRESENT", "EXCUSED", "SICK", "ABSENT"] as const;
export const PERMIT_STATUS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "OVERDUE",
] as const;
export const PERMIT_TYPE = ["HOME_LEAVE", "SICK_LEAVE", "EXCUSED"] as const;
export const GENDER = ["L", "P"] as const;

export const STUDENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  GRADUATED: "Lulus",
  TRANSFERRED: "Pindah",
  ALUMNI: "Alumni",
};

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PRESENT: "Hadir",
  EXCUSED: "Izin",
  SICK: "Sakit",
  ABSENT: "Alpha",
};

export const PERMIT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  RETURNED: "Sudah kembali",
  OVERDUE: "Terlambat",
};

export const PERMIT_TYPE_LABEL: Record<string, string> = {
  HOME_LEAVE: "Izin pulang",
  SICK_LEAVE: "Izin sakit",
  EXCUSED: "Izin lainnya",
};

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------

export interface DatasetSpec {
  id: DatasetId;
  label: string;
  description: string;
  /** Izin minimum untuk menarik dataset ini (di samping `dkas:query`). */
  permission: Permission;
  /** Nama delegate Prisma (`prisma[<model>]`). */
  model: "student" | "attendanceRecord" | "assessmentScore" | "permitRequest";
  fields: Record<string, FieldSpec>;
  orderBy: Record<string, Record<string, unknown>>;
  defaultOrderBy: string;
  select: Record<string, unknown>;
  mapRow: (row: Record<string, any>) => DkasRow;
  /** Contoh pertanyaan untuk chip saran di UI & pesan bantuan. */
  samples: string[];
}

const SANTRI: DatasetSpec = {
  id: "santri",
  label: "Buku Induk Santri",
  description: "Data induk siswa: nama, NIS/NISN, status, jenis kelamin, rombel.",
  permission: "student:view",
  model: "student",
  fields: {
    nama: textField("nama", "Nama siswa", ["fullName"]),
    nis: textField("nis", "NIS", ["nis"]),
    nisn: textField("nisn", "NISN", ["nisn"]),
    status: enumField("status", "Status kesiswaan", STUDENT_STATUS, ["status"]),
    gender: enumField("gender", "Jenis kelamin (L/P)", GENDER, ["gender"]),
    rombel: {
      key: "rombel",
      label: "Rombel (kelas aktif)",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        enrollments: {
          some: {
            status: "ENROLLED",
            classroom: {
              name: op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
            },
          },
        },
      }),
    },
  },
  orderBy: {
    nama: { fullName: "asc" },
    nis: { nis: "asc" },
    status: { status: "asc" },
  },
  defaultOrderBy: "nama",
  select: {
    id: true,
    fullName: true,
    nis: true,
    nisn: true,
    status: true,
    gender: true,
  },
  mapRow: (r) => ({
    id: r.id,
    title: r.fullName,
    subtitle: `NIS ${r.nis}${r.nisn ? ` · NISN ${r.nisn}` : ""}${
      r.gender ? ` · ${r.gender === "L" ? "Laki-laki" : "Perempuan"}` : ""
    }`,
    badge: STUDENT_STATUS_LABEL[r.status] ?? r.status,
    meta: { status: r.status },
  }),
  samples: [
    "Santri berstatus aktif",
    "Santri kelas 7A",
    'Santri dengan nama "Ahmad"',
    "Santri berstatus alumni",
  ],
};

const KEHADIRAN: DatasetSpec = {
  id: "kehadiran",
  label: "Kehadiran / Presensi",
  description: "Rekaman presensi siswa: hadir, sakit, izin, alpha per tanggal.",
  permission: "attendance:view",
  model: "attendanceRecord",
  fields: {
    status: enumField("status", "Status kehadiran", ATTENDANCE_STATUS, ["status"]),
    tanggal: dateField("tanggal", "Tanggal presensi", ["session", "attendanceDate"]),
    siswa: {
      key: "siswa",
      label: "Nama siswa",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        student: {
          fullName:
            op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
        },
      }),
    },
    rombel: {
      key: "rombel",
      label: "Rombel (penugasan presensi)",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        session: {
          teacherAssignment: {
            classroom: {
              name:
                op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
            },
          },
        },
      }),
    },
    konteks: enumField("konteks", "Konteks presensi", ["ACADEMIC", "LIVING"], [
      "session",
      "context",
    ]),
  },
  orderBy: {
    tanggal: { session: { attendanceDate: "desc" } },
    siswa: { student: { fullName: "asc" } },
  },
  defaultOrderBy: "tanggal",
  select: {
    id: true,
    status: true,
    note: true,
    session: { select: { attendanceDate: true, context: true } },
    student: { select: { fullName: true, nis: true } },
  },
  mapRow: (r) => ({
    id: r.id,
    title: r.student?.fullName ?? "Siswa",
    subtitle: `${ATTENDANCE_STATUS_LABEL[r.status] ?? r.status} · ${String(
      r.session?.attendanceDate ?? ""
    ).slice(0, 10)} · NIS ${r.student?.nis ?? "-"}`,
    badge: ATTENDANCE_STATUS_LABEL[r.status] ?? r.status,
    meta: { status: r.status },
  }),
  samples: [
    "Siswa yang alpha hari ini",
    "Presensi sakit minggu ini",
    "Kehadiran siswa kelas 7A kemarin",
    "Siswa yang hadir hari ini",
  ],
};

const NILAI: DatasetSpec = {
  id: "nilai",
  label: "Nilai / Penilaian",
  description: "Skor penilaian siswa per butir penilaian (assessment).",
  permission: "academic:view",
  model: "assessmentScore",
  fields: {
    skor: numberField("skor", "Nilai (skor)", ["score"]),
    siswa: {
      key: "siswa",
      label: "Nama siswa",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        student: {
          fullName:
            op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
        },
      }),
    },
    penilaian: {
      key: "penilaian",
      label: "Judul penilaian",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        assessment: {
          title:
            op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
        },
      }),
    },
    jenis: enumField("jenis", "Jenis penilaian", [
      "DAILY",
      "QUIZ",
      "MIDTERM",
      "FINAL",
      "PROJECT",
      "OTHER",
    ], ["assessment", "type"]),
  },
  orderBy: {
    skor: { score: "desc" },
    siswa: { student: { fullName: "asc" } },
  },
  defaultOrderBy: "skor",
  select: {
    id: true,
    score: true,
    student: { select: { fullName: true, nis: true } },
    assessment: { select: { title: true, maxScore: true, type: true } },
  },
  mapRow: (r) => ({
    id: r.id,
    title: r.student?.fullName ?? "Siswa",
    subtitle: `${r.score}/${r.assessment?.maxScore ?? 100} · ${
      r.assessment?.title ?? "Penilaian"
    } · NIS ${r.student?.nis ?? "-"}`,
    badge: `${r.score}`,
    meta: { skor: r.score },
  }),
  samples: [
    "Nilai di bawah 70",
    "Nilai di atas 85",
    'Nilai penilaian "UTS" siswa Ahmad',
  ],
};

const IZIN: DatasetSpec = {
  id: "izin",
  label: "Tasrih / Izin Pulang",
  description: "Permohonan izin pulang santri beserta status persetujuannya.",
  permission: "pesantren:view",
  model: "permitRequest",
  fields: {
    status: enumField("status", "Status izin", PERMIT_STATUS, ["status"]),
    jenis: enumField("jenis", "Jenis izin", PERMIT_TYPE, ["type"]),
    tanggal: dateField("tanggal", "Tanggal berangkat", ["leaveAt"]),
    siswa: {
      key: "siswa",
      label: "Nama siswa",
      type: "string",
      ops: ["equals", "contains"],
      where: (op, value) => ({
        student: {
          fullName:
            op === "contains" ? containsInsensitive(String(value)) : { equals: String(value) },
        },
      }),
    },
  },
  orderBy: {
    tanggal: { leaveAt: "desc" },
    siswa: { student: { fullName: "asc" } },
  },
  defaultOrderBy: "tanggal",
  select: {
    id: true,
    status: true,
    type: true,
    leaveAt: true,
    returnAt: true,
    student: { select: { fullName: true, nis: true } },
  },
  mapRow: (r) => ({
    id: r.id,
    title: r.student?.fullName ?? "Santri",
    subtitle: `${PERMIT_TYPE_LABEL[r.type] ?? r.type} · berangkat ${String(
      r.leaveAt ?? ""
    ).slice(0, 10)} · NIS ${r.student?.nis ?? "-"}`,
    badge: PERMIT_STATUS_LABEL[r.status] ?? r.status,
    meta: { status: r.status },
  }),
  samples: [
    "Izin yang belum disetujui",
    "Izin terlambat kembali",
    "Izin pulang hari ini",
  ],
};

export const DATASETS: Record<DatasetId, DatasetSpec> = {
  santri: SANTRI,
  kehadiran: KEHADIRAN,
  nilai: NILAI,
  izin: IZIN,
};

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[];

export function isDatasetId(value: unknown): value is DatasetId {
  return typeof value === "string" && (DATASET_IDS as string[]).includes(value);
}

/**
 * Ringkas katalog menjadi bentuk JSON untuk prompt planner LLM
 * (hanya label + daftar field/operator, tanpa detail Prisma).
 */
export function catalogForPrompt(): Array<{
  dataset: DatasetId;
  label: string;
  description: string;
  fields: Array<{ field: string; label: string; type: string; ops: string[]; enumValues?: string[] }>;
}> {
  return DATASET_IDS.map((id) => {
    const spec = DATASETS[id];
    return {
      dataset: id,
      label: spec.label,
      description: spec.description,
      fields: Object.values(spec.fields).map((f) => ({
        field: f.key,
        label: f.label,
        type: f.type,
        ops: [...f.ops],
        ...(f.enumValues ? { enumValues: [...f.enumValues] } : {}),
      })),
    };
  });
}
