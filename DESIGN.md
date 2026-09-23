# Design System & Product UX Specification — NataSekolah (v2.0)

> **"Menata Pendidikan, Merapikan Masa Depan."**  
> Unified Education Management Platform untuk Sekolah Formal, Pondok Pesantren, Rumah Tahfidz, dan PKBM.  
> Karakter Produk: **Clean · Fresh · Calm · Fast · Organized**  
> Dials: `ENERGY 1 / RHYTHM 2 / MOTION 1` | Filter: Anti-Slop Mode 1 (DURING) | Aksesibilitas: WCAG 2.1 AA

---

## 1. Design Philosophy

NataSekolah bukan dashboard SaaS korporat yang kaku, bukan pula aplikasi konsumen yang bising dengan ilustrasi animasi dan gradien mencolok. NataSekolah adalah **buku administrasi digital yang berwibawa, teduh, dan tertata rapi**.

Prinsip filosofis utama:
1. **Ketertiban Melalui Kesederhanaan (*Order through Simplicity*):** Tugas utama sistem adalah meringankan beban kognitif guru, bendahara, dan staf tata usaha. Setiap piksel harus memiliki tujuan fungsional nyata.
2. **Ketenangan Visual (*Visual Calmness*):** Lingkungan pendidikan membutuhkan rasa percaya, stabilitas, dan keheningan visual. Warna dan tata letak tidak boleh berteriak atau saling berebut perhatian pengguna.
3. **Respek Terhadap Waktu Lapangan (*Respect for Field Time*):** Guru mencatat presensi di sela pergantian jam pelajaran (< 60 detik), kasir melayani antrean wali murid di jam sibuk, dan wali memeriksa nilai anak melalui ponsel dengan koneksi terbatas. Antarmuka harus instan, stabil, dan bebas friksi.
4. **Keaslian Identitas Nusantara (*Authentic & Grounded*):** Mengakar pada adab, kesantunan, dan kehangatan tradisi pendidikan Indonesia tanpa terjebak ke dalam estetika template AI generik.

---

## 2. Product Personality

NataSekolah memiliki 5 pilar karakter produk yang tercermin dalam setiap elemen visual, interaksi, dan copywriting:

| Sifat Produk | Manifestasi Visual & Interaksi | Larangan Keras |
| :--- | :--- | :--- |
| **Clean** | Garis pemisah tegas namun lembut (Stone 200), kontras tinggi, hierarki visual jelas, ruang bernapas cukup. | Dilarang menumpuk kartu dalam kartu, dilarang border bertumpuk, dilarang elemen dekoratif tanpa guna. |
| **Fresh** | Aksen hijau pinus (*Deep Pine Teal*) yang menyejukkan mata, kanvas bernuansa kertas alami (*Warm Stone Paper*). | Dilarang menggunakan palet neon, warna ungu gelap tech-bro, atau saturasi warna menyilaukan. |
| **Calm** | Elevasi datar (*flat*) dengan bayangan sangat halus, tanpa animasi melayang, tanpa kartu bergetar. | Dilarang animasi bouncy (*scale-95 bounce*), dilarang efek glassmorphism berlebihan, dilarang pop-up bertubi-tubi. |
| **Fast** | Navigasi shell persisten tanpa kedipan layar (*zero flicker*), skeleton presisi seukuran konten, respons tombol instan. | Dilarang fullscreen blocking spinner untuk navigasi biasa, dilarang re-render navbar pada setiap rute. |
| **Organized** | Tabel terstruktur rapi, angka rata kanan (*tabular figures*), badge fungsional terstandardisasi, formulir terkelompok logis. | Dilarang tata letak asimetris acak (*bento-grid chaos*), dilarang tabel desktop yang dipaksa meluap di ponsel. |

---

## 3. Core Design Principles

1. **Hierarchy First, Decoration Never:**
   Struktur informasi ditentukan oleh ukuran tipografi, bobot tulisan, dan jarak antar-elemen (*whitespace*), bukan dengan memberi kotak/kartu warna-warni pada setiap butir informasi.
2. **One Screen, One Dominant Action (Focal Point Clarity):**
   Setiap halaman atau tampilan modal harus memiliki satu tombol aksi primer yang dominan dan kontras. Aksi sekunder bersifat tenang (*subdued* / *outline*).
3. **Evidence Over Assumptions (Honest UI):**
   Tampilkan status riil apa adanya. Jika data belum tersedia, tampilkan empty state yang membantu. Jangan membuat angka dummy, metrik hiasan, atau grafik tiruan tanpa makna operasional.
