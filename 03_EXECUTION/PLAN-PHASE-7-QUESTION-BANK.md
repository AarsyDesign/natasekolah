# Phase 7 - Question Bank (Bank Soal): MODE 1 PLAN

* **Status:** DISETUJUI & DIEKSEKUSI. Persetujuan pengguna via instruksi "Lanjutkan, jangan nunggu aku" (Telegram, 2026-10-01). Keputusan R6 diambil Mizan, sesuai default terbaik plan:
  (a) izin `exam:view`/`exam:manage` (konvensi 11 domain lain), (b) gate plugin `FORMAL_ACADEMIC` yang sudah ada (tanpa plugin baru), (c) rute `/exams/question-bank` (induk modul ujian, siap untuk Exam Paper Engine), (d) opsi soal sebagai tabel `QuestionOption` (divalidasi & di-query, compound FK).
* **Tanggal:** 2026-10-01
* **Branch:** `feature/mizan-work`
* **Acuan:** `00_PRODUCT/MASTER_PRD.md` #28, #30, #31, #32, #33, #60; `03_EXECUTION/ROADMAP.md` (Phase 7 Gate); `DESIGN.md` §21-§23; `AGENTS.md` (Strict DoD, Phase Gate Governance).
* **Lokasi dokumen:** repo ini tidak memiliki folder `docs/`. Dokumen perencanaan mengikuti struktur tata kelola `AGENTS.md`, yaitu folder `03_EXECUTION/` (tempat `ROADMAP.md`, `TODO.md`, `PROGRESS.md`), sehingga plan ini disimpan sebagai `03_EXECUTION/PLAN-PHASE-7-QUESTION-BANK.md`.

---

## 1. Current State (Bacaan Faktual Repo)

* **Prisma:** `prisma/schema.prisma` berisi **30 model** dan sejumlah `enum`, **0 model** terkait soal/ujian (`grep -i "question|exam"` di schema = nihil). Model akademik yang relevan baru sampai `Subject`, `TeacherAssignment`, `Assessment`, `AssessmentScore`, `ReportCard`, `ReportCardSubject`.
* **RBAC:** `src/lib/auth/permissions.ts` berisi **26 izin** pada **12 domain** (`student, academic, attendance, finance, staff, classroom, report, tahfidz, dormitory, guardian, institution, settings`) dan **6 peran** (`SUPER_ADMIN, FOUNDATION_HEAD, PRINCIPAL, ADMIN, TEACHER, FINANCE_STAFF`).
  * `staff:manage` **sudah ada**.
  * `exam:write` **BELUM ADA** dan bukan konvensi repo. Pola penamaan yang terpakai 11 dari 12 domain adalah `<domain>:view` + `<domain>:manage` (hanya domain `student` memakai `create/edit/archive`). Migrator legacy (`LEGACY_PERMISSION_MAP` / `MODERN_TO_LEGACY_MAP`) wajib disentuh bila izin baru ditambahkan.
