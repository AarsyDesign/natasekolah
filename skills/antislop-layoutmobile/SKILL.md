---
name: antislop-layoutmobile
description: Skill anti-slop untuk layout mobile/responsive NataSekolah - breakpoint, target sentuh, dan nol overflow.
---

# antislop-layoutmobile (Mobile / Responsive)

## When to Use
Untuk semua pekerjaan tata letak, breakpoint, grid, atau perubahan yang
memengaruhi tampilan di ponsel/tablet.

## Wajib baca dulu
`DESIGN.md` §16 (Responsive), §7 (Layout System), §17 (Accessibility), §21 (Page Composition), §23 (Anti-Patterns).

## Target acuan resolusi

- **360-430px (mobile kecil):** perangkat utama guru lapangan & wali murid.
  Satu kolom murni, target sentuh min 44px, bottom sticky action.
- **768-1024px (tablet):** grid 2-kolom, bilah filter horizontal.
- **1280px+ (desktop):** tabel multi-kolom padat, sorting & filter instan.

## Aturan keras

1. **Zero horizontal viewport overflow** di seluruh layar mobile. Ini aturan
   paling kritis: satu piksel geser ke samping = gagal.
2. **Tabel desktop jangan dipaksa meluap di ponsel:** reflow jadi baris vertikal
   (ResourceList, pola §21 blok 4).
3. **Target sentuh min 44px** untuk semua tombol/link interaktif mobile.
4. **Font minimal 12px**; jangan mengecilkan teks agar muat.
5. **Input punya label HTML**, bukan placeholder saja (juga syarat a11y §17).
6. **Urutan prioritas mobile:** aksi utama (simpan/absen) tetap terlihat tanpa
   scroll panjang; data sekunder dipadatkan, bukan disembunyikan sembarangan.

## FAIL otomatis

Desktop table forcing · Overflow horizontal · Touch target < 44px · Font < 12px · Unlabeled input.