4. **Touch-Zone & Thumb Safety:**
   Seluruh kontrol interaktif memiliki target sentuh minimum **44 x 44 px** dengan jarak aman antar-tombol di ponsel untuk menghindari salah tekan (*fat-finger errors*).
5. **Zero Layout Shift (CLS = 0):**
   Transisi loading menggunakan skeleton loader yang ukurannya persis sama dengan elemen target saat data selesai dimuat.

---

## 4. Visual Language

### A. Color System
Menggunakan palet warna berbasis alam dan kertas administrasi, terbagi secara ketat antara warna kanvas, teks, dan status semantik fungsional:

```
Canvas / Surface:
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Canvas Background       │ Surface Card            │ Surface Muted           │
│ #fbfbfa (Stone 50 mod)  │ #ffffff (Pure White)    │ #f4f4f2 (Stone 100 mod) │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘

Primary Brand:
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Primary Base (Teal 700) │ Primary Hover(Teal 800) │ Primary Light (Teal 50) │
│ #0f766e                 │ #115e59                 │ #f0fdfa                 │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘

Text / Foreground:
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│ Text Primary (Zinc 900) │ Text Muted (Zinc 600)   │ Text Subdued (Zinc 400) │
│ #18181b                 │ #52525b                 │ #a1a1aa                 │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

### B. Typography
Menggunakan font sans-serif modern dengan *x-height* besar untuk kenyamanan membaca di layar beresolusi sedang (*Inter*, *Plus Jakarta Sans*, atau system native fallback):

* **Teks Konten Terkecil:** Minimum **12px** untuk teks keterangan tabel mikro, minimum **14px** untuk teks bacaan tubuh formulir dan daftar.
* **Skala Tipografi Standar:**
  * `Display / Big Title`: `text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl` (Digunakan di halaman portal/greeting).
  * `Page Title (H1)`: `text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl` (Judul operasional modul).
  * `Section Header (H2)`: `text-base font-semibold text-zinc-900 sm:text-lg` (Kepala tabel atau pembagi segmen).
  * `Card / Sub-header (H3)`: `text-sm font-semibold text-zinc-900` (Judul metrik atau kartu data).
  * `Body Text`: `text-sm font-normal text-zinc-700 leading-relaxed` (Deskripsi, isi tabel, petunjuk input).
  * `Label & Metadata`: `text-xs font-medium text-zinc-500` (Label input, cap waktu, status).
  * `Numeric & Financial Data`: `text-sm font-semibold font-mono tabular-nums text-zinc-900` (Nominal rupiah, NISN, skor nilai, persentase).

### C. Spacing Scale
Berdasarkan kelipatan 4px konsisten:
* `space-1` (4px): Jarak mikro antara ikon dan teks label.
* `space-1.5` (6px): Padding internal tombol kecil atau badge.
* `space-2` (8px): Jarak elemen dalam grup input atau tumpukan ringkas.
* `space-3` (12px): Padding internal kartu ringkas atau sel tabel data.
* `space-4` (16px): Padding standar komponen kartu, modal, dan formulir.
* `space-6` (24px): Jarak pemisah antar-seksi dalam satu halaman.
* `space-8` (32px): Jarak vertikal utama antar-blok dashboard.

### D. Radius Scale (Standardized)
Hindari variasi radius yang acak-acakan. NataSekolah menetapkan 4 skala radius terpadu:
* `rounded-sm` (4px): Checkbox, badge tabel padat, kbd shortcuts.
* `rounded-md` (6px): Input field, select dropdown, button standar, badge status.
* `rounded-lg` (8px): Kartu ringkas, banner notifikasi, toolbar tabel, popover menu.
* `rounded-xl` (12px): Kartu utama dashboard, dialog modal, panel slide-over.
* *(Catatan: `rounded-full` HANYA diizinkan untuk avatar foto profil pengguna. Dilarang menggunakan rounded-full untuk badge status atau tombol aksi).*

### E. Elevation & Shadows
* `shadow-none`: Standar untuk sel tabel, panel datar, dan input field.
* `shadow-2xs` / `shadow-xs`: `0 1px 2px 0 rgb(0 0 0 / 0.04)` (Digunakan pada kartu statis di atas latar canvas `#fbfbfa`).
* `shadow-sm`: `0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)` (Digunakan pada header yang menempel/sticky dan kartu interaktif).
* `shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)` (Digunakan pada dialog modal, dropdown menu, dan dialog pencarian Ctrl+K).
* *(Dilarang keras: bayangan pekat `shadow-xl`, `shadow-2xl`, atau bayangan berpendar/neon).*

