/**
 * Quran Metadata & Ayah Validation Abstraction (Phase 6).
 *
 * Menyediakan struktur ringkas 114 surah dengan jumlah ayat masing-masing
 * untuk validasi rentang ayat tanpa memerlukan database Quran eksternal.
 */

export interface SurahMetadata {
  number: number;
  name: string;
  totalAyahs: number;
}

// Matriks 114 Surah Al-Qur'an (Nomor, Nama Latin, Jumlah Ayat)
export const QURAN_SURAHS: Record<number, SurahMetadata> = {
  1: { number: 1, name: "Al-Fatihah", totalAyahs: 7 },
  2: { number: 2, name: "Al-Baqarah", totalAyahs: 286 },
  3: { number: 3, name: "Ali 'Imran", totalAyahs: 200 },
  4: { number: 4, name: "An-Nisa'", totalAyahs: 176 },
  5: { number: 5, name: "Al-Ma'idah", totalAyahs: 120 },
  6: { number: 6, name: "Al-An'am", totalAyahs: 165 },
  7: { number: 7, name: "Al-A'raf", totalAyahs: 206 },
  8: { number: 8, name: "Al-Anfal", totalAyahs: 75 },
  9: { number: 9, name: "At-Taubah", totalAyahs: 129 },
  10: { number: 10, name: "Yunus", totalAyahs: 109 },
  11: { number: 11, name: "Hud", totalAyahs: 123 },
  12: { number: 12, name: "Yusuf", totalAyahs: 111 },
  13: { number: 13, name: "Ar-Ra'd", totalAyahs: 43 },
  14: { number: 14, name: "Ibrahim", totalAyahs: 52 },
  15: { number: 15, name: "Al-Hijr", totalAyahs: 99 },
  16: { number: 16, name: "An-Nahl", totalAyahs: 128 },
  17: { number: 17, name: "Al-Isra'", totalAyahs: 111 },
  18: { number: 18, name: "Al-Kahf", totalAyahs: 110 },
  19: { number: 19, name: "Maryam", totalAyahs: 98 },
  20: { number: 20, name: "Ta-Ha", totalAyahs: 135 },
  21: { number: 21, name: "Al-Anbiya'", totalAyahs: 112 },
  22: { number: 22, name: "Al-Hajj", totalAyahs: 78 },
  23: { number: 23, name: "Al-Mu'minun", totalAyahs: 118 },
  24: { number: 24, name: "An-Nur", totalAyahs: 64 },
  25: { number: 25, name: "Al-Furqan", totalAyahs: 77 },
  26: { number: 26, name: "Asy-Syu'ara'", totalAyahs: 227 },
  27: { number: 27, name: "An-Naml", totalAyahs: 93 },
  28: { number: 28, name: "Al-Qashas", totalAyahs: 88 },
  29: { number: 29, name: "Al-'Ankabut", totalAyahs: 69 },
  30: { number: 30, name: "Ar-Rum", totalAyahs: 60 },
  31: { number: 31, name: "Luqman", totalAyahs: 34 },
  32: { number: 32, name: "As-Sajdah", totalAyahs: 30 },
  33: { number: 33, name: "Al-Ahzab", totalAyahs: 73 },
  34: { number: 34, name: "Saba'", totalAyahs: 54 },
  35: { number: 35, name: "Fathir", totalAyahs: 45 },
  36: { number: 36, name: "Ya-Sin", totalAyahs: 83 },
  37: { number: 37, name: "Ash-Shaffat", totalAyahs: 182 },
  38: { number: 38, name: "Shad", totalAyahs: 88 },
  39: { number: 39, name: "Az-Zumar", totalAyahs: 75 },
  40: { number: 40, name: "Ghafir", totalAyahs: 85 },
  41: { number: 41, name: "Fushshilat", totalAyahs: 54 },
  42: { number: 42, name: "Asy-Syura", totalAyahs: 53 },
  43: { number: 43, name: "Az-Zukhruf", totalAyahs: 89 },
  44: { number: 44, name: "Ad-Dukhan", totalAyahs: 59 },
  45: { number: 45, name: "Al-Jatsiyah", totalAyahs: 37 },
  46: { number: 46, name: "Al-Ahqaf", totalAyahs: 35 },
  47: { number: 47, name: "Muhammad", totalAyahs: 38 },
  48: { number: 48, name: "Al-Fath", totalAyahs: 29 },
  49: { number: 49, name: "Al-Hujurat", totalAyahs: 18 },
  50: { number: 50, name: "Qaf", totalAyahs: 45 },
  51: { number: 51, name: "Adz-Dzariyat", totalAyahs: 60 },
  52: { number: 52, name: "Ath-Thur", totalAyahs: 49 },
  53: { number: 53, name: "An-Najm", totalAyahs: 62 },
  54: { number: 54, name: "Al-Qamar", totalAyahs: 55 },
  55: { number: 55, name: "Ar-Rahman", totalAyahs: 78 },
  56: { number: 56, name: "Al-Waqi'ah", totalAyahs: 96 },
  57: { number: 57, name: "Al-Hadid", totalAyahs: 29 },
  58: { number: 58, name: "Al-Mujadilah", totalAyahs: 22 },
  59: { number: 59, name: "Al-Hasyr", totalAyahs: 24 },
  60: { number: 60, name: "Al-Mumtahanah", totalAyahs: 13 },
  61: { number: 61, name: "Ash-Shaff", totalAyahs: 14 },
  62: { number: 62, name: "Al-Jumu'ah", totalAyahs: 11 },
  63: { number: 63, name: "Al-Munafiqun", totalAyahs: 11 },
  64: { number: 64, name: "At-Taghabun", totalAyahs: 18 },
  65: { number: 65, name: "Ath-Thalaq", totalAyahs: 12 },
  66: { number: 66, name: "At-Tahrim", totalAyahs: 12 },
  67: { number: 67, name: "Al-Mulk", totalAyahs: 30 },
  68: { number: 68, name: "Al-Qalam", totalAyahs: 52 },
  69: { number: 69, name: "Al-Haqqah", totalAyahs: 52 },
  70: { number: 70, name: "Al-Ma'arij", totalAyahs: 44 },
  71: { number: 71, name: "Nuh", totalAyahs: 28 },
  72: { number: 72, name: "Al-Jinn", totalAyahs: 28 },
  73: { number: 73, name: "Al-Muzzammil", totalAyahs: 20 },
  74: { number: 74, name: "Al-Muddatstsir", totalAyahs: 56 },
  75: { number: 75, name: "Al-Qiyamah", totalAyahs: 40 },
  76: { number: 76, name: "Al-Insan", totalAyahs: 31 },
  77: { number: 77, name: "Al-Mursalat", totalAyahs: 50 },
  78: { number: 78, name: "An-Naba'", totalAyahs: 40 },
  79: { number: 79, name: "An-Nazi'at", totalAyahs: 46 },
  80: { number: 80, name: "'Abasa", totalAyahs: 42 },
  81: { number: 81, name: "At-Takwir", totalAyahs: 29 },
  82: { number: 82, name: "Al-Infithar", totalAyahs: 19 },
  83: { number: 83, name: "Al-Muthaffifin", totalAyahs: 36 },
  84: { number: 84, name: "Al-Insyiqaq", totalAyahs: 25 },
  85: { number: 85, name: "Al-Buruj", totalAyahs: 22 },
  86: { number: 86, name: "Ath-Thariq", totalAyahs: 17 },
  87: { number: 87, name: "Al-A'la", totalAyahs: 19 },
  88: { number: 88, name: "Al-Ghasyiyah", totalAyahs: 26 },
  89: { number: 89, name: "Al-Fajr", totalAyahs: 30 },
  90: { number: 90, name: "Al-Balad", totalAyahs: 20 },
  91: { number: 91, name: "Asy-Syams", totalAyahs: 15 },
  92: { number: 92, name: "Al-Lail", totalAyahs: 21 },
  93: { number: 93, name: "Adh-Dhuha", totalAyahs: 11 },
  94: { number: 94, name: "Asy-Syarh", totalAyahs: 8 },
  95: { number: 95, name: "At-Tin", totalAyahs: 8 },
  96: { number: 96, name: "Al-'Alaq", totalAyahs: 19 },
  97: { number: 97, name: "Al-Qadr", totalAyahs: 5 },
  98: { number: 98, name: "Al-Bayyinah", totalAyahs: 8 },
  99: { number: 99, name: "Az-Zalzalah", totalAyahs: 8 },
  100: { number: 100, name: "Al-'Adiyat", totalAyahs: 11 },
  101: { number: 101, name: "Al-Qari'ah", totalAyahs: 11 },
  102: { number: 102, name: "At-Takatsur", totalAyahs: 8 },
  103: { number: 103, name: "Al-'Ashr", totalAyahs: 3 },
  104: { number: 104, name: "Al-Humazah", totalAyahs: 9 },
  105: { number: 105, name: "Al-Fil", totalAyahs: 5 },
  106: { number: 106, name: "Quraisy", totalAyahs: 4 },
  107: { number: 107, name: "Al-Ma'un", totalAyahs: 7 },
  108: { number: 108, name: "Al-Kautsar", totalAyahs: 3 },
  109: { number: 109, name: "Al-Kafirun", totalAyahs: 6 },
  110: { number: 110, name: "An-Nashr", totalAyahs: 3 },
  111: { number: 111, name: "Al-Lahab", totalAyahs: 5 },
  112: { number: 112, name: "Al-Ikhlash", totalAyahs: 4 },
  113: { number: 113, name: "Al-Falaq", totalAyahs: 5 },
  114: { number: 114, name: "An-Nas", totalAyahs: 6 },
};

