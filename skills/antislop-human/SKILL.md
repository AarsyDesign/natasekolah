---
name: antislop-human
description: Skill anti-slop untuk pekerjaan persona/people di NataSekolah - UX sesuai mental model 5 pengguna nyata.
---

# antislop-human (People / Persona)

## When to Use
Untuk keputusan UX yang menyentuh orang: siapa pengguna halaman ini, bahasa
apa yang dipakai, dan alur apa yang mereka butuhkan.

## Wajib baca dulu
`DESIGN.md` §20 (Role-Based Experience), §1 (Design Philosophy), §13-14 (States).

## 5 persona dan pertanyaan utama mereka

- **A. Staf TU / Admin Operasional** - "Apa tugas tertunda hari ini?"
  Pusat kendali, operational attention list, filter cepat, menu lengkap.
- **B. Guru / Ustadz Lapangan** - "Kelas apa yang saya ajar dan bagaimana absensinya?"
  Akses < 60 detik, presensi satu-sentuhan, bebas kerumitan keuangan.
- **C. Bendahara / Kasir** - "Siapa yang membayar hari ini dan berapa saldo kas?"
  Pencarian instan nama/NISN, alokasi multi-tagihan, cetak kwitansi, ekspor CSV.
- **D. Wali Murid** - "Bagaimana kehadiran, nilai, dan tagihan anak saya?"
  Portal ponsel sederhana, bahasa santun tanpa jargon teknis, kartu tagihan transparan.
- **E. Pimpinan / Pengasuh** - "Bagaimana kesehatan operasional lembaga saya?"
  Ringkasan metrik eksekutif, rekap kehadiran, saldo kas, kepatuhan pengajaran.

## Aturan keras

1. **Grounded & Nusantara:** adab, kesantunan, kehangatan tradisi pendidikan
   Indonesia; dilarang estetika template AI generik (§1).
2. **Respek waktu lapangan:** guru di sela pergantian jam, kasir dalam antrean,
   wali dengan koneksi terbatas. Tampilan harus instan dan bebas friksi.
3. **Hanya masukkan yang dibutuhkan persona itu:** jangan tampilkan fitur/istilah
   milik persona lain (guru tidak perlu tampilan keuangan lembaga).
4. **Empty state & error harus solutif dan manusiawi** (§13-14), bukan teks abu-abu.