### F. Borders & Dividers
* Batas Default: `border border-stone-200` (`#e5e5e0`).
* Batas Lembut / Pemisah Baris: `border-b border-stone-100` (`#f5f5f4`).
* Batas Aktif / Interaktif: `border-stone-300` atau `border-teal-700` saat dalam status fokus.

---

## 5. Design Tokens

Token CSS didefinisikan secara semantik pada `globals.css` menggunakan `@theme` Tailwind CSS v4, menjamin kejelasan peran dan portabilitas tema:

```css
@theme {
  /* Canvas & Surface */
  --color-canvas: #fbfbfa;
  --color-surface: #ffffff;
  --color-surface-muted: #f4f4f2;
  --color-surface-subtle: #fafaf9;

  /* Brand Primary */
  --color-primary: #0f766e;
  --color-primary-hover: #115e59;
  --color-primary-light: #f0fdfa;
  --color-primary-border: #99f6e4;
  --color-primary-foreground: #ffffff;

  /* Text & Foreground */
  --color-foreground: #18181b;
  --color-foreground-muted: #52525b;
  --color-foreground-subtle: #71717a;
  --color-foreground-inverted: #ffffff;

  /* Borders & Dividers */
  --color-border: #e5e5e0;
  --color-border-subtle: #f5f5f4;
  --color-border-strong: #d4d4ce;

  /* Semantic Status — Success (Hadir / Lunas / Selesai) */
  --color-success: #15803d;
  --color-success-surface: #f0fdf4;
  --color-success-border: #bbf7d0;

  /* Semantic Status — Warning (Izin / Cicilan / Perlu Perhatian) */
  --color-warning: #b45309;
  --color-warning-surface: #fffbeb;
  --color-warning-border: #fde68a;

  /* Semantic Status — Danger (Alpa / Nunggak / Jatuh Tempo / Error) */
  --color-danger: #b91c1c;
  --color-danger-surface: #fef2f2;
  --color-danger-border: #fecaca;

  /* Semantic Status — Info (Sakit / Catatan / Sistem) */
  --color-info: #1d4ed8;
  --color-info-surface: #eff6ff;
  --color-info-border: #bfdbfe;
}
```

---

## 6. Iconography

NataSekolah menggunakan **Lucide React** sebagai pustaka ikon resmi tunggal:
* **Ukuran Standar Ikon:**
  * `h-3.5 w-3.5` (14px): Dalam badge status, tombol kecil, metadata tanggal.
  * `h-4 w-4` (16px): Tombol standar, butir input form, ikon tabel, breadcrumb.
  * `h-5 w-5` (20px): Navigasi bilah samping/atas, kartu ringkasan KPI, kepala modal.
  * `h-8 w-8` hingga `h-10 w-10` (32-40px): Ikon tematik pada Empty State atau Error State.
* **Konsistensi Gaya:**
  * Selalu gunakan stroke reguler (`strokeWidth={2}` atau `strokeWidth={1.75}`).
  * Jangan mencampur ikon bergaya kartun, 3D, atau filled emoji ke dalam antarmuka administrasi.
  * Ikon harus selalu berpasangan dengan teks penjelasan, kecuali pada tombol aksi mikro di dalam tabel yang wajib memiliki `aria-label` dan `title` aksesibel.

---

## 7. Layout System

Sistem tata letak dirancang responsif dengan pendekatan *Mobile First* dan kontainer terpusat pada layar besar:
* **Lebar Maksimum Kanvas:** `max-w-7xl` (1280px) dengan margin horizontal otomatis `mx-auto`.
* **Padding Kontainer Responsif:**
  * Layar Ponsel (< 640px): `px-4 pt-4 pb-20` (Memberi ruang aman untuk bilah aksi bawah).
  * Layar Tablet (640px – 1024px): `px-6 pt-6 pb-16`.
  * Layar Desktop (> 1024px): `px-8 pt-8 pb-16`.
* **Grid Kolom:**
  * Grid Dashboard KPI: `grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4`.
  * Formulir Input 2-Kolom: `grid grid-cols-1 sm:grid-cols-2 gap-4`.
  * Detail Split View: `grid grid-cols-1 lg:grid-cols-3 gap-6` (Kolom utama 2 porsi, panel samping 1 porsi).

---

## 8. Navigation & Fast Feel

### A. Persistent Application Shell (Mandatory Architecture)
Untuk menghapus kedipan layar (*screen flickering*) dan menghindari *unmount/remount* elemen navigasi pada setiap perpindahan halaman:
* **Shell Tunggal:** Struktur navigasi utama (`AppShell`) dirender satu kali pada root level aplikasi.
* **Client-Side Routing:** Menggunakan komponen `Link` dari Next.js dengan dukungan *automatic route prefetching*.
* **Status Navigasi Aktif:** Menggunakan hook `usePathname()` untuk menyorot menu aktif secara instan tanpa re-fetch data navigasi.

