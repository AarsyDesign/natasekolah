import type { TerminologyDictionary } from "./types";

export const DEFAULT_SEKOLAH_TERMINOLOGY: TerminologyDictionary = {
  student: "Siswa",
  studentPlural: "Siswa",
  guardian: "Wali Murid",
  classroom: "Kelas",
  academicYear: "Tahun Ajaran",
  fee: "SPP",
  teacher: "Guru",
};

export const DEFAULT_PESANTREN_TERMINOLOGY: TerminologyDictionary = {
  student: "Santri",
  studentPlural: "Santri",
  guardian: "Wali Santri",
  classroom: "Halaqah",
  academicYear: "Tahun Ajaran",
  fee: "Syahriah",
  teacher: "Ustadz",
};

export const DEFAULT_RUMAH_TAHFIDZ_TERMINOLOGY: TerminologyDictionary = {
  student: "Santri",
  studentPlural: "Santri",
  guardian: "Wali Santri",
  classroom: "Halaqah",
  academicYear: "Tahun Ajaran",
  fee: "Infaq / Syahriah",
  teacher: "Ustadz / Muhaffizh",
};

export const DEFAULT_PKBM_TERMINOLOGY: TerminologyDictionary = {
  student: "Warga Belajar",
  studentPlural: "Warga Belajar",
  guardian: "Wali / Keluarga",
  classroom: "Kelompok Belajar",
  academicYear: "Tahun Ajaran",
  fee: "Iuran Belajar",
  teacher: "Tutor",
};

/**
 * Menyelesaikan kamus terminologi lembaga dengan memilih preset bawaan
 * berdasarkan jenis institusi (Sekolah, Pesantren, Tahfidz, PKBM) dan menggabungkan
 * istilah kustom yang ditentukan pengguna di basis data.
 */
export function resolveInstitutionTerminology(
  institutionType: string,
  customTerms?: Partial<TerminologyDictionary> | null
): TerminologyDictionary {
  let basePreset: TerminologyDictionary;

  switch (institutionType?.toUpperCase()) {
    case "PESANTREN":
    case "PESANTREN_TERPADU":
      basePreset = DEFAULT_PESANTREN_TERMINOLOGY;
      break;
    case "RUMAH_TAHFIDZ":
      basePreset = DEFAULT_RUMAH_TAHFIDZ_TERMINOLOGY;
      break;
    case "PKBM":
      basePreset = DEFAULT_PKBM_TERMINOLOGY;
      break;
    case "SEKOLAH":
    default:
      basePreset = DEFAULT_SEKOLAH_TERMINOLOGY;
      break;
  }

  if (!customTerms || typeof customTerms !== "object") {
    return { ...basePreset };
  }

  return {
    student: customTerms.student?.trim() || basePreset.student,
    studentPlural: customTerms.studentPlural?.trim() || basePreset.studentPlural,
    guardian: customTerms.guardian?.trim() || basePreset.guardian,
    classroom: customTerms.classroom?.trim() || basePreset.classroom,
    academicYear: customTerms.academicYear?.trim() || basePreset.academicYear,
    fee: customTerms.fee?.trim() || basePreset.fee,
    teacher: customTerms.teacher?.trim() || basePreset.teacher,
  };
}

/**
 * Mendapatkan daftar preset terminologi untuk memudahkan pemilihan otomatis di UI.
 */
export function getTerminologyPresets(): Record<string, { label: string; terms: TerminologyDictionary }> {
  return {
    SEKOLAH: {
      label: "Sekolah Formal (SD/SMP/SMA/SMK)",
      terms: DEFAULT_SEKOLAH_TERMINOLOGY,
    },
    PESANTREN: {
      label: "Pondok Pesantren / Salaf",
      terms: DEFAULT_PESANTREN_TERMINOLOGY,
    },
    RUMAH_TAHFIDZ: {
      label: "Rumah Tahfidz / Halaqah Quran",
      terms: DEFAULT_RUMAH_TAHFIDZ_TERMINOLOGY,
    },
    PKBM: {
      label: "Pusat Kegiatan Belajar Masyarakat (PKBM)",
      terms: DEFAULT_PKBM_TERMINOLOGY,
    },
  };
}
