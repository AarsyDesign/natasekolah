import * as XLSX from "xlsx";
import type { RawImportRow } from "./types";

/**
 * Peta alias kolom ke properti kanonikal.
 * Mendukung variasi penamaan kolom bahasa Indonesia dan Inggris.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  nis: [
    "nis",
    "no_induk",
    "nomor_induk",
    "no induk",
    "nomor induk",
    "nomor induk siswa",
    "student_id",
    "no_siswa",
  ],
  nisn: ["nisn", "no_nisn", "nomor_nisn", "no. nisn"],
  nik: ["nik", "no_nik", "nomor_nik", "no_ktp", "nomor_ktp"],
  fullName: [
    "nama",
    "nama_lengkap",
    "nama lengkap",
    "nama siswa",
    "nama santri",
    "full_name",
    "fullname",
    "name",
    "student_name",
  ],
  nickname: ["panggilan", "nama_panggilan", "nama panggilan", "nickname"],
  gender: [
    "jk",
    "j_k",
    "jenis_kelamin",
    "jenis kelamin",
    "gender",
    "sex",
    "l/p",
    "lp",
  ],
  birthPlace: [
    "tempat_lahir",
    "tempat lahir",
    "tmp_lahir",
    "tmp lahir",
    "kota_lahir",
    "birth_place",
    "pob",
  ],
  birthDate: [
    "tanggal_lahir",
    "tanggal lahir",
    "tgl_lahir",
    "tgl lahir",
    "tgl",
    "birth_date",
    "dob",
  ],
  religion: ["agama", "religion"],
  address: [
    "alamat",
    "alamat_lengkap",
    "alamat domisili",
    "alamat rumah",
    "alamat tinggal",
    "address",
  ],
  phone: [
    "telepon",
    "telp",
    "no_hp",
    "no hp",
    "nomor_hp",
    "nomor hp",
    "hp",
    "phone",
    "no_wa",
    "whatsapp",
  ],
  email: ["email", "e-mail", "surel"],
  guardianName: [
    "nama_wali",
    "nama wali",
    "nama_orang_tua",
    "nama orang tua",
    "nama_ayah",
    "nama_ibu",
    "orang_tua",
    "wali",
    "parent_name",
    "guardian_name",
  ],
  guardianRelationship: [
    "hubungan_wali",
    "hubungan wali",
    "relasi_wali",
    "hubungan",
    "relasi",
    "status_wali",
    "relationship",
  ],
  guardianPhoneWa: [
    "hp_wali",
    "no_hp_wali",
    "no hp wali",
    "wa_wali",
    "no_wa_wali",
    "no wa wali",
    "telepon_wali",
    "parent_phone",
    "guardian_phone",
  ],
  classroomName: [
    "kelas",
    "rombel",
    "nama_kelas",
    "nama kelas",
    "nama_rombel",
    "nama rombel",
    "classroom",
    "class",
  ],
};

/**
 * Normalisasi nama header/kolom: lowercase, hapus karakter khusus, trim.
 */
function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[._\-/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Memetakan header mentah dari file ke nama properti kanonikal.
 */
export function buildHeaderMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const rawHeader of headers) {
    const norm = normalizeHeader(rawHeader);

    // Cari di kamus alias
    let matchedCanonical: string | null = null;

    for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === norm)) {
        matchedCanonical = canonical;
        break;
      }
    }

    if (matchedCanonical) {
      mapping[rawHeader] = matchedCanonical;
    }
  }

  return mapping;
}

/**
 * Membaca buffer file spreadsheet (Excel .xlsx, .xls, atau CSV)
 * dan mengonversi baris-baris data ke bentuk RawImportRow dengan kunci kanonikal.
 */
export function parseSpreadsheetBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  fileName: string
): {
  rawRows: RawImportRow[];
  headersFound: string[];
  recognizedCanonicalFields: string[];
} {
  // Validasi ekstensi file sederhana
  const lowerName = fileName.toLowerCase();
  const isAllowedExt =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv");

  if (!isAllowedExt) {
    throw new Error(
      `Format file '${fileName}' tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.`
    );
  }

  // Parse workbook dengan xlsx
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true, // Biarkan XLSX mengonversi tanggal Excel
      raw: false, // Gunakan formatted text jika memungkinkan, atau raw fallback
    });
  } catch (err: unknown) {
    throw new Error(
      `Gagal membaca file spreadsheet: ${err instanceof Error ? err.message : "File rusak atau tidak terbaca"}`
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("File spreadsheet tidak memiliki lembar kerja (worksheet).");
  }

  // Pilih sheet pertama atau sheet bernama Siswa / Data Siswa
  const sheetName =
    workbook.SheetNames.find((s) => /siswa|santri|data/i.test(s)) ||
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Lembar kerja '${sheetName}' kosong.`);
  }

  // Konversi worksheet ke array of objects
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: null,
    blankrows: false,
  });

  if (rawJson.length === 0) {
    return {
      rawRows: [],
      headersFound: [],
      recognizedCanonicalFields: [],
    };
  }

  // Ambil semua header dari baris pertama
  const rawHeaders = Object.keys(rawJson[0]);
  const headerMapping = buildHeaderMapping(rawHeaders);
  const recognizedFields = Array.from(new Set(Object.values(headerMapping)));

  // Petakan setiap baris
  const canonicalRows: RawImportRow[] = rawJson.map((row) => {
    const canonicalRow: RawImportRow = {};

    for (const [rawKey, val] of Object.entries(row)) {
      const canonicalKey = headerMapping[rawKey];
      if (canonicalKey) {
        canonicalRow[canonicalKey] = val;
      } else {
        // Simpan juga raw key yang tidak terpetakan untuk referensi/debug
        canonicalRow[rawKey] = val;
      }
    }

    return canonicalRow;
  });

  return {
    rawRows: canonicalRows,
    headersFound: rawHeaders,
    recognizedCanonicalFields: recognizedFields,
  };
}

/**
 * Menghasilkan template Excel standar NataSekolah untuk diisi pengguna.
 */
export function generateStudentImportTemplateBuffer(): Buffer {
  const headers = [
    "NIS*",
    "Nama Lengkap*",
    "Jenis Kelamin (L/P)*",
    "NISN (10 Digit)",
    "NIK (16 Digit)",
    "Tempat Lahir",
    "Tanggal Lahir (DD/MM/YYYY)",
    "Alamat Domisili",
    "Nomor HP Siswa",
    "Nama Wali",
    "Hubungan Wali (Ayah/Ibu/Wali)",
    "No WA Wali",
    "Nama Rombel / Kelas",
  ];

  const sampleData = [
    [
      "2026001",
      "Ahmad Fauzan",
      "L",
      "0012345678",
      "3201234567890001",
      "Bandung",
      "15/08/2012",
      "Jl. Sukamaju No. 12, Bandung",
      "081234567890",
      "Budi Santoso",
      "Ayah",
      "081298765432",
      "Kelas 7A",
    ],
    [
      "2026002",
      "Siti Aisyah",
      "P",
      "0012345679",
      "3201234567890002",
      "Jakarta",
      "20/11/2012",
      "Jl. Melati No. 5, Cimahi",
      "081234567891",
      "Nurhayati",
      "Ibu",
      "081398765433",
      "Kelas 7A",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  // Set lebar kolom otomatis agar rapi
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 15) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