### B. Struktur Hierarki 2-Level (Terinspirasi GitLab Pajamas)
Navigasi dikelompokkan menjadi 2 zona kerja logis agar pengguna tidak tersesat dalam belasan menu:
1. **Pusat Aktivitas Harian (Daily Operational Workspaces):**
   * *Dashboard:* Pusat komando ringkasan tugas & perhatian.
   * *Workspace Guru:* Pusat mengajar, presensi hari ini, dan penilaian.
   * *Keuangan:* Kasir pembayaran, pembuatan tagihan, dan buku kas.
   * *Presensi:* Pencatatan presensi kelas harian dan histori.
2. **Master Data & Konfigurasi Lembaga:**
   * *Buku Induk Siswa:* Data induk santri/siswa dan riwayat enrollment.
   * *Struktur Akademik:* Tahun ajaran, rombel/kelas, kurikulum mata pelajaran.
   * *Pesantren & Asrama:* Mutaba'ah tahfidz dan absensi kamar santri.
   * *Pengaturan:* Konfigurasi profil, aktivasi plugin, aturan operasional, dan manajemen pengguna.

### C. Navigasi Lintas Perangkat
* **Desktop (> 1024px):** Bilah atas ramping dengan logo lembaga, shortcut pencarian global (Ctrl+K), menu navigasi terstruktur, dan profil pengguna.
* **Tablet (768px – 1024px):** Menu dengan ikon dan label ringkas, dropdown untuk menu administrasi lanjutan.
* **Ponsel (< 768px):** Bilah atas ringkas (Logo + Tombol Cari) dipadukan dengan **Bottom Navigation Bar** sticky yang memuat 4 menu kerja utama yang paling sering disentuh jari jempol (Ringkasan, Presensi, Siswa, Menu Selengkapnya).

---

## 9. Components

### A. Button
* **Varian Utama:**
  * `Primary`: Latar `bg-teal-700 text-white hover:bg-teal-800 shadow-2xs`. Untuk aksi simpan, bayar, buat data baru.
  * `Secondary / Outline`: Latar `bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 hover:text-stone-900`. Untuk batal, filter, unduh data.
  * `Ghost`: Latar transparan `text-stone-600 hover:bg-stone-100 hover:text-stone-900`. Untuk tombol navigasi ikon atau pagination.
  * `Destructive`: Latar `bg-red-600 text-white hover:bg-red-700 shadow-2xs`. Khusus untuk aksi berbahaya seperti pembatalan tagihan (VOID) atau hapus permanen.
* **Ukuran:**
  * Standar: `min-h-[44px] px-4 py-2 text-sm font-medium rounded-md` (Target sentuh jempol minimum 44px).
  * Ringkas (Tabel): `h-8 px-3 text-xs font-medium rounded-md` (Untuk baris aksi tabel).

### B. Input & Select
* Struktur: `h-11 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-teal-700 focus:outline-hidden focus:ring-1 focus:ring-teal-700 transition`.
* Selalu sertakan label teks yang jelas di atas input (`text-xs font-medium text-stone-700 mb-1.5`).

### C. Checkbox & Switch
* Checkbox: Ukuran minimum `h-5 w-5 rounded-sm border-stone-300 text-teal-700 focus:ring-teal-700`.
* Switch: Toggle interaktif dengan track abu-abu saat mati dan teal saat hidup, mematuhi standar keyboard (Spacebar toggle).

### D. Tabs
* Bentuk: Segmented bar ramping dengan latar `bg-stone-100 p-1 rounded-lg border border-stone-200`.
* Tab Aktif: `bg-white text-stone-900 shadow-2xs rounded-md font-semibold`.
* Tab Tidak Aktif: `text-stone-600 hover:text-stone-900`.

### E. Card
* Struktur: `bg-white rounded-lg border border-stone-200 p-4 sm:p-5 shadow-2xs`.
* Tanpa dekorasi berlebihan. Garis batas stone-200 sudah cukup memisahkan konten dari kanvas.

### F. Table
* Kepala Tabel (`thead`): `bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600 uppercase tracking-wider`.
* Baris Data (`tbody tr`): `border-b border-stone-100 hover:bg-stone-50/70 transition-colors`.
* Sel Data (`td`): `py-3 px-4 text-sm text-stone-800 align-middle`.

