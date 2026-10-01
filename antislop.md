# antislop (core filter)

> Mode Anti-Slop: **Mode 1 (DURING) - Aktif dari awal proyek.**
> Spesifikasi desain hidup di `DESIGN.md`; file ini adalah filter kualitas yang
> berlaku untuk SETIAP perubahan UI, copy, layout, dan kode.

## Core Principles

1. **Intentionality (Purpose Test):** Setiap elemen visual dan copy harus memiliki
   tujuan fungsional yang jelas. Hindari AI default (gradient ungu/biru generik,
   bento grid template, capsule badge "AI Powered" tanpa konteks).
2. **Resilience & Mobile First:** Desain harus kokoh di semua ukuran layar
   (bebas overflow, target sentuh min 44px) dan mendukung states (empty, loading, error).
3. **Evidence Over Claims:** Konten nyata atau placeholder jujur (`[DATA RIIL]`).
   Tidak membuat statistik palsu atau testimoni fiktif.
4. **Accessible by Design:** Memenuhi kontras WCAG AA (min 4.5:1) dan dapat
   dinavigasi penuh dengan keyboard (Tab, Enter, Escape).

## Dials

`ENERGY 1` (tenang, bukan bising) / `RHYTHM 2` (konsisten) / `MOTION 1` (subtle & functional only).

## Pilih skill sesuai tugas

1. Baca `DESIGN.md` untuk arah visual, identitas, palet, dan dials.
2. Baca file inti ini (`antislop.md`), lalu skill tugasnya:
   - UI / visual: `skills/antislop-ui/SKILL.md`
   - Copy & text: `skills/antislop-copywriting/SKILL.md`
   - People / persona: `skills/antislop-human/SKILL.md`
   - Mobile / responsive: `skills/antislop-layoutmobile/SKILL.md`
   - Code comments & implementasi: `skills/antislop-code/SKILL.md`

## Gagal audit (FAIL) otomatis

Perubahan yang melanggar salah satu Core Principles di atas, mengandung
anti-pattern `DESIGN.md` §23, atau tidak lolos verifikasi `npm run test` +
`npm run typecheck` + `git push` = **GAGAL** dan wajib diperbaiki sebelum dikirim.
