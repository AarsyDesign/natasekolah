# Design Direction & Identity - NataSekolah

> **"Menata Pendidikan, Merapikan Masa Depan."**  
> Desain ini dirancang khusus untuk kenyamanan guru senior, ustadz pesantren, staf tata usaha, dan wali murid di Indonesia. Fokus utamanya adalah **ketenangan, kejelasan informasi, dan kemudahan pengoperasian di ponsel (< 60 detik)** tanpa intimidasi teknologi.

---

## 1. Anti-Slop Dials (Pengaturan Ritme & Energi)

```
Dial: ENERGY 1 / RHYTHM 2 / MOTION 1
```

* **ENERGY 1 (Calm & Trustworthy):** Tampilan terasa teduh, profesional, dan bersahaja seperti buku administrasi resmi yang tertata rapi. Menghindari elemen visual agresif atau gradien neon.
* **RHYTHM 2 (Structured with Clear Focal Points):** Komposisi teratur dan konsisten, dengan kartu ringkasan utama (*focal point*) yang jelas di setiap layar.
* **MOTION 1 (Subtle & Functional Only):** Animasi hanya digunakan untuk transisi halus antar-tab, pembukaan modal, dan status simpan. Tanpa efek melayang (*floating*) atau animasi pantul yang mengganggu konsentrasi.

---

## 2. Palet Warna Terkurasi (WCAG AA Compliant)

Palet warna NataSekolah mengambil inspirasi dari keteduhan ruang belajar dan keakraban institusi pendidikan/pesantren di Indonesia:

### Warna Utama & Netral
| Nama Token | Nilai HEX | Peran Fungsional | Rasio Kontras |
| :--- | :--- | :--- | :--- |
| **Primary (Keteduhan)** | `#0f766e` (Teal 700) | Tombol aksi utama, tautan aktif, aksen identitas | 5.3:1 pada putih (Lolos AA) |
| **Primary Hover** | `#115e59` (Teal 800) | Status interaksi tombol saat disentuh/hover | 7.1:1 pada putih |
| **Background (Kertas)** | `#fbfbfa` (Warm Stone) | Latar belakang seluruh aplikasi, tidak silau di mata | - |
| **Card Surface** | `#ffffff` (Pure White) | Permukaan kartu, tabel, dan formulir | - |
| **Border & Divider** | `#e5e5e0` (Stone 200) | Garis batas kartu dan pemisah baris tabel | - |
| **Text Primary** | `#18181b` (Zinc 900) | Judul, nama siswa, nominal angka utama | 14.5:1 (Ultra Jelas) |
| **Text Muted** | `#52525b` (Zinc 600) | Label sekunder, tanggal lahir, nama rombel | 5.8:1 (Lolos AA) |

### Warna Status Fungsional (Tanpa Gradien)
* **Hadir / Lunas (Success):** `#16a34a` (Emerald 600) dengan latar badge `#ecfdf5`.
* **Izin / Cicilan (Warning):** `#d97706` (Amber 600) dengan latar badge `#fffbeb`.
* **Sakit (Info):** `#2563eb` (Blue 600) dengan latar badge `#eff6ff`.
* **Alpa / Nunggak (Danger):** `#dc2626` (Red 600) dengan latar badge `#fef2f2`.

> [!NOTE]
> **Larangan Anti-Slop:**
> Dilarang menggunakan gradien ungu-biru klise, efek *glow* berpendar di semua tombol, atau teks abu-abu terang pada latar putih yang tidak lolos standar kontras.

---

## 3. Tipografi & Skala Baca

Menggunakan jenis huruf **Sans-Serif Modern yang Bersih** (didukung oleh sistem font native & Google Fonts *Inter* / *Plus Jakarta Sans*):