### G. Badge (Status Pill Replacement)
* Bentuk: Persegi tumpul `rounded-md px-2.5 py-0.5 text-xs font-semibold border inline-flex items-center gap-1`.
* Standar Semantic:
  * Hadir / Lunas: `bg-emerald-50 text-emerald-800 border-emerald-200`.
  * Izin / Sebagian: `bg-amber-50 text-amber-800 border-amber-200`.
  * Sakit: `bg-blue-50 text-blue-800 border-blue-200`.
  * Alpa / Jatuh Tempo: `bg-rose-50 text-rose-800 border-rose-200`.
  * Netral / Draft: `bg-stone-100 text-stone-700 border-stone-200`.

### H. Dialog & Modal
* Backdrop: `bg-stone-900/40 backdrop-blur-xs transition-opacity`.
* Kontainer Dialog: `max-w-lg w-full bg-white rounded-xl border border-stone-200 p-6 shadow-md`.
* Navigasi Keyboard: Wajib mendukung tombol `Escape` untuk menutup dan perangkap fokus (*focus trap*).

### I. Dropdown & Tooltip
* Dropdown: `bg-white rounded-lg border border-stone-200 p-1 shadow-md z-40`.
* Tooltip: `bg-stone-900 text-white text-xs px-2 py-1 rounded-md shadow-xs`.

### J. Toast & Notification
* Lokasi: Kanan bawah layar (desktop) atau atas layar (mobile).
* Karakter: Bersahaja, menyampaikan konfirmasi aksi penting (contoh: *"Pembayaran berhasil dicatat"*), dengan opsi tutup mandiri.

### K. Breadcrumb
* Struktur: `flex items-center gap-1.5 text-xs text-stone-500 mb-2`.
* Pemisah: Ikon `ChevronRight` kecil berukuran 12px.

### L. Pagination
* Informasi Halaman: *"Menampilkan 1-20 dari 154 santri"*.
* Kontrol: Tombol *"Sebelumnya"* dan *"Berikutnya"* dengan nomor halaman terpusat.

---

## 10. Data-Dense UI

Sebagai aplikasi operasional harian, tata letak tabel dan daftar data padat (*data-dense*) harus diatur secara sistematis:

### A. Density Scale
* **Kepadatan Tinggi (Row Height ~36px):** Untuk Buku Kas Umum, mutasi keuangan harian, dan log transaksi detail.
* **Kepadatan Standar (Row Height ~48px):** Untuk Buku Induk Siswa, Rekap Tagihan, dan Direktori Guru.
* **Kepadatan Longgar (Row Height ~56px):** Untuk Matriks Input Penilaian dan Presensi Kelas yang membutuhkan ruang klik jempol lebih lebar.

### B. Aturan Penjajaran Kolom (Alignment Rules)
* **Teks & Nama:** Selalu rata kiri (`text-left`).
* **Angka, Nominal Uang, Persentase, dan Skor:** Selalu rata kanan (`text-right`) dengan angka berjarak tetap (`font-mono tabular-nums`).
* **Badge Status & Aksi:** Rata tengah atau rata kanan sesuai alur pemindaian mata (*F-pattern*).

### C. Transformasi Responsif Tabel (Shopify Polaris Pattern)
Tabel multi-kolom tidak boleh dipaksa mengecil di layar ponsel atau menyebabkan seluruh halaman bergeser ke samping (*horizontal viewport blowout*):
1. **Layar Desktop (`lg:table`):** Tabel tabular lengkap dengan seluruh kolom data sekunder.
2. **Layar Ponsel (`lg:hidden`):** Otomatis bertransformasi menjadi **Daftar Kartu Terstruktur Vertikal (*ResourceList*)**. Setiap baris menyajikan:
   * Baris 1: Nama Siswa / Item Utama + Badge Status di kanan.
   * Baris 2: Nomor Induk / Periode + Nominal Rupiah / Skor di kanan.
   * Baris 3: Tombol aksi langsung selebar layar atau menu titik tiga yang mudah dijangkau.

---

## 11. Forms

Formulir dirancang untuk akurasi data dan kecepatan pengetikan staf administrasi:
* **Grup Formulir Logis:** Kelompokkan data terkait dalam bagian yang terpisah (contoh: *Data Pribadi*, *Alamat Domisili*, *Data Orang Tua*).
* **Posisi Label:** Label diletakkan di **atas input field**, bukan di samping, untuk mempertahankan konsistensi visual di ponsel dan desktop.
* **Validasi & Pesan Error:**
  * Validasi dilakukan saat field kehilangan fokus (*onBlur*) atau saat form disubmit, bukan setiap ketikan huruf (*onChange*) yang membuat pengguna cemas.
  * Teks pesan error ditampilkan tepat di bawah field terkait dengan warna merah tua (`text-xs text-red-600 mt-1`).