* **Plugin:** `src/lib/plugins/registry.ts` berisi **4 plugin** (`FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM`). `requirePlugin()` dipakai di `src/lib/formal-academic/assessment-service.ts`. Rantai otorisasi resmi: `Session -> Tenant -> RBAC -> Plugin -> Domain`.
* **UI:** **46 file** `src/app/**/page.tsx`. **Rute `/exams` belum ada** (tidak ada folder `src/app/exams`). `src/components/nav-header.tsx` punya **16 link** navigasi, tidak ada entri "Bank Soal". Primitif UI tersedia 15 file di `src/components/ui/`, plus `data-dense/data-table-view.tsx`, `importer/student-import-modal.tsx`, `loading/`.
* **Importer/Exporter:** `src/lib/importer/` (5 modul: `parser`, `sanitizer`, `validator`, `importer-service`, `types`) sudah berjalan untuk **siswa**, termasuk `parseSpreadsheetBuffer` (xlsx/csv) dan `generateStudentImportTemplateBuffer`. Ekspor CSV ada pola siap pakai di `src/lib/finance/export-utils.ts` (`downloadCSV`, BOM UTF-8).
* **Server Action:** pola `src/actions/*.ts` (`"use server"`, semua export `async`, `getContext()` -> `getAuthenticatedTenantContext()` -> service -> `{ success, data | error }` + `revalidatePath`). Lihat `src/actions/teaching.ts`.
* **Service:** pola `src/lib/<domain>/<domain>-service.ts` menerima `ctx: TenantContext`, memanggil `requirePermission(ctx, "...")`, lalu query `where: { institutionId: ctx.institutionId }` (contoh: `src/lib/settings/user-service.ts`).
* **Test:** `npm test` = `node --env-file-if-exists=.env --import tsx --test test/*.test.ts`. **28 file test**, baseline **412/412 PASS** (CHANGELOG 2026-10-01). Pola: `node:test` + `assert/strict`, fixture `TenantContext` untuk institusi A dan B, tabel in-memory, dan monkey-patch `prisma.<model>.<method>` (contoh `test/teaching-core.test.ts`).
* **Migrasi database:** `prisma/migrations/` berisi 2 migrasi (`20260924012230_init`, `20261001004500_restrict_setnull_integrity`). Database lokal **dibuat lewat `db push`**, sehingga `prisma migrate status` exit 1 (drift) dan **`prisma migrate dev` akan menawarkan reset database: DILARANG dijalankan** (tercatat di `03_EXECUTION/PROGRESS.md` dan `04_DEVELOPMENT/CHANGELOG.md`).
* **PRD Phase 7:** `ROADMAP.md` Phase 7 Gate = `Centralized Question Bank (3-Tier)` + `AI Question Generator with Fair Use Guard (30x/hari + cooldown)`.
* **Catatan inkonsistensi dokumen:** matriks di `03_EXECUTION/PROGRESS.md` menulis "Phase 7 = Parent Experience (COMPLETE)", sedangkan `03_EXECUTION/ROADMAP.md` menulis "Phase 6 = Parent Experience, Phase 7 = AI & Automation". Plan ini mengikuti `ROADMAP.md`. Keselarasan penomoran perlu diperbaiki saat dokumentasi tahap akhir.

---

## 2. Problem / Scope

### Tujuan
Menyediakan bank soal terpusat per lembaga (multi-tenant) yang bisa dipakai guru untuk menyusun, mengelola, mengimpor, dan mengekspor soal, sebagai fondasi sebelum Exam Paper Engine dan AI Question Generator.

### Ruang Lingkup (IN)
1. CRUD bank soal: buat, ubah, arsipkan, hapus lunak, detail, daftar + pencarian + filter.
2. Pengelompokan: kategori **mata pelajaran** (`Subject`, sudah ada) + `topic`/bab + tingkat kesulitan.
3. Tipe soal: **Pilihan Ganda** (4 opsi, 1 kunci), **Jawaban Singkat** (kunci teks), **Essay** (rubrik/pedoman penskoran).
4. Status siklus soal: `DRAFT` -> `ACTIVE` -> `ARCHIVED` (soal terpakai tidak boleh hilang diam-diam).
5. Impor massal (xlsx/csv) dan ekspor (csv/xlsx) mengikuti pola importer & `export-utils` yang sudah ada.
6. RBAC + tenant isolation + audit trail (`AuditLog`) pada setiap mutasi.

