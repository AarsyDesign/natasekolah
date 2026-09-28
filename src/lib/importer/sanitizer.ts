/**
 * Auto-Sanitizer untuk Data Pendidikan Indonesia NataSekolah.
 *
 * Menangani anomali data spreadsheet yang umum:
 * - Spasi berlebih, spasi non-breaking (NBSP)
 * - Format tanggal Excel serial number & string (DD/MM/YYYY, YYYY-MM-DD)
 * - Format nomor telepon (+62, 08, 628, tanda hubung)
 * - Identitas NIS/NISN/NIK yang terpotong atau tersimpan sebagai float (1001.0)
 * - Variasi penulisan jenis kelamin (Laki-laki, Perempuan, Pria, Wanita)
 * - Pencegahan Formula Injection (CSV/Excel)
 */

export interface SanitizedPhoneResult {
  phone: string | null;
  warning?: string;
  error?: string;
}

export interface SanitizedDateResult {
  date: Date | null;
  dateString?: string;
  error?: string;
}

export interface SanitizedGenderResult {
  gender: "L" | "P" | null;
  error?: string;
}

/**
 * Membersihkan string teks umum:
 * - Menghapus whitespace di awal & akhir
 * - Menormalkan spasi ganda menjadi spasi tunggal
 * - Mengubah string kosong, "-", "null", "N/A" menjadi null
 * - Netralisasi potensi formula injection jika diawali tanda = @ + -
 */
export function cleanText(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  let str = String(val).replace(/\u00A0/g, " ").trim();
  if (!str) return null;

  // Normalisasi spasi berulang
  str = str.replace(/\s+/g, " ");

  // Nilai placeholder yang bermakna kosong
  const lower = str.toLowerCase();
  if (lower === "-" || lower === "--" || lower === "null" || lower === "undefined" || lower === "n/a" || lower === "none") {
    return null;
  }

  // Formula injection defense: jika diawali karakter formula berbahaya, beri prefix kutip aman
  if (/^[=+@-][a-zA-Z0-9]/.test(str)) {
    str = `'${str}`;
  }

  return str;
}

/**
 * Membersihkan nomor identitas (NIS / NISN / NIK):
 * - Menghapus ekstensi desimal jika Excel mengonversi angka ke float (contoh: 12345.0 -> 12345)
 * - Menghilangkan spasi dan tanda pemisah
 */
export function cleanIdentityNumber(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  let str = String(val).trim();
  if (!str) return null;

  // Jika terbaca sebagai float dari Excel (e.g. 1001.0 atau 1234567890.0)
  if (/\.0+$/.test(str)) {
    str = str.replace(/\.0+$/, "");
  }

  // Hapus spasi dan tanda minus di tengah angka identitas
  str = str.replace(/[\s-]/g, "");

  const cleaned = cleanText(str);
  return cleaned;
}

/**
 * Normalisasi nomor WhatsApp / HP Indonesia:
 * - Menghapus karakter non-digit kecuali tanda plus di awal
 * - Mengubah format 08... menjadi 628...
 * - Menolak nomor yang bukan seluler Indonesia (harus diawali 628 dan panjang 10-14 digit)
 */
export function cleanIndonesianPhone(val: unknown): SanitizedPhoneResult {
  const text = cleanText(val);
  if (!text) {
    return { phone: null };
  }

  // Ekstrak digit
  let digits = text.replace(/\D/g, "");

  if (!digits) {
    return { phone: null, error: "Nomor telepon tidak berisi angka" };
  }

  let warning: string | undefined;

  // Normalisasi 08... -> 628...
  if (digits.startsWith("08")) {
    digits = "62" + digits.slice(1);
    warning = "Format '08' otomatis dinormalisasi ke format internasional '628'";
  } else if (digits.startsWith("8")) {
    digits = "62" + digits;
    warning = "Format '8' otomatis dinormalisasi ke '628'";
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }

  // Validasi format nomor seluler Indonesia (628 + 8..12 digit = 11..15 total digit)
  if (!/^628\d{8,12}$/.test(digits)) {
    return {
      phone: null,
      error: `Nomor '${text}' bukan nomor seluler Indonesia yang valid (harus 08xx/628xx, 10-14 digit)`,
    };
  }

  return { phone: digits, warning };
}