* **Tombol Aksi Sticky di Mobile:** Pada formulir panjang (seperti presensi satu rombel), tombol aksi primer *"Simpan Data"* menempel di bilah bawah layar (*bottom sticky bar*) agar guru tidak perlu menggulir ke paling bawah setelah selesai mengisi.

---

## 12. Loading States

Menghilangkan sensasi aplikasi lambat dengan prinsip perceived performance (IBM Carbon):
* **Larangan Fullscreen Spinner:** Dilarang menggunakan animasi spinner yang menutup seluruh layar saat berpindah halaman biasa.
* **Skeleton Loader Presisi:** Gunakan kerangka abu-abu lembut (`bg-stone-200/60 animate-pulse rounded`) yang memiliki ukuran, tinggi baris, dan proporsi yang identik dengan konten akhir yang akan muncul.
* **Pemuatan Parsial (Partial Loading):** Shell aplikasi, header, dan filter pencarian harus langsung muncul seketika, sementara area tabel data memuat skeleton di dalam container-nya.

---

## 13. Empty States

Empty state bukan sekadar halaman kosong dengan teks abu-abu:
* **Ikon Tematik Bersahabat:** Ikon garis tipis berukuran 36px dengan latar lingkaran abu-abu lembut (`bg-stone-100 text-stone-400 p-3 rounded-full`).
* **Pesan Bersahabat & Solutif:**
  * Judul: *"Belum Ada Tagihan Siswa"*
  * Keterangan: *"Tagihan untuk periode ini belum diterbitkan. Anda dapat membuat tagihan per rombel secara massal."*
* **Tombol Tindakan Pertama:** Satu tombol aksi langsung (*"+ Terbitkan Tagihan Massal"*).

---

## 14. Error States

* **Penyampaian Manusiawi:** Sampaikan apa kendalanya dan bagaimana mengatasinya tanpa kode teknis yang membingungkan.
* **Contoh Pesan:** *"Koneksi terputus saat mengambil data siswa. Silakan periksa jaringan internet Anda lalu klik Coba Lagi."*
* **Tombol Pemulihan:** Tombol *"Muat Ulang Data"* atau *"Kembali ke Halaman Sebelumnya"*.

---

## 15. Confirmation & Feedback

* **Konfirmasi Aksi Finansial / Berbahaya:** Tindakan seperti *Pembatalan Tagihan (VOID)*, *Tutup Sesi Presensi*, atau *Hapus Akun* WAJIB menggunakan dialog konfirmasi modal dengan rincian data yang akan diubah dan tombol aksi berwarna merah tegas.
* **Umpan Balik Instan:** Setiap aksi yang berhasil disimpan memberikan respons visual langsung (misal: tombol berubah sesaat menjadi *"Tersimpan"* dengan ikon centang, sebelum kembali ke status normal).

---

## 16. Responsive Design

Target acuan resolusi perangkat:
* **Mobile Kecil (360px – 430px):** Perangkat utama guru di lapangan dan wali murid. Tata letak satu kolom murni, target sentuh min 44px, bottom sticky action.
* **Tablet (768px – 1024px):** Perangkat ustadz piket asrama atau ruang guru. Grid 2-kolom, bilah filter horizontal.
* **Laptop / Desktop (1280px+):** Perangkat bendahara dan staf tata usaha. Tabel multi-kolom padat dengan sorting dan filter instan.
* **Aturan Kritis:** Bebas geser horizontal di seluruh layar mobile (*zero horizontal viewport overflow*).

---

## 17. Accessibility (A11y - WCAG 2.1 AA)

Aksesibilitas adalah fitur dasar, bukan dekorasi tambahan:
1. **Rasio Kontras Warna Minimum:**
   * Teks Standar pada Kanvas: Minimum **4.5:1** (NataSekolah Text Zinc 900 pada Stone 50 mencapai **14.5:1**).
   * Tombol Primary Teal 700 pada Teks Putih: **5.3:1** (Lolos standar AA).
2. **Navigasi Keyboard:**
   * Seluruh tombol, link, dan input dapat ditelusuri dengan tombol `Tab` dan diaktifkan dengan `Enter` atau `Space`.
   * Indikator fokus yang jelas dan tegas: `focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2`.
3. **Screen Reader Ready:**
   * Elemen ikon interaktif wajib menyertakan `aria-label` (contoh: `aria-label="Cari data siswa"`).
   * Tabel menggunakan tag HTML semantik: `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`.