* **Tingkat Keterbacaan Tinggi:** Font memiliki *x-height* yang besar, sangat jelas dibaca pada layar ponsel Android beresolusi rendah sekalipun.
* **Ukuran Minimum:** Teks konten tidak boleh lebih kecil dari **13px** (agar guru dan orang tua tidak kesulitan membaca).
* **Hierarki Skala:**
  * Judul Halaman: `text-2xl font-bold tracking-tight text-zinc-900`
  * Judul Bagian / Kartu: `text-lg font-semibold text-zinc-900`
  * Teks Utama / Data Siswa: `text-sm font-medium text-zinc-800`
  * Label / Meta Keterangan: `text-xs font-normal text-zinc-500`

---

## 4. Standar Sentuh Jempol & Responsivitas Mobile (Thumb-Zone First)

Karena lebih dari 70% pengakses harian (guru absensi & orang tua murid) menggunakan ponsel satu tangan:

1. **Target Sentuh Minimum 44px:**
   * Setiap tombol aksi, centang hadir, dan menu baris memiliki tinggi minimal `min-h-[44px]` dan lebar minimal `min-w-[44px]`.
2. **Bebas Geser Horizontal (*Zero Horizontal Overflow*):**
   * Di layar HP (360px – 430px), data siswa tidak boleh memaksa pengguna menggeser tabel ke samping tanpa kejelasan.
   * Gunakan tampilan **Kartu Ringkas Vertikal** untuk mobile dan beralih ke **Tabel Lebar** hanya pada layar desktop/laptop (`md:block`).
3. **Papan Aksi Cepat Bawah (*Bottom Sticky Actions*):**
   * Tombol *"Simpan Presensi"* atau *"Cetak Kwitansi"* melayang di bagian bawah layar yang mudah dijangkau ibu jari pengguna.

---

## 5. Komponen & Karakter Antarmuka

### A. Kartu & Elevasi
* Menggunakan bayangan lembut alami (`shadow-xs` / `shadow-sm`) dan batas halus (`border border-[#e5e5e0]`).
* Hindari efek kaca berlebihan (*glassmorphism*) pada banyak elemen sekaligus.

### B. Indikator Status (Badge)
* Badge berbentuk persegi tumpul dengan radius sedang (`rounded-md` atau `rounded-lg`), **bukan kapsul bulat penuh (*pill-shape*)** yang klise.
* Teks badge menggunakan huruf reguler/kapitalisasi judul yang wajar (contoh: `Hadir`, `Lunas`), bukan huruf kapital semua dengan jarak renggang (`H A D I R`).

### C. Kondisi UI (Resilience States)
Setiap halaman wajib memiliki 3 kondisi visual yang jelas:
1. **Empty State (Belum Ada Data):** Ikon tematik sederhana, pesan ramah (misal: *"Belum ada santri di kelas ini"*), dan 1 tombol aksi jelas (*"+ Tambah Siswa Pertama"*).
2. **Loading State (Memuat Data):** Kerangka halus (*skeleton loader*) yang mencerminkan bentuk kartu asli, bukan spinner berputar tanpa henti.
3. **Error State (Kendala Jaringan):** Pesan jelas dalam bahasa Indonesia santun dan tombol *"Coba Lagi"*.

---

## 6. Nada Suara & Copywriting (Human-Centric Copy)

* **Bersahabat, Jelas, dan Santun:**
  * Menggunakan sapaan yang akrab: *"Selamat pagi, Ustadz Fauzan"*, *"Rekap Presensi Hari Ini"*.
* **Bebas Jargon AI:**
  * Dilarang menggunakan kata: *Revolutionary, Cutting-edge, AI-Powered, Seamless, Ultimate*.
  * Ganti dengan fakta konkret: *"Simpan data otomatis"*, *"Cetak kwitansi PDF"*, *"Kirim pesan WhatsApp"*.
* **Bebas Karakter Em Dash (`—`):** Sesuai aturan Anti-Slop R-02, gunakan tanda kurung `()`, titik dua `:`, atau titik biasa `.`.
