# PLAN — Phase 10: Exam Paper Engine (PRD #31) + Pengerasan Rilis

> Mode 1 (PLAN). Disusun 2026-10-02 **otomatis setelah Gate Phase 9 (9.5) lulus**,
> sesuai instruksi Arsyad: "Ketika sudah selesai nanti lakukan plan lagi".
> Prasyarat fase: `03_EXECUTION/PLAN-PHASE-9.md` gate LULUS (tsc 0, 584/584,
> build 0, ROADMAP bersih).

## 1. Current State
- Phase 0–9 lengkap: Question Bank (Phase 7), AI Generator (Phase 8, kini dengan
  4/4 TC QA E2E + 5 fix), Permit Engine (9.1), Guardian CRUD (9.2), Student 5
  Kluster (9.3). Test **584/584**, `tsc 0`, `build exit 0`.
- `prisma migrate status` = **up to date** (6 migrasi; backlog drift DB lokal
  dari `db push` sudah tertutup — tetap dilarang `prisma migrate dev`).
- Exam Paper Engine **belum ada sama sekali**: `grep exam-paper` = 0, dan
  **tidak ada satu pun dependensi PDF/DOCX/QR** di `package.json`
  (Raport PDF pun masih PRD-only). Bank soal sudah stabil → syarat plan
  Phase 7 §"OUT OF SCOPE" ("fase terpisah setelah bank soal stabil") terpenuhi.

## 2. Problem / Scope
PRD `00_PRODUCT/MASTER_PRD.md` #31 — guru butuh naskah ujian jadi cetak:
kop + identitas ujian + ruang nama + nomor peserta + footer + nomor halaman +
**QR verifikasi**, layout **2 kolom configurable**, output **PDF dan DOCX**,
dua versi: **Soal Siswa** dan **Kunci Jawaban**.
Ketaatan PRD: dilarang mengklaim penghematan kertas tanpa pengujian nyata.

Ruang lingkup IN: tabel Exam/ExamQuestion, compose dari Bank Soal, UI naskah,
ekspor PDF/DOCX, QR + halaman verifikasi, test & QA E2E.
OUT (tetap di 9.4/terblokir): pengerjaan soal oleh siswa (online quiz),
tier COMMUNITY/DEVELOPER_CENTRAL, CI workflow (token `workflow`), deploy
Vercel (kuota), AI provider nyata (butuh `AI_API_KEY`), rate-limit Redis/DB
(butuh keputusan infra).

## 3. Urutan Tahap (prioritas atas ke bawah)

### 10.1 Fondasi data & domain
- Model **`Exam`**: `institutionId` (compound FK), `academicYearId`,
  `subjectId`, `title`, `examType` (MIDTERM/FINAL/DAILY/…), `instructions`,
  `showAnswers`, `columnLayout` (`ONE`/`TWO`), `status`
  (`DRAFT`/`READY`/`ISSUED`/`ARCHIVED`), `verifyToken` (unik, hash-only),
  `createdBy`; `@@unique([id, institutionId])`.
- Model **`ExamQuestion`**: `examId`, `questionId`, `order`, `points`,
  compound unique `[examId, questionId]`, FK tenant ikut `examId`.
- **Migrasi MANUAL** `20261002080000_exam_paper_core` (file SQL +
  `migrate deploy`; verifikasi `migrate diff` nihil; `migrate dev` DILARANG).
- Zod `src/lib/validation/exam-paper.ts`; service
  `src/lib/exam-paper/exam-paper-service.ts`: `createExam`, `addQuestions`
  (validasi soal milik institusi & subjek sama), `reorder/setPoints`,
  `listExams`, `getExamDetail`, `regenerateToken`; guard
  `requirePermission exam:*` + plugin `FORMAL_ACADEMIC` + AuditLog
  (CREATE/UPDATE/DELETE tidak ada — hard delete dilarang: pakai `ARCHIVED`).

### 10.2 Server actions + UI `/exams/papers`
- `src/actions/exam-paper.ts` (`requireActionSession` +
  `runWithTenantContext` + `rethrowIfSessionExpired`).
- Daftar naskah (filter status/mapel), modal buat naskah (judul, mapel,
  tipe, petunjuk, layout kolom, tampil kunci), halaman detail: **tarik soal
  dari Bank Soal** (filter tipe/difficulty/jumlah, urutan + poin per soal),
  preview nomor soal, toggle kunci, empty/loading/error state, mobile 430px.