4. **Dukungan `prefers-reduced-motion`:**
   * Animasi transisi otomatis ditiadakan bagi pengguna yang mengaktifkan mode reduced motion pada sistem operasi mereka.

---

## 18. Motion & Micro-interactions

Sesuai Anti-Slop Dial `MOTION 1` (Subtle & Functional Only):
* **Durasi Standar:** Maksimum **150ms – 200ms** dengan kurva `ease-out`.
* **Fungsi Gerakan:** Hanya untuk membuka modal dialog, transisi opacity tab, dan feedback penyimpanan data.
* **Larangan Keras:**
  * Dilarang animasi pantul (*spring/bounce*).
  * Dilarang efek tombol menciut berlebihan (`active:scale-95`).
  * Dilarang animasi meluncur (*slide-in*) dari luar layar untuk setiap kartu data.

---

## 19. Performance UX

Target pengalaman pengguna: **Aplikasi merespons seketika.**
1. **Instant Internal Navigation:**
   * Gunakan Next.js Server Components di mana relevan, batasi `"use client"` hanya pada daun pohon komponen (*leaf interactive components*).
   * Hindari merender ulang shell/header navigasi antar-rute.
2. **Data Fetching Efisien:**
   * Lakukan pagination pada dataset besar (default 25 atau 50 baris per halaman).
   * Gunakan teknik *debouncing* (minimum 300ms) pada kotak pencarian teks untuk mencegah pemanggilan server berlebihan di setiap ketikan.
3. **Visual Stability:**
   * Menjamin nilai *Cumulative Layout Shift* (CLS) mendekati nol dengan menetapkan rasio dimensi pada skeleton loader.

---

## 20. Role-Based Experience

NataSekolah melayani 5 persona dengan kebutuhan mental model yang berbeda:

### A. Staf Tata Usaha / Admin Operasional
* Pertanyaan Utama: *"Apa tugas tertunda yang perlu saya selesaikan hari ini?"*
* Kebutuhan UX: Pusat kendali operasional, daftar perhatian (*Operational Attention List*), filter cepat data siswa, dan akses menu lengkap.

### B. Guru / Ustadz Lapangan
* Pertanyaan Utama: *"Kelas apa yang saya ajar, siapa santri saya, dan bagaimana absensi hari ini?"*
* Kebutuhan UX: Kecepatan akses (< 60 detik), daftar rombel mengajar yang jelas, presensi satu-sentuhan, bebas dari kerumitan keuangan atau administrasi lembaga.

### C. Bendahara / Kasir Sekolah
* Pertanyaan Utama: *"Siapa yang membayar hari ini, siapa yang masih menunggak, dan berapa saldo kas?"*
* Kebutuhan UX: Antarmuka kasir cepat, pencarian instan nama/NISN santri, alokasi pembayaran multi-tagihan otomatis, cetak kwitansi instan ramah kertas, ekspor Excel CSV bersih.

### D. Wali Murid / Orang Tua Santri
* Pertanyaan Utama: *"Bagaimana kehadiran, nilai belajar, dan catatan tagihan anak saya?"*
* Kebutuhan UX: Tampilan portal ponsel sederhana, bahasa santun tanpa istilah teknis sistem, kartu tagihan transparan dengan riwayat pembayaran, notifikasi mutaba'ah.

### E. Pimpinan / Pengasuh Pondok
* Pertanyaan Utama: *"Bagaimana kondisi kesehatan operasional lembaga saya secara keseluruhan?"*
* Kebutuhan UX: Ringkasan metrik eksekutif, rekapitulasi kehadiran santri, ringkasan saldo kas, dan kepatuhan pengajaran guru.

---

## 21. Page Composition Patterns

Setiap halaman operasional di NataSekolah mematuhi struktur tata letak 4-blok:

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. HEADER SECTION                                               │
│    - Breadcrumb (Navigasi asal rute)                            │
│    - Judul Halaman (H1) + Badge Konteks / Status                │
│    - Deskripsi Ringkas / Sub-judul                              │
│    - Primary Action Button (Kanan atas pada desktop)            │
├─────────────────────────────────────────────────────────────────┤
│ 2. METRIC SUMMARY BAR (Opsional jika relevan)                   │
│    - 2 s/d 4 Kartu KPI Ringkas (Angka, Label, Tren Ringkas)     │
├─────────────────────────────────────────────────────────────────┤
│ 3. CONTROL & FILTER BAR                                         │
│    - Search Input (Kiri) + Dropdown Filter Status / Kategori    │
│    - Action Buttons: Ekspor CSV, Filter Tambahan (Kanan)        │
├─────────────────────────────────────────────────────────────────┤
│ 4. CONTENT AREA (Data Table / Card List)                        │
│    - Desktop: Tabel Padat Terstruktur                           │
│    - Mobile: ResourceList Vertikal Reflow                       │
│    - Footer: Pagination & Ringkasan Jumlah Baris                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 22. Content & Copywriting Rules

