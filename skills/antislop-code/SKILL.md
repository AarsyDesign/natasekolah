---
name: antislop-code
description: Skill anti-slop untuk komentar & implementasi kode NataSekolah - rantai governance token dan komentar ber-tujuan.
---

# antislop-code (Code Comments & Implementasi)

## When to Use
Untuk menulis/mengubah kode, terutama komentar, komponen terpusat, dan
penyesuaian UI yang menyentuh struktur.

## Wajib baca dulu
`DESIGN.md` §24 (Implementation Rules & Governance), §3 (Core Design Principles).

## Rantai governance (jangan dilompati)

```text
DESIGN.md (spesifikasi & kontrak desain)
    -> globals.css (@theme semantic tokens)
    -> src/components/ui/ (primitif: Button, Input, Badge, Table, Dialog)
    -> src/components/shared/ (komposit: AppShell, SearchDialog, DataTable)
    -> src/app/** (workspace halaman & pengalaman per peran)
```

## Aturan keras

1. **Satu sumber komponen:** dilarang menyalin kode tombol/input inline di tiap
   halaman. Gunakan komponen terpusat yang merujuk token semantik.
2. **Token semantik saja:** dilarang arbitrary value (`bg-[#345678]`) selama
   token tersedia di `globals.css`.
3. **Zero-Migration Guarantee:** penyesuaian UI tidak boleh mengubah arsitektur
   backend, skema Prisma, atau model domain yang terkunci.
4. **Komentar ber-tujuan (Intentionality):** komentar menjelaskan *mengapa*
   sebuah keputusan diambil, bukan mengulang isi kode. Dilarang komentar
   narasi hasil generate, komentar kode mati, atau blok komentar basa-basi.
5. **Evidence Over Claims di dokumentasi:** angka, performa, dan klaim dalam
   komentar/README harus dari hasil ukur nyata, bukan perkiraan.
6. **Selesai = terverifikasi:** `npm run test` hijau, `npm run typecheck` hijau,
   lalu `git push`. Kode yang belum lolos ketiganya jangan diklaim selesai.
