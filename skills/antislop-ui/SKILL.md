---
name: antislop-ui
description: Skill anti-slop untuk pekerjaan UI/visual di NataSekolah - filter kualitas komponen, states, dan layout halaman.
---

# antislop-ui (UI / Visual)

## When to Use
Untuk semua pekerjaan UI: membuat/mengubah komponen, halaman, modal, tabel,
kartu, atau styling visual apa pun.

## Wajib baca dulu
`DESIGN.md` §3 (Core Design Principles), §4 (Visual Language), §9 (Components),
§10 (Data-Dense UI), §12-15 (States), §18 (Motion), §21 (Page Composition), §23 (Anti-Patterns).

## Aturan keras

1. **Hierarchy First, Decoration Never:** hierarki dari ukuran, bobot, jarak;
   bukan dari kotak warna-warni per butir informasi.
2. **One Screen, One Dominant Action:** satu tombol primer kontras per layar/modal;
   aksi sekunder tenang (outline/subdued).
3. **States wajib ada:** loading (skeleton presisi seukuran konten), empty
   (ikon + pesan solutif + tombol aksi pertama), error (pesan manusiawi + tombol pemulihan).
   Kosong tanpa state = gagal.
4. **Motion 1 (Subtle & Functional Only):** transisi 150-200ms `ease-out`,
   hanya untuk modal, opacity tab, feedback simpan. Dilarang bounce/spring/
   `active:scale-95`/slide-in kartu.
5. **Tanpa fullscreen spinner** untuk navigasi biasa; shell + header tampil seketika.
6. **Satu aksi per halaman operasional** mengikuti pola 4-blok `DESIGN.md` §21.

## FAIL otomatis (dari DESIGN.md §23)

Card overload · Gradient soup · Shadow heavy (`shadow-xl/2xl`) · Pill-badge abuse
(badge tabel wajib `rounded-md`) · Raw color hacking (`bg-[#...]` padahal token
semantik ada) · Desktop table forcing · Bouncy micro-interaction · Un-debounced
live search · Font < 12px · Unlabeled input.