Mematuhi pedoman Anti-Slop R-02 dan etika komunikasi pendidikan Indonesia:
1. **Bahasa Baku, Santun, dan Lugas:**
   * Gunakan Bahasa Indonesia formal yang ramah (contoh: *"Simpan Data"*, *"Batalkan Tagihan"*, *"Cetak Kwitansi"*).
2. **Bebas Jargon Marketing AI:**
   * Dilarang menggunakan istilah klise: *Revolutionary, Cutting-edge, AI-Powered, Seamless, Magic, Ultimate*.
   * Ganti dengan penjelasan fungsi konkret: *"Pencatatan otomatis"*, *"Kirim pesan WhatsApp"*, *"Ekspor file Excel"*.
3. **Larangan Karakter Em Dash (`—`):**
   * Sesuai aturan Anti-Slop R-02, dilarang menggunakan karakter em dash (`—`) pada salinan antarmuka pengguna.
   * Gunakan tanda kurung `()`, titik dua `:`, atau tanda titik biasa `.`.
4. **Format Tanggal & Angka Terstandar:**
   * Tanggal: Menggunakan format resmi Indonesia (contoh: `23 September 2026`).
   * Mata Uang: Menggunakan prefix `Rp` diikuti spasi dan pemisah ribuan titik (contoh: `Rp 250.000`).

---

## 23. Anti-Patterns (Daftar Larangan UI/UX)

Setiap implementasi yang mengandung elemen di bawah ini dinyatakan **GAGAL AUDIT (FAIL)**:

* ❌ **Card Overload:** Membuat kotak kartu terpisah untuk setiap 2 baris informasi.
* ❌ **Gradient Soup:** Memberikan latar gradien warna-warni pada kartu atau tombol utama.
* ❌ **Shadow Heavy:** Menggunakan bayangan melayang tebal (`shadow-xl` / `shadow-2xl`).
* ❌ **Pill-Badge Abuse:** Menggunakan `rounded-full` pada badge status tabel (wajib `rounded-md`).
* ❌ **Raw Color Hacking:** Menggunakan arbitrary class warna (seperti `bg-[#345678]`) jika semantic token sudah tersedia.
* ❌ **Desktop Table Forcing:** Membiarkan tabel desktop meluap ke samping di ponsel tanpa penataan baris vertikal.
* ❌ **Bouncy Micro-interactions:** Menambahkan animasi tombol membal `active:scale-95`.
* ❌ **Fullscreen Spinner:** Menampilkan spinner layar penuh yang membekukan interaksi pengguna saat navigasi rute biasa.
* ❌ **Un-debounced Live Search:** Memicu query pencarian server pada setiap ketikan karakter pengguna.
* ❌ **Font Terlalu Kecil:** Menggunakan ukuran font di bawah 12px untuk memaksakan data masuk ke layar.
* ❌ **Unlabeled Inputs:** Menyajikan form input hanya dengan placeholder tanpa label HTML yang terbaca screen reader.

---

## 24. Implementation Rules (Governance & Architecture)

Hubungan antara spesifikasi desain dan kode aplikasi:

```text
DESIGN.md (Spesifikasi & Kontrak Desain)
    ↓
globals.css (@theme Semantic Tokens)
    ↓
src/components/ui/ (Primitive Components: Button, Input, Badge, Table, Dialog)
    ↓
src/components/shared/ (Composite Components: AppShell, SearchDialog, DataTable)
    ↓
src/app/** (Page Workspaces & Role Experiences)
```

1. **Aturan Komponen:** Jangan membuat salinan kode tombol atau input inline di setiap halaman. Gunakan komponen terpusat yang merujuk pada token semantik.
2. **Zero-Migration Guarantee:** Penyesuaian antarmuka tidak boleh mengubah arsitektur backend, skema Prisma, atau model domain yang telah terkunci.
3. **Scope Milestone Ini:** Milestone ini menetapkan spesifikasi dan kontrak arsitektur UI/UX di dalam `DESIGN.md`. Penulisan ulang kode halaman secara massal akan dilaksanakan pada milestone eksekusi UI berikutnya secara bertahap dan terukur.