### Di Luar Ruang Lingkup (OUT) / Ditunda
* **Exam Paper Engine** (PRD #31: kop, QR verifikasi, ekspor PDF/DOCX, layout 2 kolom) -> fase terpisah setelah bank soal stabil.
* **Scope `DEVELOPER_CENTRAL` dan `COMMUNITY`** (PRD #30, 3-Tier) -> tahap ini hanya `PRIVATE_INSTITUTION`; `COMMUNITY` butuh tabel tanpa `institutionId` + moderasi, risiko keamanan tinggi, ditunda.
* **AI Question Generator + Fair Use Guard** (PRD #32/#33) -> **TREK TERPISAH, TERBLOKIR KONFIGURASI** (lihat §10).
* Pengerjaan/penilaian soal oleh siswa (online quiz) -> belum ada di PRD fase ini.

---

## 3. Proposed Architecture

```text
UI /exams/question-bank/* (4-blok DESIGN.md)
        │  Server Action (async, guarded)
        ▼
src/actions/question-bank.ts
  getContext() -> getAuthenticatedTenantContext()
        │
        ▼
src/lib/question-bank/
  ├── question-service.ts   (CRUD + siklus status + resource scope guru)
  ├── category-service.ts   (filter mapel/topik/tingkat, ringkasan)
  ├── importer.ts           (preview + eksekusi impor soal)
  └── exporter.ts           (buffer csv/xlsx)
        │  requirePermission -> requirePlugin -> tenant where-clause
        ▼
prisma (Question, QuestionOption) + AuditLog
```

* Rantai otorisasi wajib runut (mengikuti `src/lib/plugins/guard.ts`): `Session -> Tenant -> RBAC -> Plugin -> Domain Resource`.
* Setiap fungsi service menerima `TenantContext` dan **tidak pernah** menerima `institutionId` dari klien.
* Resource scope guru: guru dengan `exam:manage` hanya mengubah/menghapus soal miliknya (`createdBy = ctx.userId`), kecuali peran dengan `academic:manage` (ADMIN/PRINCIPAL/SUPER_ADMIN) yang boleh seluruh soal lembaga. Pola serupa sudah ada: `assertTeacherAssignmentAccess` dan scope sesi absensi guru.

---

## 4. Database Changes (Gap Schema + Strategi Migrasi)

### 4.1 Yang sudah ada (dipakai ulang, tanpa perubahan)
* `Subject` (`@@unique([institutionId, code])`, kategori `UMUM/AGAMA/MULOK/PEMINATAN`) sebagai dimensi kategori wajib.
* `User` (`institutionId`) untuk `createdBy`.
* `AuditLog` untuk jejak mutasi.
* `Institution.enabledPlugins` untuk guard plugin.

### 4.2 Tabel BARU (belum ada, wajib dibuat)
1. **`Question`**
   * `id`, `institutionId` (not-null), `subjectId`, `createdBy`, `type` (`MULTIPLE_CHOICE | SHORT_ANSWER | ESSAY`), `difficulty` (`EASY | MEDIUM | HARD`), `topic` (String?), `stem` (Text), `explanation` (Text?), `shortAnswerKey` (String?, untuk SHORT_ANSWER), `status` (`DRAFT | ACTIVE | ARCHIVED`), `createdAt`, `updatedAt`.
   * Constraint mengikuti pola repo: `@@unique([id, institutionId])`, `@@index([institutionId, subjectId])`, `@@index([institutionId, status])`, `@@index([institutionId, type])`, compound FK `[subjectId, institutionId]` dan `[createdBy, institutionId]` (PostgreSQL).
   * Referensi silang ke soal yang sudah dipakai tidak di-hard delete: arsip (`status = ARCHIVED`) mengikuti prinsip "historical data is sacred".
2. **`QuestionOption`** (untuk pilihan ganda; bukan JSON, agar bisa divalidasi & di-query)
   * `id`, `institutionId`, `questionId`, `label` (`A|B|C|D`), `content` (Text), `isCorrect` (Boolean).
   * Constraint: `@@unique([questionId, label])`, compound FK `[questionId, institutionId]` dengan `onDelete: Cascade`.
   * Invariant divalidasi di service: tipe `MULTIPLE_CHOICE` wajib tepat 4 opsi dan tepat 1 `isCorrect = true`; tipe lain wajib 0 opsi.

### 4.3 Tabel yang TIDAK dibuat di tahap ini
* Tabel soal lintas-tenant (`CommunityQuestion` / pool `DEVELOPER_CENTRAL`).
* Tabel kuota AI (`AiGenerationUsage`) -> trek AI (§10).
* Tabel `Exam` / `ExamQuestion` -> Exam Paper Engine (OUT OF SCOPE).

### 4.4 Strategi migrasi (WAJIB diikuti, `prisma migrate dev` DILARANG)
1. Edit `prisma/schema.prisma` (tambah 2 model di atas).
2. `npx prisma validate` dan `npx prisma generate`.
3. Tulis **file migrasi manual**: `prisma/migrations/<YYYYMMDDHHMMSS>_question_bank_core/migration.sql` (konvensi sama dengan `20261001004500_restrict_setnull_integrity`), berisi `CREATE TABLE` + index + FK untuk kedua tabel baru.
   * Isi SQL ditulis tangan mengikuti hasil `npx prisma migrate diff --from-migrations --to-schema-datamodel prisma/schema.prisma --script` (perintah ini butuh shadow database; bila tidak tersedia, tulis `CREATE TABLE` langsung sesuai schema, seperti migrasi `restrict_setnull_integrity`).
   * Jangan arahkan diff ke `--to-empty` (itu menghasilkan perintah DROP).
4. **Apply manual** ke database lokal (`psql -f ...` atau `npx prisma db execute --file ...`). Jangan memakai `prisma migrate dev` (akan menawarkan reset) dan jangan `db push` (menambah drift).
5. Verifikasi: `npx prisma migrate status` (migrasi baru tercatat), `npx prisma migrate diff --from-migrations --to-schema-datamodel` -> **"No difference detected"**, `npx prisma validate` -> valid.
6. Bila terjadi perbedaan yang tidak bisa dijembatani, jalur pengaman adalah **rebase manual SQL**, bukan reset database.

---

## 5. Rencana RBAC & Tenant Isolation

### 5.1 Izin baru (mengikuti pola `view`/`manage`)
* Tambah 2 izin ke `PERMISSIONS` (`src/lib/auth/permissions.ts`), domain **`exam`**:
  * `exam:view` (membaca daftar/detail soal, mengunduh ekspor)
  * `exam:manage` (buat, ubah, arsip, hapus, impor)
* Catatan keputusan: **`exam:write` tidak dipakai** karena tidak sesuai konvensi 11 domain lain (`:view`/`:manage`). Bila ada konsumen lama yang menulis `exam:write`, daftarkan di `LEGACY_PERMISSION_MAP` -> `["exam:manage"]` dan pasangkan di `MODERN_TO_LEGACY_MAP`.

### 5.2 Pemetaan ke `ROLE_PERMISSIONS`
| Peran | `exam:view` | `exam:manage` | Catatan |
| :--- | :---: | :---: | :--- |
| SUPER_ADMIN | ya | ya | ikut `*` |
| FOUNDATION_HEAD | ya | tidak | pengawas, baca saja |
| PRINCIPAL | ya | ya | sejajar `academic:manage` |
| ADMIN | ya | ya | sejajar `academic:manage` |
| TEACHER | ya | ya | dibatasi resource scope (milik sendiri) |
| FINANCE_STAFF | tidak | tidak | di luar domain akademik |

* Perubahan `ROLE_PERMISSIONS` wajib diuji di `test/rbac-fine-grained.test.ts` (file test izin yang sudah ada) agar matriks tunggal sumber kebenaran tetap konsisten.

### 5.3 Tenant isolation (mengikuti `src/lib/settings/user-service.ts`)
* `institutionId` hanya dari `ctx.institutionId` (hasil `getAuthenticatedTenantContext()`), tidak pernah dari payload klien; payload klien tetap melewati `sanitizeClientInput`.
* Semua query service menyertakan `where: { institutionId: ctx.institutionId }`.
* Compound FK `[subjectId, institutionId]` dan `[questionId, institutionId]` menegakan batas di level database (poloa repo: FK komposit PostgreSQL).
* Setiap mutasi menulis `AuditLog` dengan `institutionId` yang sama.
* Guard plugin: `requirePlugin(institution, PLUGINS.FORMAL_ACADEMIC)` (PRD #28 menaruh Question Bank di dalam scope plugin akademik formal). **Butuh konfirmasi pengguna**: pakai plugin `FORMAL_ACADEMIC` yang sudah ada, atau tambah plugin baru `QUESTION_BANK` (lihat §10 Risiko R6).

---

## 6. Files to Create / Modify

### Baru (Create)
* `prisma/migrations/<ts>_question_bank_core/migration.sql`
* `src/lib/validation/question-bank.ts` (Zod: create/update/filter/import)
* `src/lib/question-bank/index.ts`
* `src/lib/question-bank/question-service.ts`
* `src/lib/question-bank/category-service.ts`
* `src/lib/question-bank/importer.ts`
* `src/lib/question-bank/exporter.ts`
* `src/actions/question-bank.ts`
* `src/app/exams/question-bank/page.tsx`
* `src/app/exams/question-bank/[id]/page.tsx`
* `src/app/exams/question-bank/import/page.tsx` (opsional, boleh modal bila ingin lebih ramping)
* `src/components/importer/question-import-modal.tsx` (mengikuti `student-import-modal.tsx`)
* `test/question-bank.test.ts`

### Diubah (Modify)
* `prisma/schema.prisma` (+2 model)
* `src/lib/auth/permissions.ts` (+2 izin, `ROLE_PERMISSIONS`, peta legacy bila perlu)
* `src/lib/validation/index.ts` (re-export)
* `src/components/nav-header.tsx` (+1 link "Bank Soal", ikon `LibraryBig`, tampil hanya bila `exam:view`)
* `test/rbac-fine-grained.test.ts` (kasus izin `exam:*`)
* `03_EXECUTION/TODO.md`, `03_EXECUTION/ROADMAP.md` (centang item Question Bank setelah verifikasi), `03_EXECUTION/PROGRESS.md`, `04_DEVELOPMENT/CHANGELOG.md`

---

## 7. Rencana UI (4-blok `DESIGN.md` §21)

Rute baru di bawah **`/exams/question-bank`** (folder `/exams` belum ada, jadi dibuat baru sebagai induk modul ujian).

**Blok 1 Header Section:** breadcrumb `Dashboard / Ujian / Bank Soal`, H1 `Bank Soal`, badge konteks (mis. `FORMAL_ACADEMIC`), deskripsi singkat, primary action `Tambah Soal` (kanan atas desktop, tetap terjangkau di mobile).

**Blok 2 Metric Summary Bar (opsional, 4 kartu):** Total soal, `DRAFT`, `ACTIVE`, jumlah mata pelajaran terpakai. Angka berasal dari query agregat, bukan placeholder.

**Blok 3 Control & Filter Bar:** pencarian debounce (stem/topik), dropdown filter `Mata Pelajaran`, `Tipe Soal`, `Tingkat Kesulitan`, `Status`; tombol `Ekspor CSV` dan `Impor Soal` di kanan.

**Blok 4 Content Area:** desktop tabel padat (`data-table-view.tsx`), mobile `ResourceList` vertikal reflow; footer pagination + ringkasan jumlah baris.

**Halaman detail `/exams/question-bank/[id]`:** stem, opsi dengan penanda kunci, metadata (mapel, topik, tingkat, pembuat), form edit, tombol `Arsipkan`.

**Kepatuhan wajib:**
* Empty state (`Belum ada soal. Mulai dengan menambahkan soal pertama.`), loading skeleton (`skeleton.tsx`), error state.
* Mobile < 430px tanpa overflow horizontal, target sentuh >= 44px, input ber-label (bukan placeholder saja), kontras WCAG AA.
* Dilarang (DESIGN §23): card overload, gradient soup, shadow tebal, pill-badge `rounded-full`, arbitrary color class, em dash (`-`) pada salinan UI, font < 12px, spinner fullscreen.
* Copy Bahasa Indonesia baku tanpa jargon marketing AI.

---

## 8. Rencana Test

File baru **`test/question-bank.test.ts`**, mengikuti pola `test/teaching-core.test.ts`: `node:test` + `assert/strict`, fixture `TenantContext` institusi A/B, tabel in-memory, monkey-patch `prisma.question.*` dan `prisma.questionOption.*`.

**Minimal 20 test baru** (baseline 412 -> target >= 432), rincian:

1. CRUD & validasi (8): buat soal pilihan ganda valid; tolak tipe tak dikenal; tolak pilihan ganda tanpa kunci; tolak pilihan ganda dengan 2 kunci; buat soal jawaban singkat; buat soal essay; ubah soal `ACTIVE`; arsipkan soal; tolak ubah soal berstatus `ARCHIVED`.
2. RBAC (5): `exam:view` bisa membaca, tidak bisa menulis; tanpa `exam:view` ditolak `AuthorizationError`; guru hanya mengubah soal miliknya; guru ditolak mengubah soal guru lain di lembaga yang sama; ADMIN boleh mengubah soal siapa pun dalam lembaganya.
3. Tenant isolation (4): daftar soal lembaga A tidak pernah memuat soal lembaga B; `getQuestion` silang-lembaga ditolak; update silang-lembaga ditolak; hapus silang-lembaga ditolak.
4. Plugin guard (1): operasi ditolak `DomainFeatureDisabledError` 403 bila plugin nonaktif.
5. Import/Export (2): preview impor menandai baris invalid (kunci ganda) dan valid; ekspor menghasilkan baris sebanyak soal pada lembaga ctx saja.

Ditambah kasus baru di `test/rbac-fine-grained.test.ts` (matriks `exam:view`/`exam:manage` per peran).

---

## 9. Tahapan Eksekusi Berurutan (dengan Verifikasi)

Verifikasi wajib di setiap tahap: `npx tsc --noEmit` (0 error) dan `npm test` (0 fail). Tahap yang menyentuh skema menambahkan `npx prisma validate`. Tahap UI dan tahap akhir menambahkan `npm run build`. **Tidak ada tahap yang menjalankan `prisma migrate dev`.**

| # | Tahap | Keluaran | Verifikasi tambahan |
| :--- | :--- | :--- | :--- |
| 0 | Baseline & persetujuan plan | Catat baseline (`tsc` 0, `npm test` 412/412, `prisma validate` OK) | Semua perintah dijalankan dan hasil dicatat |
| 1 | Skema + migrasi manual | 2 model + `migration.sql` + apply manual | `prisma validate`, `prisma migrate diff --from-migrations --to-schema-datamodel` nihil, `prisma generate` |
| 2 | Validasi Zod | `src/lib/validation/question-bank.ts` + re-export | `tsc`, `npm test` |
| 3 | RBAC & role matrix | 2 izin, 6 peran, peta legacy | `tsc`, `npm test` (kasus `rbac-fine-grained`) |
| 4 | Domain service | `question-service.ts`, `category-service.ts` | `tsc`, `npm test` (bagian CRUD + tenant) |
| 5 | Impor/ekspor | `importer.ts`, `exporter.ts`, template | `tsc`, `npm test` (bagian impor/ekspor) |
| 6 | Server actions | `src/actions/question-bank.ts` (semua export `async`) | `tsc`, `npm test` |
| 7 | UI mobile-first | 3 rute + modal import + NavHeader | `tsc`, `npm test`, `npm run build` (rute baru terkompilasi) |
| 8 | Dokumentasi & gate | `TODO.md`, `ROADMAP.md`, `PROGRESS.md`, `CHANGELOG.md` | `npm run build`, seluruh DoD dicek; bila ada butir belum terpenuhi status ditulis **PARTIALLY COMPLETE** |
| 9 | (TERPISAH) AI Question Generator | lihat §10 | Tidak memblokir tahap 0-8 |

Setiap tahap selesai = checklist Strict DoD (`AGENTS.md`) dipenuhi, minimal: schema & constraints, migration, domain service, validasi Zod, RBAC, tenant isolation teruji, server action, UI + empty/error state, mobile responsive, unit test, test lintas-tenant, dan dokumentasi `PROGRESS.md` + `CHANGELOG.md`.

---

## 10. Risks & Mitigations

* **R1. Migrasi database (Tinggi).** Database lokal dibuat via `db push`; `prisma migrate dev` akan menawarkan reset. *Mitigasi:* tulis migrasi manual + apply manual + verifikasi `migrate diff` (§4.4). Titik blokir: bila diff tidak nihil, hentikan dan laporkan, jangan reset.
* **R2. AI Question Generator butuh API key (Tinggi, TERBLOKIR).** `src/lib/*` dan `.env.example` tidak memiliki konfigurasi provider AI sama sekali. *Mitigasi:* dijalankan sebagai **trek terpisah** yang menunggu keputusan konfigurasi: (a) pilihan provider & nama env var, (b) perjanjian/kuota, (c) tabel kuota `AiGenerationUsage` (30 generate/hari/guru + cooldown 15 detik, PRD #33) yang berarti migrasi tambahan. Alur wajib `Draft -> Teacher Review -> Save` (AI tidak boleh langsung mempublikasikan). Core Question Bank tidak menunggu trek ini.
* **R3. Scope 3-Tier (Sedang).** `DEVELOPER_CENTRAL` dan `COMMUNITY` butuh tabel lintas-tenant + moderasi. *Mitigasi:* keputusan `PRIVATE_INSTITUTION` saja di tahap ini; catat sebagai backlog terpisah.
* **R4. Exam Paper Engine keluar scope (Sedang).** PRD #31 (PDF/DOCX, QR, kop ujian) sering dianggap satu paket. *Mitigasi:* eksplisit OUT OF SCOPE; model soal dirancang cukup untuk dijadikan sumber paper nanti.
* **R5. Race & duplikasi impor (Sedang).** *Mitigasi:* unique constraint per lembaga untuk referensi soal (mis. `@@unique([institutionId, reference])` bila kolom referensi ditambahkan), mode `SKIP_DUPLICATE` seperti importer siswa.
* **R6. Keputusan yang butuh persetujuan (Blokir tahap 4+):** (a) penamaan izin `exam:view`/`exam:manage` vs `exam:write`; (b) gate plugin `FORMAL_ACADEMIC` vs plugin baru `QUESTION_BANK`; (c) jalur rute `/exams/question-bank` vs `/question-bank`; (d) opsi soal sebagai tabel `QuestionOption` vs kolom JSON.
* **R7. Inkonsistensi penomoran fase (Rendah).** `PROGRESS.md` dan `ROADMAP.md` berbeda soal isi Phase 6/7. *Mitigasi:* perbaiki matriks saat tahap dokumentasi (tahap 8) tanpa mengubah fakta status fase yang sudah COMPLETE.
* **R8. Ketergantungan fitur (Rendah).** Soal tidak boleh dihapus keras bila sudah merujuk assessment. *Mitigasi:* arsip (`ARCHIVED`) + `AuditLog`, tanpa hard delete.

---

## 11. Definition of Done (Checklist Tahap Ini)

- [ ] Skema Prisma + constraint & compound FK
- [ ] Migrasi manual tercatat dan terverifikasi (`migrate diff` nihil), tanpa `migrate dev`
- [ ] Domain service + invariant tipe soal
- [ ] Validasi Zod
- [ ] RBAC `exam:view`/`exam:manage` di 6 peran
- [ ] Tenant isolation teruji (uji silang-lembaga)
- [ ] Server action terproteksi (semua export `async`)
- [ ] UI 4-blok + empty/loading/error state
- [ ] Mobile responsive (< 430px, tanpa overflow, sentuh >= 44px)
- [ ] Unit test baru >= 20 (`test/question-bank.test.ts`)
- [ ] Integration / cross-tenant test
- [ ] Dokumentasi `PROGRESS.md` + `CHANGELOG.md` (+ `TODO.md`, `ROADMAP.md`)

*Catatan Mode 1: dokumen ini adalah rencana. Implementasi baru dimulai setelah persetujuan pengguna (`AGENTS.md`, Alur Kerja 3-Tahap).*