/**
 * Normalisasi jenis kelamin (L / P):
 */
export function cleanGender(val: unknown): SanitizedGenderResult {
  const text = cleanText(val);
  if (!text) {
    return { gender: null, error: "Jenis kelamin wajib diisi (L / P)" };
  }

  const normalized = text.toUpperCase();

  if (
    normalized === "L" ||
    normalized === "LAKI-LAKI" ||
    normalized === "LAKI" ||
    normalized === "PRIA" ||
    normalized === "M" ||
    normalized === "MALE"
  ) {
    return { gender: "L" };
  }

  if (
    normalized === "P" ||
    normalized === "PEREMPUAN" ||
    normalized === "WANITA" ||
    normalized === "F" ||
    normalized === "FEMALE"
  ) {
    return { gender: "P" };
  }

  return {
    gender: null,
    error: `Jenis kelamin '${text}' tidak dikenal. Gunakan L (Laki-laki) atau P (Perempuan)`,
  };
}

/**
 * Konversi tanggal lahir dari berbagai format:
 * 1. Excel Serial Number (e.g. 38450)
 * 2. String standar Indonesia: DD/MM/YYYY atau DD-MM-YYYY
 * 3. String ISO: YYYY-MM-DD
 * 4. Instance Date JavaScript
 */
export function cleanDate(val: unknown): SanitizedDateResult {
  if (val === null || val === undefined || val === "") {
    return { date: null };
  }

  // Jika input sudah merupakan Date object valid
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return { date: val, dateString: val.toISOString().slice(0, 10) };
    }
    return { date: null, error: "Format tanggal tidak valid" };
  }

  // Jika berupa angka serial Excel (biasanya > 1000 dan < 60000)
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
    const num = Number(val);
    if (num > 1000 && num < 70000) {
      // Excel epoch: Dec 30, 1899 UTC
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsedDate = new Date(excelEpoch.getTime() + num * 86400 * 1000);
      if (!isNaN(parsedDate.getTime())) {
        return {
          date: parsedDate,
          dateString: parsedDate.toISOString().slice(0, 10),
        };
      }
    }
  }

  const str = cleanText(val);
  if (!str) return { date: null };

  // Format ISO: YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateAndConstructDate(year, month, day, str);
  }

  // Format Indonesia: DD/MM/YYYY atau DD-MM-YYYY
  const idMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (idMatch) {
    const day = parseInt(idMatch[1], 10);
    const month = parseInt(idMatch[2], 10);
    const year = parseInt(idMatch[3], 10);
    return validateAndConstructDate(year, month, day, str);
  }

  return {
    date: null,
    error: `Format tanggal '${str}' tidak dikenali. Gunakan format DD/MM/YYYY atau YYYY-MM-DD`,
  };
}

function validateAndConstructDate(
  year: number,
  month: number,
  day: number,
  originalText: string
): SanitizedDateResult {
  if (month < 1 || month > 12) {
    return { date: null, error: `Bulan ${month} pada tanggal '${originalText}' tidak valid` };
  }

  // Validasi jumlah hari per bulan
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return {
      date: null,
      error: `Hari ${day} tidak valid untuk bulan ${month} pada tanggal '${originalText}'`,
    };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1940 || year > currentYear + 1) {
    return {
      date: null,
      error: `Tahun lahir ${year} tidak wajar`,
    };
  }

  const d = new Date(Date.UTC(year, month - 1, day));
  return {
    date: d,
    dateString: d.toISOString().slice(0, 10),
  };
}

/**
 * Normalisasi relasi wali murid:
 */
export function cleanRelationship(val: unknown): "AYAH" | "IBU" | "WALI" | "LAINNYA" {
  const text = cleanText(val);
  if (!text) return "WALI";

  const upper = text.toUpperCase();
  if (upper.includes("AYAH") || upper.includes("BAPAK") || upper === "FATHER" || upper === "PAPA") {
    return "AYAH";
  }
  if (upper.includes("IBU") || upper.includes("MAMA") || upper === "MOTHER" || upper === "BUNDAH" || upper === "BUNDA") {
    return "IBU";
  }
  if (upper.includes("WALI") || upper === "GUARDIAN") {
    return "WALI";
  }
  return "LAINNYA";
}