### 10.3 Ekspor PDF + QR verifikasi
- Dep baru: **`pdfkit`** (+`@types/pdfkit`), **`qrcode`**.
- `src/lib/exam-paper/export-pdf.ts`: kop (nama/alamat/logo R2 bila ada),
  identitas ujian, blok **Ruang Nama** + **Nomor Peserta**, body 1/2 kolom
  configurable, footer institusi + **nomor halaman (n dari m)**,
  mode **SISWA** (kunci disembunyikan; PG ditandai kotak/jawaban kosong) dan
  **KUNCI** (kunci tebal/latar), batas aman per halaman (uji: teks tidak
  terpotong di page break).
- **QR verifikasi**: `verifyToken` acak (disimpan hash), QR berisi URL
  `/verify/exam/<token>`; halaman publik menampilkan **identitas ringkas
  naskah** (lembaga, judul, tanggal, status) **tanpa daftar soal & tanpa
  data tenant lain** (audit tenant-wajib ditulis test).

### 10.4 Ekspor DOCX
- Dep baru: **`docx`**. `export-docx.ts` mengikuti struktur PDF (kop,
  identitas, ruang nama/nomor peserta, kolom via section, footer halaman,
  mode siswa/kunci). Satu sumber data (`buildExamPaperData`) dipakai
  kedua exporter agar tidak ada perbedaan isi.

### 10.5 QA E2E + test (DoD strict)
- Unit: compose naskah (urutan, poin, batas jumlah), RBAC (exam:view vs
  manage), cross-tenant (soal institusi lain DITOLAK), token regenerasi,
  validasi Zod; integration: buffer PDF mulai `%PDF`, DOCX = zip valid,
  halaman verifikasi publik tidak membocorkan stem/kunci; smoke HTTP
  download dengan sesi.
- QA E2E klik-manual: buat naskah → tarik 10 soal → atur poin → preview →
  unduh PDF & DOCX → buka URL QR → cocokkan identitas.
- Gate keluar: `tsc 0` · `npm test` **>600** · `build exit 0` · PROGRESS +
  CHANGELOG + ROADMAP konsisten → **lalu susun PLAN-PHASE-11** (siklus
  berlanjut; kalau seluruh backlog benar-benar habis termasuk yang terblokir,
  kirim laporan final, jangan mengarang kerjaan).

## 4. Database Changes
- +2 tabel (`Exam`, `ExamQuestion`), 1 migrasi manual, tanpa perubahan model
  lama; tidak menyentuh `Student`/`Enrollment` (Sacred History).

## 5. Files to Create / Modify
- Baru: `prisma/migrations/20261002080000_exam_paper_core/`,
  `src/lib/exam-paper/*` (service, export-pdf, export-docx, qr),
  `src/lib/validation/exam-paper.ts`, `src/actions/exam-paper.ts`,
  `src/app/exams/papers/*`, `src/app/verify/exam/[token]/page.tsx`,
  `test/exam-paper.test.ts`.
- Ubah: `prisma/schema.prisma`, `src/lib/plugins/registry.ts` (rute nav bila
  perlu), `src/components/nav-header.tsx`, `package.json` (3 dep),
  docs (PROGRESS/CHANGELOG/ROADMAP/TODO).

## 6. Verification Plan
`npx prisma migrate diff` nihil · `tsc --noEmit` 0 · `npm test` >600 ·
`npm run build` exit 0 · QA E2E browser (sesi lokal, tanpa password) ·
`migrate status` tetap "up to date".

## 7. Risks & Mitigations
- **Layout 2 kolom PDF meleset/terpotong** → engine flow per halaman + test
  panjang teks; fallback 1 kolom bila gagal.
- **Dep baru gagal install** (jaringan/kuota npm) → laporkan, jangan
  substitusi kode palsu; alternatif `pdf-lib`/`html`-to-PDF dicatat di ADR.
- **QR memata-matai data** → halaman verifikasi hanya identitas ringkas +
  test anti-leak; token disimpan hash.
- **Tabrakan dengan cron dev loop** → kerja per tahap, commit atomic per
  tahap hijau.
- **Vercel/CI tetap terblokir** → jangan dijanjikan di changelog.