/**
 * Mendapatkan metadata surah berdasarkan nomor surah (1 - 114).
 */
export function getSurahMetadata(surahNumber: number): SurahMetadata | null {
  return QURAN_SURAHS[surahNumber] ?? null;
}

/**
 * Memvalidasi apakah rentang ayat sah untuk surah yang ditentukan.
 */
export function validateAyahRange(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): { isValid: boolean; errorMessage?: string; surahName?: string } {
  const surah = getSurahMetadata(surahNumber);
  if (!surah) {
    return {
      isValid: false,
      errorMessage: `Nomor surah (${surahNumber}) tidak valid. Surah harus berada di antara 1 dan 114.`,
    };
  }

  if (startAyah < 1) {
    return {
      isValid: false,
      errorMessage: `Ayat awal (${startAyah}) tidak boleh kurang dari 1.`,
      surahName: surah.name,
    };
  }

  if (endAyah < startAyah) {
    return {
      isValid: false,
      errorMessage: `Ayat akhir (${endAyah}) tidak boleh lebih kecil dari ayat awal (${startAyah}).`,
      surahName: surah.name,
    };
  }

  if (endAyah > surah.totalAyahs) {
    return {
      isValid: false,
      errorMessage: `Ayat akhir (${endAyah}) melebihi jumlah total ayat surah ${surah.name} (${surah.totalAyahs} ayat).`,
      surahName: surah.name,
    };
  }

  return { isValid: true, surahName: surah.name };
}
