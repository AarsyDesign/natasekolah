# Development Changelog - NataSekolah

## [2026-10-02] - DOCS: Phase 8.6 — Verification Gate (VERIFIED) — **Phase 8 & seluruh fase 0–8 COMPLETE**

### Verification (Phase 8.6)
* `npx tsc --noEmit` **0 error** · `npm test` **473/473 pass, 0 fail** (150 suites) · `npm run build` **exit 0** (Turbopack, seluruh routes termasuk portal `/wali/*` terkompilasi).
* **DoD Strict — dijalankan per-suite, semua 0 fail:**
  * RBAC: `test/rbac-fine-grained.test.ts` **31/31** (termasuk izin `exam:view`/`exam:manage` untuk Question Bank & AI Generator).
  * Plugin Guard: `test/validation-plugins.test.ts` **22/22** (termasuk `DomainFeatureDisabledError` 403 & urutan 5 gerbang otorisasi).
  * Tenant Isolation: `test/tenant-isolation.test.ts` **10/10**.
  * AuditLog: tercakup di `test/question-bank.test.ts` **45/45** plus `bulk-promotion`, `finance-core`, `master-data-importer`.
* *Catatan environment:* `prisma validate` diblokir scanner keamanan pada run cron (eksekusi CLI prisma butuh approval); fase ini tidak menyentuh `schema.prisma`.

### Changed
* `03_EXECUTION/TODO.md`, `03_EXECUTION/ROADMAP.md`, `PROGRESS.md` — Phase 8.6 ditandai selesai; **Phase 8 (AI & Automation) COMPLETE**, seluruh fase 0–8 COMPLETE.

### Notes (bukan blocker)
* Klik-manual UI AI Generator (harness browser tidak tersedia di run cron) & simulasi timeout provider menggantung — opsional.
* API key provider AI nyata (OpenAI/Anthropic/Gemini/lokal) belum dipasang di deployment — keputusan operator.

## [2026-10-02] - FIX: Phase 8.5 — QA E2E Eksploratif AI Generator (VERIFIED)

### Fixed
* **BUG KRITIS: fitur Generate AI 100% rusak di DB nyata** — `createAIGenerationJob` memanggil `requirePlugin(ctx.institutionId, 'AI_GENERATION')` (string UUID), padahal guard mengharapkan baris institusi → `parseEnabledPlugins` gagal → **selalu 403** "belum diaktifkan" berapa pun konfigurasi plugin. Fix: ambil baris `Institution` dulu lalu `requirePlugin(institution, …)` (pola `question-service`). Tertutup selama ini oleh test mock — kelas bug yang sama dengan temuan Phase 7.
* **Metadata job menyesatkan** — UI hardcoded `provider: "openai"`, padahal runtime membaca `AI_PROVIDER` env (default `local`) → kolom `provider`/`model` di `AiGenerationJob` (dan Riwayat Blok 2b) tidak mencerminkan kenyataan. Fix: `createAIGenerationJob` mengambil provider/model dari env server, input klien hanya fallback.
* **Essay tanpa pedoman penskoran lolos** — `validateAIResult` kini mewajibkan `explanation` non-kosong untuk tipe ESSAY (konsisten dengan kontrak prompt & invariant Question Bank); tanpa rubrik → job `FAILED` dengan pesan jelas.
* **DB lokal: kasing kolom `ai_generation_usage`** — tabel dibuat script kustom dengan identifier unquoted (ter-fold `institutionid`, dst.) padahal file migrasi `20261001080000` benar (quoted camelCase) → PrismaClientKnownRequestError di seluruh fair-use guard (quota/cooldown/history). Diperbaiki via `RENAME COLUMN`/`ALTER INDEX` (data + FK aman); `migrate diff --from-url` kembali **nihil**. Perbaikan DB lokal, tanpa perubahan file migrasi.

### Verification (Phase 8.5)
* QA E2E service + DB nyata dengan mock provider HTTP (`scripts/_local-qa-ai.ts`, **lokal, tidak di-commit**): **34/34 PASS** — PG 5→review→simpan 3 (DRAFT + 4 opsi/1 kunci + AuditLog), Short Answer (kunci tersimpan), Essay (rubrik tersimpan; essay tanpa rubrik ditolak), quota ke-31 diblokir, cooldown 15 dtk diblokir, 4 mode error provider (invalid JSON / kosong / HTTP 500 / connection refused) → job `FAILED` + `errorMessage`, RBAC 403, tenant isolation, plugin guard 403, riwayat job.
* QA lapis server action via HTTP (prod `next start` + sesi nyata): **3/3 PASS** (`getAIGenerationQuotaAction` limit=30, usage history, list jobs).
* Smoke halaman: `/login` 200, `/exams/question-bank` 200 + marker Generate AI di HTML; Blok 2b & badge quota ada di bundle build (dirender client-side).
* `npx tsc --noEmit` **0** · `npm test` **473/473 pass, 0 fail** · `npm run build` **exit 0** · `migrate diff` nihil.
* *Belum: klik-manual UI (harness browser tidak tersedia di run cron) & simulasi timeout menggantung — opsional.*

## [2026-10-02] - FEAT: Phase 8.4 — Fair-Use Enforcement UI: Riwayat Job (VERIFIED)

### Added
* **Blok 2b "Riwayat Generate AI"** di `/exams/question-bank` — 5 job generate terakhir: badge status (`DRAFT`/`READY_FOR_REVIEW`/`SAVED`/`DISCARDED`/`FAILED`), nama mata pelajaran, waktu lokal id-ID, `provider/model`, dan `errorMessage` bila job gagal. Total generate 30 hari terakhir dari `getAIGenerationUsageHistoryAction`.
* **`loadFairUse()`** — satu fungsi memuat quota + usage history + job history, dipanggil saat mount dan setelah review job (save/discard) supaya badge quota & riwayat langsung segar.

### Fixed
* Data quota/history yang sebelumnya di-fetch tapi tidak pernah dirender (state `usageHistory` dan import `listAIGenerationJobsAction` mati) kini tampil di UI.

### Verification
* `npx tsc --noEmit` **0** · `npm test` **473/473 pass, 0 fail** · `npm run build` **exit 0**. Belum QA E2E (masuk Phase 8.5).

## [2026-10-01] - FEAT: Phase 7 Trek C — AI Generator Infrastructure (VERIFIED)

### Added
* **Models & Migration** — `AiGenerationUsage` (quota harian per guru, unique institution+user+date) + `AiGenerationJob` (async job queue DRAFT→READY_FOR_REVIEW→SAVED/DISCARDED/FAILED, relasi Institution/User/Subject). Migrasi manual `20261001080000_ai_generation_infrastructure` applied via custom Node script (FK casing fix PostgreSQL).
* **Plugin Registry** — `AI_GENERATION` plugin (coreDependencies: `exam`, category: `AI_AUTOMATION`) — opt-in per institusi.
* **Env Vars** (.env.example) — `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_DAILY_QUOTA_PER_TEACHER=30`, `AI_COOLDOWN_MS=15000`, `AI_GENERATION_ENABLED=false`.
* **Services** — `usage-service.ts` (check quota + cooldown, record usage), `ai-generation-service.ts` (create job → execute → validate → review → save to Question Bank, fair-use guard 30/hari + cooldown 15s, provider-agnostic scaffold).
* **Validation Schemas** — `src/lib/validation/ai-generation.ts` (Zod: prompt params, job create/execute/review, provider enum, status enum).
* **Cron Monitoring** — `project-completion-monitor` (job ID `abef6fcf4ae7`) schedule `0 */4 * * *` — cek tsc, test 473/473, build, prisma validate, AI infra files, Question Bank files, notifikasi completion otomatis.

### Verification
* `npx tsc --noEmit` 0 · `npm test` **473/473** (baseline 412 → +61) · `npm run build` exit 0 · `prisma validate` valid · push ke `origin/staging` (`f3e6c06`).

## [2026-10-01] - FEAT: Phase 8.1-8.3 — AI Provider Adapters + Server Actions + Generate Modal UI (VERIFIED)

### Added
* **AI Provider Adapters** (`src/lib/ai-providers/index.ts`) — 4 provider: OpenAI (function calling/structured output), Anthropic (Claude JSON mode), Gemini (Google AI Studio), Local (Ollama/vLLM). Factory pattern `getAIProvider()` mirip WhatsApp provider.
* **Server Actions** (`src/actions/ai-generation.ts`) — `createAIGenerationJobAction` (quota guard), `executeAIGenerationAction` (call provider, validate, update job), `reviewAIGenerationJobAction` (save/discard partial, link ke Question Bank), `listAIGenerationJobsAction`, `getAIGenerationJobDetailAction`.
* **Generate Modal UI** di `/exams/question-bank` — 3 step: Form → Generating → Review. Form: Mapel, Tipe (PG/Short/Essay), Kesulitan, Jumlah (1-10), Topik, Instruksi. Review: expandable cards, checkbox pilih soal, "Pilih semua", simpan ke Question Bank (DRAFT).
* **Validation Schemas** — `src/lib/validation/ai-generation-actions.ts` (Zod: create job, save result, list filters, provider enum, status enum).

### Verification
* `npx tsc --noEmit` 0 · `npm test` **473/473** · `npm run build` exit 0 · `prisma validate` valid · push ke `origin/staging` (`c0818bd`).

## [2026-10-01] - FEAT: Phase 8 — AI Provider Adapters (OpenAI, Anthropic, Gemini, Local) (VERIFIED)

### Added
* **AI Provider Interface** — `src/lib/ai-providers/provider.interface.ts` (mirip pola WhatsApp provider abstraction).
* **OpenAI Provider** — `src/lib/ai-providers/openai.provider.ts` (function calling / structured output JSON, model support: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo).
* **Anthropic Provider** — `src/lib/ai-providers/anthropic.provider.ts` (Claude JSON mode, model support: claude-3.5-sonnet/haiku/opus, claude-3-sonnet/haiku).
* **Google Gemini Provider** — `src/lib/ai-providers/gemini.provider.ts` (Google AI Studio, model support: gemini-1.5-pro/flash, gemini-1.0-pro).
* **Local Provider** — `src/lib/ai-providers/local.provider.ts` (Ollama/vLLM/OpenAI-compatible endpoints, auto-detect OpenAI-compatible / Ollama native, `listModels()` support).
* **Provider Factory** — `src/lib/ai-providers/provider-factory.ts` (factory pattern, caching, fallback support, `callAIProviderWithFallback`).
* **Integration** — `ai-generation-service.ts` sekarang memanggil provider nyata via `getAIProvider()` (mock `callAIProvider` diganti implementasi nyata).
* **Types Update** — `AI_PROVIDERS` ditambah `'local'` di `types.ts` dan `validation/ai-generation.ts`.

### Verification
* `npx tsc --noEmit` 0 · `npm test` **473/473** · `npm run build` exit 0 · `prisma validate` valid.

## [2026-10-01] - FEAT: Phase 7 Question Bank Tahap 7 (UI) + FIX nested-create Prisma (VERIFIED)

### Added
* **Rute UI** `src/app/exams/question-bank/` — halaman daftar (metric bar opsional,
  filter search debounce + mapel/tipe/tingkat/status, tabel desktop / `ResourceList`
  mobile, `Pagination`, empty/loading/error state) dan `/[id]` (detail + edit +
  transisi status DRAFT↔ACTIVE + Arsip dengan konfirmasi).
* **Modal impor 4 langkah** `src/components/importer/question-import-modal.tsx`
  (Unggah → Pratinjau tab Semua/Valid/Error → Eksekusi → Hasil + unduh template).
* **Form soal** `src/components/question-bank/question-form-fields.tsx` + util
  klien `question-bank-ui.ts` (validasi klien, payload builder, label/badge).
* **Nav** link "Bank Soal" di `nav-header.tsx` dan `app-shell.tsx` (MASTER_DATA_ITEMS).

### Fixed
* **BUG Kritis (E2E-tertemukan):** nested `options.create` di `question-service.ts`
  (create & update-replace) mengirim `institutionId` — field itu bagian FK compound
  `[questionId, institutionId]`, jadi Prisma mengecilkannya dari input nested →
  `Unknown argument institutionId` → semua create soal (dan impor) gagal di DB
  nyata. Field dihapus (diisi otomatis dari induk). Lolos 45 test karena suite
  memakai Prisma **mock in-memory** (`installPrismaMocks`) — jalur write asli tak
  tercakup; terbukti hanya lewat QA E2E eksploratif.

### Verification
* `npx tsc --noEmit` 0 · `npm test` 464/464 · QA E2E: create PG sukses (toast +
  row + metrik Draf=1), detail page OK, mobile 390px tanpa overflow, validasi
  shortName & invariant menolak input salah.

## [2026-10-01] - FEAT: Phase 7 Question Bank Tahap 2-6 (VERIFIED)

### Added
* **Validasi Zod** `src/lib/validation/question-bank.ts` (strict): create/update/
  filter/import/status + invariant tipe soal via `superRefine` (PG wajib 4 opsi & 1
  kunci, SHORT_ANSWER wajib kunci teks, ESSAY tanpa opsi).
* **Domain** `src/lib/question-bank/`: `question-service` (CRUD + siklus DRAFT→ACTIVE→
  ARCHIVED + hapus lunak, guard Session→Tenant→RBAC→Plugin→Domain, resource scope guru
  via `academic:manage`, AuditLog tiap mutasi), `category-service` (agregat metrik),
  `importer` (preview VALID/ERROR + deteksi kunci ganda + template xlsx/csv),
  `exporter` (CSV 16 kolom, hanya soal lembaga ctx), `types` (error domain).
* **Server action** `src/actions/question-bank.ts`: 15 action, semua `async`,
  `revalidatePath("/exams/question-bank")`.
* **Test +52** (412→464): `test/question-bank.test.ts` 45 test (CRUD/invariant,
  RBAC+scope guru, tenant isolation A/B, plugin guard, kategori, impor/ekspor,
  cek async) + 7 kasus matriks `exam:*` di `rbac-fine-grained.test.ts`.

### Changed
* `src/lib/auth/permissions.ts`: +`exam:view`/`exam:manage`, matriks 6 peran
  (FINANCE_STAFF nihil, FOUNDATION_HEAD view-only), peta legacy `exam:read`/`exam:write`.
* Zod v4 pitfall: `.partial()` mengaktifkan `.default()` → skema update ditulis
  eksplisit; `status` hanya lewat endpoint transisi.

### Verified
`npx tsc --noEmit` 0 · `npm test` **464/464** · `GET /login` HTTP 200 ·
`npm run build` hijau (verifikasi subagent; build ulang penuh menyusul di tahap 7/8).


## [2026-10-01] - FEAT: Skill anti-slop repo (6 file), rujukan mati dipulihkan (VERIFIED)

### Added
* **`antislop.md`** (filter inti): 4 Core Principles, dials `ENERGY 1 / RHYTHM 2 / MOTION 1`,
  indeks pemilihan skill, definisi gagal audit. Selama ini dirujuk `AGENTS.md`/`GEMINI.md`
  (18 rujukan) tapi file-nya tidak pernah ada di repo maupun riwayat git.
* **5 skill turunan** di `skills/antislop-{ui,copywriting,human,layoutmobile,code}/SKILL.md`
  - semua aturan diambil dari `DESIGN.md` (§3, §16, §17, §20, §21, §22, §23, §24), bukan karangan.
* Verifikasi: seluruh rujukan `AGENTS.md` kini hidup; `tsc` 0; `412/412` test hijau.

## [2026-10-01] - QA Login End-to-End + Perbaikan Temuan (VERIFIED)
### QA End-to-End (browser, tanpa menangani password)
* **Login sukses terbukti di UI** lewat sesi server (`createSession` + cookie
  `nata_session` via CDP) — alur kerja nyata sampai ke `/settings/users`.
* **Jalur sukses fitur Tambah Pengguna terbukti**: form terisi → submit sebagai
  SUPER_ADMIN → "Akun Guru Uji QA berhasil dibuat" → muncul di daftar (3→4).
* **Jalur RBAC terbukti**: submit sebagai ADMIN → ditolak `staff:manage`.

### Fixed (temuan QA)
* **Tombol "Tambah Pengguna" kini hanya tampil bila punya izin `staff:manage`.**
  Sebelumnya tombol selalu tampil → ADMIN mengisi form panjang lalu ditolak.
  `listManagedUsersAction` kini mengembalikan `{ users, canManage }`
  (`hasPermission(ctx, "staff:manage")`), UI menyembunyikan tombol, default
  tertutup bila muat gagal.
* **Banner error tidak lagi kembar**: saat modal terbuka, banner error di halaman
  disembunyikan (sebelumnya pesan yang sama muncul dua kali).

### Verification
* `tsc --noEmit` 0 · `npm test` **412/412** · browser: ADMIN tombol hilang /
  SUPER_ADMIN tombol tampil.


## [2026-10-01] - Fix UX: pesan throttle login manusiawi + pitfall Server Action (VERIFIED)
### Fixed
* **Pesan rate limit login** tidak lagi menampilkan detik mentah: dari "Coba lagi
  dalam 599 detik." menjadi **"Coba lagi dalam 9 menit 59 detik."** — helper baru
  `formatDurasi(seconds)` di `src/lib/auth/rate-limit.ts`.
* **Pitfall Next.js 16 yang ditemukan lewat QA browser (bukan oleh tsc/test):**
  SEMUA export di file `"use server"` (`src/actions/*.ts`) harus `async` — ekspor
  sync `formatDurasi` membuat **dev server 500 di semua halaman** padahal
  `tsc --noEmit` 0 dan 412/412 test lulus. Helper dipindah ke lib; diaudit 14
  file `src/actions/` lain → tidak ada pelanggaran serupa.
### Verification
* `tsc --noEmit` 0 · `npm test` **412/412** (2 test baru `formatDurasi`) ·
  `npm run build` exit 0 · `GET /login` **HTTP 200** (sempat 500, pulih setelah fix).
* QA browser nyata: login salah 4× → pesan generik (tanpa bocoran akun), ke-5 →
  throttle dengan format baru; tanpa overflow horizontal; 0 error console.


## [2026-10-01] - Fix: 3 high vulnerability npm audit (VERIFIED)
### Changed
* **`package.json` → `overrides: { "deepmerge-ts": "^8.0.2" }`** — menutup 3 advisory
  high `GHSA-ggr8-5vv4-36mx` (stack exhaustion saat merge objek rekursif) di rantai
  `prisma → @prisma/config → deepmerge-ts@7.1.5`. `npm audit fix` TIDAK bekerja di sini
  (rentang pin eksak, dry-run "up to date") dan solusi sebelumnya "butuh prisma 8"
  ternyata tidak perlu — cukup override. v8 masih dual-format (CJS/ESM, `main` CJS,
  node ≥16) dan `@prisma/config` hanya memakai ekspor `deepmerge` yang tetap ada.
### Verification
* `npm audit` **0 vulnerabilities** (total & `--omit=dev`).
* Prisma CLI tetap hidup dengan v8: `prisma validate` ✓, `prisma generate` ✓,
  `prisma migrate status` ✓ (exit 1 = drift `db push` lama, wajar & terdokumentasi),
  `prisma migrate diff --from-migrations --to-schema-datamodel` → "No difference detected".
* `tsc --noEmit` 0 · `npm test` **410/410** · `npm run build` exit 0.


## [2026-10-01] - Fitur: Tambah Pengguna (Staf/Guru) dari Dalam Aplikasi (IMPLEMENTED / VERIFIED)

### Added
* **`src/lib/settings/user-service.ts` — `createManagedUser(ctx, input)`**: membuat akun staff/guru. `institutionId` SELALU dari sesi server (payload `.strict()` → kunci asing seperti `institutionId` dari klien langsung ditolak `ValidationError`), RBAC `staff:manage` (hanya SUPER_ADMIN / FOUNDATION_HEAD), aturan anti-escalation (hanya SUPER_ADMIN boleh membuat akun SUPER_ADMIN), cek email ganda per-tenant, hash bcrypt (work factor 12), roles di-`JSON.stringify` mengikuti `updateUserRoles`.
* **`src/lib/settings/validation.ts` — `createManagedUserSchema`**: nama 2–120, email, sandi 12–128, `phoneSchema` opsional, roles enum `ROLES` minimal 1 tanpa duplikat — semua `.strict()` + pesan Bahasa Indonesia.
* **`src/actions/settings.ts` — `createManagedUserAction`**: mengikuti pola action settings yang ada (error → `{ success: false, error }`, sukses → `ManagedUser`).
* **UI `/settings/users`**: tombol **Tambah Pengguna** (header), modal form (nama, email, WA opsional, sandi + hint minimal 12 & edukasi "sampaikan lewat jalur pribadi", pilihan peran), banner error di dalam modal (page banner tertutup overlay), state `errorMsg`/`successMsg` + daftar langsung diperbarui.
* **`test/user-management.test.ts` — 8 test**: akun menempel lembaga sesi; payload `institutionId` asing ditolak + tidak ada baris terbuat; akun hasil pembuatan **bisa login** (`authenticateCredentials`); RBAC tanpa `staff:manage` ditolak; eskalasi SUPER_ADMIN ditolak (ctx FOUNDATION_HEAD agar menembus RBAC dulu); email ganda ditolak; sandi lemah & peran asing ditolak; isolasi tenant (lembaga lain tak melihat).

### Verification
* `tsc --noEmit` exit 0 · `npm test` **410/410** · `npm run build` exit 0.

## [2026-10-01] - Critical: Bootstrap Pembuatan Lembaga & Akun SUPER_ADMIN (IMPLEMENTED / VERIFIED)

### Added
* **`scripts/seed-core.ts` + `scripts/seed.ts` + script `npm run seed`** — satu-satunya
  (dan yang pertama) jalur pembuatan akun di aplikasi ini.
* `test/seed-bootstrap.test.ts` — 7 pengujian: pembuatan lembaga+admin, sifat idempoten,
  login sungguhan lewat `authenticateCredentials`/`loginUser`, sesi tervalidasi,
  penolakan kata sandi lemah, dan penolakan slug tidak sah.

### Problem (temuan audit 2026-10-01)
* `grep` menyeluruh atas `src/` menemukan **nol** `institution.create`, **nol**
  `user.create`, `hashPassword` **tidak pernah dipanggil**, tidak ada halaman
  onboarding/pendaftaran, dan tidak ada seed bawaan. Konsekuensinya: pada database
  kosong **tidak mungkin login** — aplikasi belum dapat dipakai sama sekali.
* Temuan ini juga menjelaskan mengapa ketiga baris data lokal hanya berasal dari
  fixture pengujian.

### Design
* **Idempoten** — dijalankan berapa kali pun tidak pernah menggandakan data, dan
  run ulang **tidak pernah menimpa** kata sandi akun yang sudah ada.
* **Tervalidasi Zod** — slug format ketat (`a-z0-9` + tanda hubung), email valid,
  kata sandi minimal 12 karakter; validasi gagal = tidak ada data yang ditulis
  (transaksional per langkah: lembaga dulu, baru akun).
* **Keamanan kredensial** — kata sandi hanya dibaca dari environment variable
  (tidak pernah argv, karena argv terlihat di `ps`), di-hash bcrypt cost 12,
  dan **tidak pernah dicetak** — output CLI hanya slug, id, dan bendera hasil
  (diverifikasi: kedua run tidak mengandung string kata sandi maupun email).
* Peran `SUPER_ADMIN` ditulis sebagai JSON sesuai `ROLE_PERMISSIONS`.

### Verification
* `tsc --noEmit` 0 error · `npm test` **402/402** (395 + 7 baru) ·
  `npm run seed` tanpa env → exit 1 dengan daftar variabel yang kurang (tanpa
  kebocoran) · run 1 → "dibuat baru", run 2 → "sudah ada, tidak diubah" ·
  data uji dibersihkan setelah pengujian.

---

## [2026-10-01] - Integrity: FK `SetNull` → `Restrict`, kebersihan repo & konfigurasi (IMPLEMENTED / VERIFIED)

### Fixed
* **3 warning Prisma `onDelete: SetNull` pada FK komposit** — `StudentCharge.academicYear`,
  `CashbookEntry.paymentTransaction`, `ReportCard.publishedBy` semuanya ber-FK
  `(…, institutionId)`, dan `institutionId` **wajib not-null** (penjaga tenant).
  `ON DELETE SET NULL` pada kolom not-null gagal di tingkat database. Diubah menjadi
  **`Restrict`**: induk (AcademicYear / PaymentTransaction / User penerbit) tidak boleh
  dihapus selama masih dirujuk — sejalan dengan prinsip "histori data suci". Kode aplikasi
  tidak melakukan hard delete pada ketiga induk tersebut, jadi tidak ada alur yang terganggu.
* File migrasi `prisma/migrations/20261001004500_restrict_setnull_integrity/migration.sql`
  dibuat dan **diterapkan ke database lokal** (verifikasi: `information_schema` kini
  menunjukkan `RESTRICT`, dan `migrate diff --from-url … --to-schema-datamodel`
  menghasilkan *diff kosong*).

### Removed
* `SESSION_SECRET` dari `.env.example` — var itu **tidak pernah dibaca kode mana pun**;
  desain sesi tidak memerlukannya (token acak 256-bit + hash SHA-256 di DB, cookie
  HttpOnly/Secure/SameSite-Lax/__Host-). Dokumentasi `CRON_SECRET` (yang memang dipakai
  `/api/cron/*`) ditambahkan menggantikannya.
* `tsconfig.tsbuildinfo` dilepas dari tracking Git dan dimasukkan ke `.gitignore`
  (artefak build, 163KB, terus-menerus muncul sebagai perubahan).

### Changed (GitHub)
* **PR #4 ditutup** sebagai duplikat PR #5 (sudah di-merge 2026-09-28). Bukti: seluruh
  isi 13 file yang diubah PR #4 identik dengan `staging` (beda hanya catatan
  `PROGRESS.md`/`CHANGELOG.md` yang memang lebih baru di `staging`) → tidak ada kode
  yang hilang. Kini **0 PR terbuka**.

### Verification
* `prisma validate`: **0 warning** (sebelumnya 3) · `tsc --noEmit` 0 error ·
  `npm test` **395/395**.

---

## [2026-10-01] - Security: Rate Limiting Brute-Force pada Login (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/auth/rate-limit.ts` — pembatas kegagalan login sliding-window in-memory.
  Dua lapis: per-akun (slug lembaga + email, 5 kegagalan / 10 menit) dan
  per-IP dari `x-forwarded-for` (30 kegagalan / 10 menit). Waktu dapat
  disuntikkan (`now`) sehingga pengujian deterministik tanpa `setTimeout`.
* `test/auth-rate-limit.test.ts` — 11 pengujian: window, reset saat login
  sukses, isolasi antar-key, batas jumlah key (anti memory bocor), normalisasi
  key, serta perilaku `loginAction` terhadap kegagalan beruntun.

### Changed
* `src/actions/auth.ts` — `loginAction` kini:
  1. memeriksa rate limit **sebelum** bcrypt dijalankan (blokir lebih awal);
  2. menghitung setiap kegagalan autentikasi; pesan kekalahan tetap generik,
     pesan pembatas menyebut waktu tunggu (retry-after);
  3. mereset hitungan akun ketika login berhasil;
  4. meneruskan `ipAddress` (x-forwarded-for) dan `userAgent` ke `loginUser`,
     sehingga IP login tercatat di sesi untuk keperluan audit — sebelumnya
     kedua parameter itu diterima layanan tetapi tidak pernah dikirim.
* Kegagalan infrastruktur (mis. cookie gagal disetel setelah autentikasi
  sukses) tidak menambah hitungan, agar pengguna tidak dihukum atas gangguan
  di luar kendali mereka.

### Security
* Menutup temuan audit "0 rate limiting login": sebelumnya verifikasi password
  berjalan tanpa batas sehingga password dapat ditebak berulang tanpa hambatan.

### Known Limitation
* Penyimpanan in-memory per proses. Pada Vercel serverless hitungan terpisah
  per instance, jadi batas efektif ≈ batas × jumlah instance. Untuk pembatasan
  keras perlu penyimpanan bersama (Redis / tabel Prisma) — dicatat sebagai
  backlog, bukan bloker.

---

## [2026-09-30] - Security: Dependency Upgrade — Next.js 16.3.6 & SheetJS (xlsx) 0.20.3 (IMPLEMENTED / VERIFIED)

### Changed
* `package.json` / `package-lock.json`:
  * `next` **16.3.4 → 16.3.6** (perbaikan RCE **GHSA-vcvr-r3jv-pc5j** pada `next/image`).
  * `xlsx` **^0.18.5 → 0.20.3** (SheetJS Community Edition, dipasang dari tarball resmi `cdn.sheetjs.com` — rilis npm publik memang berhenti di 0.18.5):
    * menutup **CVE-2023-30533** (prototype pollution, patched di 0.19.3),
    * menutup **CVE-2024-22363** (ReDoS, patched di 0.20.2).
  * API `xlsx` (`XLSX.read` / `XLSX.utils` / `XLSX.writeFile`) tetap kompatibel → tidak ada perubahan kode parser; `src/lib/importer/parser.ts` tidak diubah.
* `tsconfig.tsbuildinfo`: artefak build ter-track ikut ter-regenerasi oleh `next build`, **tidak ikut di-commit** (dipulihkan ke versi HEAD); penanganannya dijadwalkan di task repo hygiene (gitignore + `git rm --cached`).

### Verification
* `npx tsc --noEmit` → **0 error**.
* Full regression suite (`npx tsx --test` dengan `.env` dimuat) → **384 tests / 384 pass / 0 fail** (baseline terjaga).
* `prisma validate` → valid (3 warning `onDelete: SetNull` lama, tidak berubah; skema tidak diubah → tanpa migrasi baru).
* `npm run build` → sukses (seluruh route terkompilasi, middleware aktif).
* `npm audit` → kerentanan `next` (RCE) dan `xlsx` (prototype pollution + ReDoS) **hilang**; tersisa 3 high yang semuanya dev-only toolchain (`prisma` → `@prisma/config` → `deepmerge-ts`), dijadwalkan di run berikutnya.

---

## [2026-09-28] - Milestone: Communication Automation — Cross-Domain Notification Platform & Outbox Engine (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/notification/guardian-resolver.ts`: Layanan resolusi hierarkis kontak wali murid (`resolveStudentGuardianRecipient`, `isValidIndonesianPhone`) berbasis relasi `GuardianStudent` (diurutkan `isPrimary DESC`, `createdAt ASC`) dengan fallback ke `student.parentWaPhone` dan `student.phone`, serta sanitasi nomor seluler Indonesia (`628xxx`). Penanganan anggun menjamin kegagalan kontak tidak menggagalkan transaksi bisnis.
* `src/app/api/cron/notifications/route.ts`: Endpoint Route Handler terjadwal (`GET`/`POST`) dengan otorisasi `CRON_SECRET` untuk pemrosesan antrean notifikasi outbox otomatis lintas tenant secara berkala.
* `test/communication-automation.test.ts`: Rangkaian 9 automated unit & integration tests mencakup sanitasi nomor telepon, resolusi wali bertingkat, pembuatan idempotency key deterministik & deduplikasi instan, event semantics keuangan/absensi/raport, atomic claim concurrency guard, klasifikasi permanent vs transient failure, serta penegakan isolasi tenant (9/9 PASS).

### Changed
* `src/lib/validation/notification.ts`:
  * Menambahkan `"REPORT_CARD_PUBLISHED"` pada `NOTIFICATION_TEMPLATE_KEYS`.
  * Menambahkan `idempotencyKey?: string` pada `queueNotificationInputSchema`.
  * Menjadikan tipe `QueueNotificationInput` sebagai `z.input<typeof queueNotificationInputSchema>` dengan nilai default channel `"WHATSAPP"`.
* `src/lib/notification/templates.ts`:
  * Menambahkan template pesan WhatsApp untuk `"REPORT_CARD_PUBLISHED"` (lengkap dengan nama siswa, semester, tahun ajaran, rombel, dan tautan portal wali).
  * Menyempurnakan template `"ATTENDANCE_ALERT"` untuk menyertakan nama rombel/kelas siswa.
* `src/lib/notification/events.ts`:
  * Menambahkan fungsi pembantu event `notifyReportCardPublished`.
  * Mendukung parameter `idempotencyKey` pada `notifyPaymentCompleted`, `notifyAttendanceAlert`, dan `notifyGuardianInvitation`.
* `src/lib/notification/outbox-service.ts`:
  * Implementasi ID deterministik (`generateDeterministicNotificationId`) untuk deduplikasi mutlak di level primary key tanpa perlu migrasi skema database.
  * Atomic claim dengan `updateMany` pada `processOutboxQueue` untuk mencegah *race condition* antar worker bersamaan.
  * Klasifikasi kegagalan pengiriman: *permanent error* (nomor/template/provider tidak valid) langsung `FAILED` tanpa infinite retry; *transient error* menjadwalkan ulang dengan *exponential backoff*.
* `src/lib/finance/payment-service.ts`:
  * Mengintegrasikan event `notifyPaymentCompleted` secara ketat *post-commit* setelah `prisma.$transaction` selesai dengan idempotency key `PAYMENT_RECEIPT:${payment.id}`. Rollback pembayaran dijamin tidak menghasilkan notifikasi outbox.
* `src/lib/attendance/session-service.ts`:
  * Mengintegrasikan event `notifyAttendanceAlert` pada `closeAttendanceSession` saat sesi berstatus `CLOSED`, menerbitkan peringatan terdeduplikasi `ATTENDANCE_ALERT:${record.id}` khusus santri yang tercatat `ABSENT`.
* `src/lib/formal-academic/report-card-service.ts`:
  * Mengintegrasikan event `notifyReportCardPublished` pada `publishReportCard` setelah raport dibekukan (frozen) dan berstatus `PUBLISHED`, mengarah ke portal wali `/wali/akademik/raport/${reportCard.id}`.
* `src/app/notifications/page.tsx`:
  * Memperkaya bilah filter dengan seleksi template dan channel, menampilkan metadata idempotency key dan jadwal retry, serta memastikan kepatuhan desain responsif mobile.

---

## [2026-09-28] - Milestone: Master Data Engine - Bulk Promotion Workflow (Review, Classroom Mapping, Candidate Selection, Validation Preview, Sacred History Preservation, Idempotency & Audit Log) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/academic/promotion-types.ts`: Kontrak data domain (`PromotionPreviewRow`, `PromotionPreviewSummary`, `ClassroomMapping`, `PromotionExecutionResult`, dan `PromotionValidationError`).
* `src/lib/validation/promotion.ts`: Skema validasi Zod (`previewBulkPromotionInputSchema`, `executeBulkPromotionInputSchema`, `promotionCandidateFilterSchema`) dengan penegakan tahun ajaran asal vs target berbeda dan minimal 1 rombel terpetakan.
* `src/lib/academic/promotion-service.ts`: Layanan domain promosi massal (`getPromotionCandidates`, `previewBulkPromotion`, `executeBulkPromotion`) dengan guard RBAC (`academic:manage`), isolasi tenant dari sesi (`ctx.institutionId`), transaksi atomik `prisma.$transaction`, penjagaan *Sacred History* tanpa menimpa atau menghapus enrollment lama, deteksi idempotency, dan pencatatan audit trail ke `AuditLog` (`action: "BULK_PROMOTION"`).
* `src/actions/promotion.ts`: Server Actions terautentikasi (`getPromotionCandidatesAction`, `previewBulkPromotionAction`, `executeBulkPromotionAction`).
* `src/app/students/promotions/page.tsx`: Halaman workflow kenaikan kelas 4-tahap (Setup Tahun & Pemetaan Rombel, Pemilihan Siswa Massal, Prapinjau Validasi & Konfirmasi Dialog, dan Kartu Hasil Sukses).
* `test/bulk-promotion.test.ts`: Rangkaian 13 automated tests mencakup validasi aturan input, paginasi calon siswa, deteksi konflik prapinjau (READY/WARNING/ERROR), integritas Sacred History, idempotency pencegahan duplikasi, proteksi RBAC, dan pencegahan serangan lintas tenant (13/13 PASS).

### Changed
* `src/lib/academic/index.ts`: Re-export domain types dan promotion-service.
* `src/app/students/page.tsx`: Menambahkan tombol aksi navigasi cepat "Kenaikan Kelas" menuju `/students/promotions`.
* `src/app/classrooms/page.tsx`: Menambahkan tombol aksi navigasi cepat "Kenaikan Kelas" menuju `/students/promotions`.

---


## [2026-09-24] - Milestone: Master Data Engine - Excel Importer & Auto-Sanitizer (Upload, Auto-Sanitize, Validate, Duplicate Detection, Preview, Confirm & Atomic Import) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/importer/types.ts`: Tipe dan kontrak data (`SanitizedStudentImportData`, `PreviewRow`, `ImportPreviewSummary`, `ImportPreviewResult`, `ImportExecutionResult`).
* `src/lib/importer/sanitizer.ts`: Auto-sanitizer data pendidikan Indonesia (pembersihan spasi ganda, penanganan placeholder kosong, netralisasi formula injection `'`, normalisasi float Excel untuk NIS/NISN/NIK, normalisasi format nomor HP 08/8/+628 ke kanonikal 628, normalisasi variasi jenis kelamin, parsing tanggal serial Excel dan format DD/MM/YYYY & ISO, serta normalisasi relasi wali murid).
* `src/lib/importer/parser.ts`: Parser spreadsheet multi-format (`.xlsx`, `.xls`, `.csv`) dengan auto-mapping alias header kolom bahasa Indonesia & Inggris ke canonical keys, serta generator template Excel resmi.
* `src/lib/importer/validator.ts`: Validasi terpadu Zod (`createStudentInputSchema`), deteksi duplikasi internal dalam file, deteksi *exact duplicate* (NIS terdaftar di institusi), dan deteksi *potential duplicate* (NISN sama atau Nama + Tanggal Lahir sama).
* `src/lib/importer/importer-service.ts`: Layanan domain impor dengan guard RBAC (`student:create`), isolasi tenant mutlak (`ctx.institutionId`), transaksi database atomic (`prisma.$transaction`), pembuatan otomatis entitas `Guardian` & relasi `GuardianStudent`, penempatan rombel aktif (`Enrollment`) dengan perlindungan *Sacred History*, dan pencatatan riwayat `AuditLog` (`action: "IMPORT"`).
* `src/actions/importer.ts`: Server Actions terautentikasi (`previewStudentImportAction`, `executeStudentImportAction`, `getStudentImportTemplateAction`).
* `src/components/importer/student-import-modal.tsx`: Modal interaktif impor spreadsheet responsive 4-tahap (Upload/Dropzone, Prapinjau ringkasan & tabel berfilter, Eksekusi, dan Laporan hasil impor).
* `test/master-data-importer.test.ts`: Rangkaian 17 automated tests mencakup sanitizer, parser, validator, duplicate detection, eksekusi transaksi, tenant isolation, dan proteksi RBAC (17/17 PASS).

### Changed
* `src/app/students/page.tsx`: Menambahkan tombol "Impor Excel" pada bilah aksi utama dan mengintegrasikan `StudentImportModal` dengan *real-time table revalidation*.
* `package.json`: Menambahkan pustaka spreadsheet native `xlsx` (`0.18.5`).

---

## [2026-09-24] - Milestone: Motion System & Interaction Polish (Motion Tokens, Reusable Motion Primitives, Shimmer Skeletons, Modal/Drawer Primitives, Cashier Success Micro-Animation, WCAG AA Reduced Motion) (IMPLEMENTED / VERIFIED)

### Added
* `src/components/ui/success-check.tsx`: Komponen SVG centang sukses teranimasi (`animate-checkmark`) dengan ukuran fleksibel (`sm`, `default`, `lg`) untuk konfirmasi micro-animation pada kasir pembayaran dan mutasi keuangan.
* `test/motion-system.test.ts`: Rangkaian 15 automated contract tests untuk token durasi dan easing, dukungan prefers-reduced-motion, verifikasi 0 `active:scale-95`, 0 fullscreen blocking spinner, motion primitif Skeleton shimmer, Dialog modal enter, Dropdown enter, dan alur pembayaran kasir 3-tahap.

### Changed
* `src/app/globals.css`:
  * Menambahkan semantic motion duration tokens (`--duration-instant: 75ms`, `--duration-fast: 120ms`, `--duration-standard: 180ms`, `--duration-slow: 240ms`) dan cubic-bezier easing tokens (`--ease-standard`, `--ease-enter`, `--ease-exit`) pada `@theme` Tailwind CSS v4 dan `:root`.
  * Menambahkan keyframes CSS berkinerja tinggi GPU-accelerated: `modal-enter`, `drawer-slide-up`, `dropdown-enter`, `tooltip-enter`, `fade-in`, `content-enter`, `shimmer`, `checkmark-draw`.
  * Menambahkan utility classes: `.animate-modal-enter`, `.animate-drawer-slide-up`, `.animate-dropdown-enter`, `.animate-tooltip-enter`, `.animate-fade-in`, `.animate-content-enter`, `.animate-shimmer`, `.animate-checkmark`.
  * Menambahkan global `@media (prefers-reduced-motion: reduce)` yang menetralkan seluruh transisi dan animasi menjadi `0.01ms !important`.
* `src/components/ui/skeleton.tsx`:
  * Menggantikan pulse kasar dengan subtle linear sheen `.animate-shimmer` yang tenang dan profesional.
* `src/components/ui/button.tsx`:
  * Mengadopsi transisi warna dan respon sentuh halus `transition-colors duration-150 ease-standard active:opacity-95` tanpa scaling bouncing.
* `src/components/ui/dialog.tsx`:
  * Backdrop modal kini menggunakan `.animate-fade-in` dan kontainer dialog menggunakan `.animate-modal-enter`.
* `src/components/ui/dropdown.tsx`:
  * Konten dropdown menggunakan `.animate-dropdown-enter` dan item dropdown menggunakan transisi halus `duration-150`.
* `src/components/ui/tooltip.tsx`:
  * Popover tooltip menggunakan `.animate-tooltip-enter`.
* `src/components/ui/tabs.tsx`:
  * Segmented tab trigger mengadopsi `duration-150 ease-standard active:opacity-95` dan tab content menggunakan `.animate-fade-in`.
* `src/components/app-shell.tsx`:
  * Konten halaman dibungkus dengan transisi konten halus `.animate-content-enter` berbasis rute tanpa remount shell.
  * Mobile drawer menggunakan `.animate-drawer-slide-up` dan backdrop `.animate-fade-in`.
* `src/components/global-search-dialog.tsx`:
  * Modal pencarian cepat (Ctrl+K) menggunakan `.animate-fade-in` dan `.animate-modal-enter`.
* `src/components/finance/finance-workspace-nav.tsx`:
  * Tab navigasi workspace keuangan menggunakan `transition-all duration-150 ease-standard active:opacity-95`.
* `src/app/finance/payments/page.tsx`:
  * Memperbarui alur kasir pembayaran menjadi 3 tahap terpadu: (1) Form alokasi tagihan, (2) Konfirmasi penerimaan kas, (3) Tampilan status sukses dengan checkmark micro-animation (`SuccessCheck`), ringkasan santri & nominal, serta aksi langsung cetak kwitansi.
* `src/app/finance/charges/page.tsx`:
  * Preview hasil verifikasi calon tagihan massal mengadopsi `.animate-fade-in` untuk transisi mulus.
* `src/app/finance/cashbook/page.tsx`:
  * Tombol switch jenis mutasi pengeluaran vs pemasukan mengadopsi `transition-all duration-150 ease-standard active:opacity-95`.

---

## [2026-09-23] - Milestone: Finance Workspace UX Migration (Unified Finance Workspace Layout & Navigation, Charges, Payments Cashier Counter, Cashbook BKU, Fee Categories, Reports & CSV Export) (IMPLEMENTED / VERIFIED)

### Added
* `src/components/finance/finance-workspace-nav.tsx`: Komponen navigasi workspace keuangan terpadu dengan 6 tab operasional (*Ringkasan*, *Tagihan Siswa*, *Kasir Pembayaran*, *Buku Kas (BKU)*, *Kategori Biaya*, *Laporan*), indikator status aktif berbasis `bg-teal-700`, dan target sentuh ramah jempol min 44px.
* `src/app/finance/layout.tsx`: Layout shell persisten untuk modul keuangan yang membungkus sub-rute dengan `NavHeader` dan `FinanceWorkspaceNav` guna mencegah remount layout dan header saat berpindah rute keuangan.
* `test/finance-ui-workspace.test.ts`: Rangkaian 10 pengujian kontrak otomatis untuk verifikasi integritas navigasi workspace, aturan anti-slop (0 `rounded-full`, 0 `active:scale-95`, 0 duplicate `NavHeader`, 0 old spinner), format Rupiah dan penjajaran `tabular-nums font-mono`, serta aturan keselamatan VOID.

### Changed
* `src/app/finance/page.tsx`:
  * Migrasi ke Design System: mengadopsi 5 `CardSkeleton` saat loading, membersihkan duplikasi `NavHeader` dan wrapper `bg-slate-50`, menampilkan 5 metrik kontekstual dengan format `tabular-nums font-mono`, dan kartu navigasi cepat menuju sub-modul keuangan.
* `src/app/finance/charges/page.tsx`:
  * Migrasi tabel tagihan kesiswaan ke `DataTableView` (tampilan tabular multi-kolom di desktop dan transformasi kartu *ResourceList* di ponsel).
  * Mengganti seluruh badge pill `rounded-full` menjadi `Badge` bersudut tumpul `rounded-md` dengan varian semantik (`success`, `warning`, `danger`, `info`, `neutral`).
  * Mengadopsi primitif `Dialog`, `Input`, `Select`, `Button` untuk modal Tagihan Tunggal, Tagihan Massal per rombel (dengan live candidate preview), dan modal konfirmasi VOID.
* `src/app/finance/payments/page.tsx`:
  * Migrasi kasir pembayaran: form pencarian santri pembayar, daftar tagihan tertunggak dengan opsi "Pilih Semua", input alokasi nominal rata kanan `font-mono`, dan layar konfirmasi sebelum eksekusi.
  * Modal kwitansi resmi siap cetak (`window.print()`) dan riwayat kasir berbasis `DataTableView`.
* `src/app/finance/cashbook/page.tsx`:
  * Migrasi Buku Kas Umum (BKU) dengan `DataTableView` berdensitas tinggi (compact 36px) dan reflow kartu pada ponsel.
  * Pembedaan sumber mutasi via Badge semantik: `Kasir Pembayaran` (otomatis) vs `Manual Operasional`.
  * Modal pencatatan kas manual dengan tombol pilihan jenis mutasi dan form kontrol standar UI Foundation.
* `src/app/finance/fees/page.tsx`:
  * Migrasi master kategori biaya ke `DataTableView`, status `Badge` aktif/nonaktif `rounded-md`, serta modal pembuatan dan edit kategori terpadu.
* `src/app/finance/reports/page.tsx`:
  * Migrasi tampilan 3 laporan operasional (*Rekap Pembayaran*, *Tagihan & Tunggakan*, *Arus Kas BKU*) dengan tombol tab interaktif dan filter tanggal transaksi.
  * Mempertahankan 100% fungsionalitas unduh CSV/Excel (`generatePaymentsCSV`, `generateChargesCSV`, `generateCashbookCSV`).

---

## [2026-09-23] - Milestone: UI Foundation & Persistent App Shell (Design Tokens, UI Primitives, Persistent AppShell, Mobile Navigation, Zero-CLS Skeletons, DataTableView & Dashboard Reference Implementation) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/utils.ts`: Utilitas fungsi `cn` untuk penggabungan kelas Tailwind dinamis (`clsx` + `tailwind-merge`).
* `src/components/ui/button.tsx`: Komponen tombol primitif terstandarisasi dengan 5 varian (`primary`, `secondary`, `outline`, `ghost`, `destructive`), status `isLoading`, disabled, dan target sentuh jempol minimum 44px.
* `src/components/ui/input.tsx`: Komponen input formulir aksesibel dengan label, pesan error, helper text, dan focus-visible ring.
* `src/components/ui/select.tsx`: Komponen dropdown select native dengan ikon chevron, label, dan pesan error terintegrasi.
* `src/components/ui/checkbox.tsx`: Komponen centang aksesibel dengan touch target 44px, label, dan deskripsi.
* `src/components/ui/switch.tsx`: Komponen toggle switch dengan atribut WAI-ARIA `role="switch"` dan keyboard spacebar support.
* `src/components/ui/tabs.tsx`: Komponen segmented tabs terstruktur (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) dengan WAI-ARIA `role="tablist"` dan `role="tab"`.
* `src/components/ui/card.tsx`: Komponen kartu data terpadu (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
* `src/components/ui/badge.tsx`: Komponen badge status persegi tumpul (`rounded-md`, pelarangan pill-shape `rounded-full`) dengan 6 varian semantik (`success`, `warning`, `danger`, `info`, `neutral`, `primary`).
* `src/components/ui/dialog.tsx`: Komponen modal dialog aksesibel dengan backdrop blur, penutupan via tombol Escape, dan penataan focus trap.
* `src/components/ui/dropdown.tsx`: Komponen dropdown menu dengan click-outside handler dan keyboard accessibility.
* `src/components/ui/tooltip.tsx`: Komponen tooltip ringan dengan trigger hover dan keyboard focus.
* `src/components/ui/breadcrumb.tsx`: Komponen jejak navigasi aksesibel (`<nav aria-label="Breadcrumb">`) dengan pemisah `ChevronRight`.
* `src/components/ui/pagination.tsx`: Komponen navigasi halaman terpadu dengan informasi rentang data, tombol *Sebelumnya*, dan *Berikutnya*.
* `src/components/ui/skeleton.tsx`: Komponen blok animasi pulse dasar untuk perceived performance.
* `src/components/loading/skeletons.tsx`: Pustaka skeleton loading terpadu seukuran container target (`PageSkeleton`, `TableSkeleton`, `CardSkeleton`, `ListSkeleton`, `FormSkeleton`) untuk eliminasi Cumulative Layout Shift (CLS = 0).
* `src/components/data-dense/data-table-view.tsx`: Komponen DataTableView responsif dengan tampilan tabel multi-kolom di desktop (`md:table`) dan transformasi otomatis menjadi *ResourceList* vertikal terstruktur di ponsel (`md:hidden`).
* `src/components/app-shell.tsx`: Komponen Persistent Application Shell dengan desktop topbar, navigasi 2-level terstruktur (Pusat Aktivitas Harian vs Master Data), mobile bottom bar 4-aksi + Drawer menu lengkap, serta singleton GlobalSearchDialog (Ctrl+K).
* `src/components/app-shell-wrapper.tsx`: Wrapper integrasi root layout yang mengecualikan halaman publik/landing (`/`), login (`/login`), dan portal wali (`/wali/*`) secara otomatis.
* `test/ui-foundation.test.ts`: Rangkaian 12 automated unit/contract tests mencakup pengujian utility `cn`, token semantik, invariants primitif UI (Badge rounded-md, Button 44px tanpa bounce), aturan routing AppShell, dan penjajaran tabel data-dense.

### Changed
* `src/app/globals.css`:
  * Mengonfigurasi token CSS semantik lengkap berbasis `DESIGN.md v2.0` pada `@theme` Tailwind CSS v4 (`--color-canvas`, `--color-surface`, `--color-primary`, Pine Teal `#0f766e`, `--color-foreground`, `--color-border`, status success, warning, danger, info, dan focus-visible styling).
* `src/components/nav-header.tsx`:
  * Diintegrasikan dengan `useAppShell()`. Ketika berada di dalam persistent `AppShell`, `NavHeader` menyinkronkan subtitle ke konteks shell dan merender `null` untuk mencegah terjadinya double header pada halaman eksisting.
* `src/app/layout.tsx`:
  * Membungkus seluruh aplikasi dengan `<AppShellWrapper>` untuk mengaktifkan shell persisten tanpa kedipan layar antar-rute.
* `src/app/dashboard/page.tsx`:
  * Migrasi sebagai reference implementation: mengadopsi `PageSkeleton` menggantikan spinner fullscreen, menggunakan komponen `Button`, `Badge`, `Card`, serta membersihkan kode dari warna raw dan animasi bouncing `active:scale-95`.

---

## [2026-09-23] - Milestone: NataSekolah Design System & Product UX Reset (DESIGN.md v2, Design Tokens, Navigation Contract, Data Density, A11y & Anti-Patterns) (COMPLETE / SPECIFIED)

### Added
* `DESIGN.md` (v2.0): Spesifikasi dan kontrak arsitektur antarmuka pengguna menyeluruh (24 bagian) mencakup:
  * Karakter produk: *Clean · Fresh · Calm · Fast · Organized* (Dial `ENERGY 1 / RHYTHM 2 / MOTION 1`, Anti-Slop Mode 1).
  * Palet semantik berbasis warna alam & kertas administrasi nusantara (Canvas `#fbfbfa`, Surface `#ffffff`, Brand Teal `#0f766e`, Text `#18181b`, dan status fungsional emerald, amber, blue, rose).
  * Skala tipografi Bahasa Indonesia dengan ukuran teks minimum aman bagi guru senior dan wali murid.
  * Standar radius terpadu (`rounded-sm` 4px, `rounded-md` 6px, `rounded-lg` 8px, `rounded-xl` 12px) dan pelarangan badge pill `rounded-full`.
  * Sistem navigasi persisten (*Persistent Application Shell*) dengan hierarki 2-level terinspirasi GitLab Pajamas.
  * Spesifikasi 15 komponen primitif dan komposit (Button, Input, Select, Checkbox, Switch, Tabs, Card, Table, Badge, Dialog, Dropdown, Tooltip, Toast, Breadcrumb, Pagination).
  * Standar Data-Dense UI dengan density scale (compact 36px, comfortable 48px, spacious 56px) dan reflow responsif ponsel (*ResourceList* terinspirasi Shopify Polaris).
  * Prinsip perceived performance (IBM Carbon): skeleton presisi seukuran container target, zero layout shift (CLS = 0), dan pelarangan fullscreen blocking spinner.
  * Standar aksesibilitas WCAG 2.1 AA (kontras teks 14.5:1, target sentuh min 44px, keyboard accessibility, reduced motion).
  * Pengalaman spesifik 5 peran pengguna (*Admin, Guru, Bendahara, Wali, Pimpinan*).
  * Tata kelola implementasi terstruktur tanpa mendestabilkan domain backend atau kode eksisting.

---

## [2026-09-23] - Milestone: Teacher Workspace / Academic Operations (Teacher Workspace, Class View, Student Academic Summary, Attendance & Assessment Integration, Plugin Guard) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/teaching/workspace-service.ts`: Layanan backend komprehensif untuk ruang kerja guru (`getTeacherWorkspaceSummary`, `getTeacherClassDetail`, `getTeacherStudentAcademicSummary`) dengan penegakan batasan penugasan guru, agregasi kehadiran, kalkulasi rata-rata nilai, dan perlindungan privasi siswa (0 exposure data finansial & wali).
* `src/app/teacher/page.tsx`: Halaman utama Teacher Workspace (`/teacher`) dengan greeting kontekstual guru, kartu metrik harian, daftar penugasan aktif dengan indikator presensi hari ini, serta shortcut 1-klik menuju Presensi, Penilaian, dan Rekap Kelas.
* `src/app/teacher/classes/[assignmentId]/page.tsx`: Halaman daftar dan rekap siswa per kelas (`/teacher/classes/[assignmentId]`) berbasis `Enrollment` dengan filter pencarian nama/NISN, agregasi kehadiran, rata-rata nilai, dan tautan detail siswa.
* `src/app/teacher/classes/[assignmentId]/students/[studentId]/page.tsx`: Halaman detail akademik siswa read-only (`/teacher/classes/[assignmentId]/students/[studentId]`) menyajikan tab riwayat kehadiran dan rincian nilai assessment per mapel penugasan.
* `test/teacher-workspace.test.ts`: Rangkaian 15 unit/integration test baru mencakup:
  * Workspace summary untuk guru dengan penugasan dan isolasi data guru lain.
  * Empty state jika guru belum memiliki penugasan aktif.
  * Tampilan siswa kelas berbasis `Enrollment` dan penolakan jika mengakses penugasan guru lain.
  * Ringkasan akademik siswa read-only tanpa kebocoran data finansial atau data kontak wali.
  * Integrasi presensi dengan Attendance Core dan penolakan cross-assignment.
  * Alur penilaian (assessment) dengan kepemilikan guru dan penegakan plugin `FORMAL_ACADEMIC`.
  * Isolasi tenant dan penolakan cross-tenant.

### Changed
* `src/lib/teaching/assignment-service.ts`:
  * Menambahkan parameter opsional `txPrisma?: typeof prisma` pada `assertTeacherAssignmentAccess` untuk mendukung pemanggilan mock/transaksional.
* `src/lib/teaching/index.ts`:
  * Mengekspor `workspace-service` sebagai bagian dari modul teaching.
* `src/actions/teaching.ts`:
  * Mengekspos Server Actions baru: `getTeacherWorkspaceSummaryAction`, `getTeacherClassDetailAction`, `getTeacherStudentAcademicSummaryAction`.
* `src/lib/formal-academic/assessment-service.ts`:
  * Menambahkan penegakan plugin lembaga `assertFormalAcademicPlugin(ctx, db)` pada seluruh operasi CRUD assessment (`createAssessment`, `updateAssessment`, `deleteAssessment`, `getAssessment`, `listAssessments`).
* `src/lib/formal-academic/grade-service.ts`:
  * Menambahkan penegakan plugin lembaga `assertFormalAcademicPlugin(ctx, db)` pada operasi penilaian (`getAssessmentRoster`, `recordScore`, `recordBatchScores`).
* `src/lib/attendance/session-service.ts`:
  * Menambahkan dukungan `txPrisma?: typeof prisma` pada `createAttendanceSession` untuk konsistensi pengujian transaksional.
* `src/components/nav-header.tsx`:
  * Menambahkan menu "Workspace Guru" (`/teacher`) pada bilah navigasi utama untuk peran guru dan staf terkait.
* `src/lib/operations/dashboard-service.ts` & `src/app/dashboard/page.tsx`:
  * Menambahkan quick action `Workspace Guru` (`/teacher`) dengan ikon topi toga pada dashboard operasional harian.

---

## [2026-09-23] - Milestone: Finance & Billing Operations (Fee Categories, Bulk Billing, Cashier Multi-Charge Counter, Atomic Allocations, Printable Receipts, Cashbook Immutability, Operational Reports & CSV Export) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/finance/reporting-service.ts`: Layanan laporan operasional keuangan terpadu (`getPaymentSummaryReport`, `getOutstandingSummaryReport`, `getCashflowReport`) berbasis data aktual database terisolasi tenant dan terproteksi izin `finance:view`.
* `src/lib/finance/export-utils.ts`: Modul client-safe untuk ekspor laporan keuangan ke format CSV terstandarisasi Microsoft Excel dengan penambahan UTF-8 BOM (`\uFEFF`) (`generatePaymentsCSV`, `generateChargesCSV`, `generateCashbookCSV`, `downloadCSV`).
* `src/app/finance/reports/page.tsx`: Halaman pelaporan keuangan operasional (`/finance/reports`) dengan 3 tab:
  * *Rekap Pembayaran:* Agregasi penerimaan kasir, total transaksi, rata-rata, breakdown kategori biaya & metode pembayaran, filter rentang tanggal, dan ekspor CSV.
  * *Tagihan & Tunggakan:* Agregasi piutang, status terbayar vs sisa, tagihan jatuh tempo, tabel rincian santri menunggak dengan hitungan hari keterlambatan, dan ekspor CSV.
  * *Arus Kas Operasional:* Buku kas umum, arus masuk, arus keluar, saldo bersih kas, dan ekspor CSV.
* `test/finance-operations.test.ts`: Rangkaian 15 automated integration tests komprehensif mencakup:
  * Pembuatan tagihan massal berbasis target (seluruh siswa aktif vs per kelas).
  * Pencegahan duplikasi tagihan (melewati siswa yang sudah memiliki tagihan aktif di periode/kategori yang sama).
  * Isolasi tenant mutlak pada penagihan dan pembayaran.
  * Preview siswa eligible vs sudah ditagih (`getTargetStudentsForBilling`).
  * Perhitungan ringkasan tagihan real-time (`getBillingSummary`).
  * Pembayaran kasir multi-tagihan secara atomik (`PaymentTransaction`, `PaymentAllocation`, `CashbookEntry`, `Receipt`).
  * Penolakan over-allocation, tagihan VOID, dan tagihan silang tenant.
  * Prefix nomor kwitansi kustom dan catatan kaki operasional dari konfigurasi lembaga.
  * Integritas dan immutabilitas mutasi kas pembayaran kasir serta pencatatan manual operasional.
  * Agregasi laporan pembayaran, arus kas, dan penegakan izin RBAC `finance:view`.

### Changed
* `src/lib/validation/finance.ts`:
  * Menambahkan status `OVERDUE` pada skema filter tagihan.
  * Menambahkan skema validasi `targetStudentsQuerySchema` untuk live preview pembuatan tagihan.
  * Menambahkan skema validasi `financialReportFilterSchema` untuk filter periode pelaporan.
* `src/lib/finance/charge-service.ts`:
  * Menambahkan pencegahan duplikasi tagihan pada `bulkCreateStudentCharges` dan mengembalikan metadata `{ count, skippedCount, createdForStudentIds }`.
  * Menambahkan fungsi `getTargetStudentsForBilling` untuk preview kandidat siswa dan deteksi status tagihan eksisting.
  * Menambahkan fungsi `getBillingSummary` untuk agregasi metrik tagihan total, lunas, sebagian, belum dibayar, dan jatuh tempo.
  * Memperkaya `listStudentCharges` dengan filter `status: "OVERDUE"` berbasis `dueDate < now` dan sisa tagihan $> 0$.
* `src/lib/finance/receipt-service.ts`:
  * Menambahkan pembacaan prefix nomor kwitansi kustom dari `Institution.settingsJson` (`receiptNumberPrefix`, default `KW`) pada `generateUniqueReceiptNumber`.
  * Menambahkan fungsi `getReceiptDetails` untuk mengambil data kwitansi lengkap bersama profil lembaga dan catatan kaki kwitansi (`receiptFooterNote`).
* `src/actions/finance.ts`:
  * Mengekspos Server Actions baru: `getReceiptDetailsAction`, `getTargetStudentsForBillingAction`, `getBillingSummaryAction`, `getPaymentSummaryReportAction`, `getOutstandingSummaryReportAction`, dan `getCashflowReportAction`.
* `src/app/finance/page.tsx`:
  * Mengintegrasikan metrik penagihan real-time dan buku kas ke dalam ringkasan dashboard keuangan.
  * Menambahkan kartu navigasi langsung ke `Laporan & Export Excel` (`/finance/reports`).
* `src/app/finance/charges/page.tsx`:
  * Menambahkan kartu ringkasan status operasional (Total Tagihan, Sudah Terbayar, Sebagian, Belum Dibayar, Jatuh Tempo).
  * Menambahkan modal pembuatan tagihan tunggal dan tagihan massal cerdas dengan live preview target santri.
  * Menambahkan filter status Jatuh Tempo, dialog konfirmasi pembatalan tagihan (VOID), dan tombol ekspor CSV.
* `src/app/finance/payments/page.tsx`:
  * Redesain antarmuka kasir cepat: pencarian instan siswa, daftar tagihan tertunggak, alokasi multi-tagihan otomatis/manual, dan dialog konfirmasi sebelum eksekusi pembayaran.
  * Modal cetak kwitansi instan yang ramah cetak (`@media print`) dengan kop lembaga, rincian alokasi, stempel lunas, dan catatan kaki operasional.
  * Fitur ekspor CSV histori pembayaran kasir.
* `src/app/finance/cashbook/page.tsx`:
  * Menampilkan badge sumber transaksi: kasir pembayaran (sumber otomatis `PAYMENT`, immutable) vs mutasi manual (`MANUAL`).
  * Modal pencatatan pengeluaran (EXPENSE) dan pemasukan (INCOME) operasional non-SPP.
  * Ringkasan saldo kas masuk, kas keluar, saldo bersih, dan penerimaan hari ini.
  * Fitur ekspor CSV Buku Kas Umum.

---

## [2026-09-23] - Milestone: Institution Configuration & Settings (Multi-Tenant Profile, Plugin Config, Dynamic Terminology, Operational Rules & User Management) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/settings/`: Modul domain konfigurasi dan pengaturan institusi:
  * `types.ts`: Definisi DTO profil (`InstitutionProfileData`), kamus istilah (`TerminologyDictionary`), aturan operasional (`OperationalSettings`, `OperationalAttendanceSettings`, `OperationalFinanceSettings`, `OperationalCommunicationSettings`, `OperationalAcademicSettings`), konfigurasi terurai (`ParsedInstitutionSettings`), dan entitas pengguna (`ManagedUser`, `ASSIGNABLE_ROLES`, `Role`).
  * `validation.ts`: Skema validasi Zod dengan sanitasi ketat untuk profil lembaga (`institutionProfileSchema`), kamus istilah (`terminologySchema`), aturan operasional (`operationalSettingsSchema`), mutasi peran (`updateUserRolesSchema`), dan status akun (`toggleUserActiveSchema`).
  * `terminology.ts`: Kamus preset bawaan (`DEFAULT_SEKOLAH_TERMINOLOGY`, `DEFAULT_PESANTREN_TERMINOLOGY`, `DEFAULT_RUMAH_TAHFIDZ_TERMINOLOGY`, `DEFAULT_PKBM_TERMINOLOGY`) dan helper resolusi kamus terpadu `resolveInstitutionTerminology`.
  * `institution-service.ts`: Layanan baca/tulis profil, terminologi, dan aturan operasional terisolasi tenant dengan penegakan izin `institution:manage` dan pemanfaatan `settingsJson` zero-migration.
  * `user-service.ts`: Layanan manajemen staf internal lembaga (`listManagedUsers`, `updateUserRoles`, `toggleUserActiveStatus`) dengan proteksi anti-tampering role, isolasi tenant, dan proteksi dari penonaktifan diri sendiri.
* `src/actions/settings.ts`: Server Actions terproteksi konteks tenant dan RBAC untuk seluruh mutasi profil, plugin, terminologi, operasional, dan staf.
* `src/app/settings/`: Halaman dan antarmuka pengaturan terpadu:
  * `layout.tsx`: Layout pengaturan dengan sub-navigasi tab responsif (Lembaga, Plugin, Terminologi, Operasional, Pengguna & Akses) berstandar WCAG AA dan target sentuh $\ge 44\text{px}$.
  * `page.tsx`: Pusat Pengaturan (`/settings`) dengan kartu ikhtisar status masing-masing modul.
  * `institution/page.tsx`: Form profil lembaga (nama, alamat, telepon, logo, email, website) dengan slug terproteksi read-only.
  * `plugins/page.tsx`: Halaman kontrol aktivasi plugin domain dengan pesan peringatan keamanan data historis.
  * `terminology/page.tsx`: Editor terminologi dinamis dengan preset kultural (Sekolah, Pesantren, Rumah Tahfidz, PKBM) dan live preview kontekstual.
  * `operations/page.tsx`: Konfigurasi parameter operasional (toleransi presensi, format kwitansi keuangan, perilaku notifikasi WA, dan KKM akademik).
  * `users/page.tsx`: Antarmuka manajemen pengguna internal lembaga, dialog edit multi-role, dan modal konfirmasi status akun.
* `test/institution-settings.test.ts`: Rangkaian 17 automated tests komprehensif mencakup isolasi tenant profil, penegakan izin `institution:manage` dan `staff:manage`, toggling plugin aman tanpa kehilangan data, preset & fallback terminologi dinamis, validasi Zod operasional, dan pencegahan eskalasi role staf.

### Changed
* `src/components/nav-header.tsx`: Menambahkan tautan menu `Pengaturan` (`/settings`) pada bilah navigasi utama.
* `03_EXECUTION/PROGRESS.md`: Memperbarui matriks gerbang pengembangan dengan status COMPLETE untuk Milestone Pengaturan Institusi (273 tests PASS).

---

## [2026-09-23] - Milestone: Operational Admin Experience / Daily Operations (Operational Command Center, Perlu Perhatian, RBAC Quick Actions & Global Search) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/operations/`: Modul domain pusat komando operasional harian:
  * `types.ts`: Definisi tipe data dashboard (`OperationalDashboardData`, `OperationalDashboardStats`), item perhatian (`OperationalAttentionItem`, `AttentionCategory`, `AttentionSeverity`), aksi cepat (`QuickActionItem`), dan hasil pencarian global (`GlobalSearchResultItem`, `SearchEntityType`).
  * `dashboard-service.ts`: Layanan agregasi statistik hari ini (siswa aktif, presensi hari ini dibuka vs ditutup, rekap kehadiran, arus kas pembayaran, tagihan jatuh tempo, asesmen akademik, mutaba'ah tahfidz, santri asrama, dan outbox WA) serta deteksi anomali operasional untuk bagian "Perlu Perhatian".
  * `search-service.ts`: Layanan pencarian cepat multi-entitas (Siswa, NIS, NISN, Rombel, Guru/Staf, dan Wali Murid) terisolasi tenant dan terfilter izin RBAC.
* `src/actions/operations.ts`: Server Actions terproteksi sesi otentikasi untuk `getOperationalDashboardAction` dan `searchGlobalAction`.
* `src/components/global-search-dialog.tsx`: Komponen dialog pencarian global responsif dengan pintasan keyboard (`Ctrl+K` / `Cmd+K`, Arrow Up/Down, Enter), penanganan status pemuatan, dan navigasi instan ke entitas target.
* `src/app/dashboard/page.tsx`: Halaman Operational Command Center (`/dashboard`) terpadu menyajikan 4 seksi: Metrik Hari Ini, Perlu Perhatian Operasional, Aksi Cepat Terotorisasi, dan Status Plugin Lembaga.
* `test/operations-dashboard.test.ts`: Rangkaian 11 automated tests mencakup isolasi tenant dashboard, isolasi izin RBAC guru vs bendahara, pemfilteran quick action sesuai role, penegakan plugin lembaga, agregasi item perhatian, dan isolasi tenant pada pencarian global.

### Changed
* `src/lib/auth/navigation.ts`: Memperbarui `DEFAULT_AUTHENTICATED_PATH` menjadi `/dashboard` agar staf internal langsung diarahkan ke Pusat Komando Operasional setelah masuk.
* `src/components/nav-header.tsx`: Menambahkan tautan navigasi ke `/dashboard`, tombol pencarian cepat dengan badge `Ctrl K`, pintasan keyboard global, dan tautan logo yang mengarah ke dashboard.
* `src/app/page.tsx`: Menambahkan tombol "Dashboard Operasional" pada header beranda utama.
* `test/auth-navigation.test.ts`: Memperbarui ekspektasi rute default post-login ke `/dashboard`.
* `03_EXECUTION/PROGRESS.md`: Memperbarui progres milestone menjadi COMPLETE (256/256 tests PASS, 33 rute terkompilasi).

---

## [2026-09-23] - Phase 7: Parent Experience / Portal Wali (PWA Mobile-First, ReBAC Read Model, Frozen Report & Multi-Child) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/guardian/`: Modul domain portal wali murid terpadu:
  * `types.ts`: DTO untuk profil wali (`GuardianProfileData`), anak terhubung (`GuardianLinkedStudent`), ringkasan kehadiran (`GuardianAttendanceSummary`), ringkasan keuangan (`GuardianFinanceSummary`), ringkasan akademik (`GuardianAcademicSummary`), ringkasan tahfidz (`GuardianTahfidzSummary`), ringkasan asrama (`GuardianDormitorySummary`), dan notifikasi (`GuardianNotificationItem`).
  * `auth-helper.ts`: Helper resolusi sesi wali murid `getAuthenticatedGuardianSession()` dari HTTP-only cookie dengan validasi status akun aktif dan penolakan keras sesi staf internal atau unauthenticated.
  * `portal-service.ts`: Layanan baca domain (Read-Only) khusus wali murid dengan penegakan ReBAC (`assertGuardianStudentAccess`) di setiap query:
    * `getGuardianProfile`: Profil wali dan daftar santri binaan.
    * `getGuardianChildren`: Daftar santri binaan.
    * `getGuardianStudentOverview`: Rekap agregat santri aktif untuk dasbor wali.
    * `getGuardianStudentAttendance`: Riwayat dan persentase presensi akademik & asrama.
    * `getGuardianStudentFinance`: Tagihan, sisa kewajiban, riwayat pembayaran, dan bukti kwitansi resmi (Read-Only).
    * `getGuardianStudentAcademic`: Nilai penilaian terpublikasi dan daftar raport resmi (`status: "PUBLISHED"` saja).
    * `getGuardianStudentReportCard`: Pembongkaran snapshot `frozenData` raport terbit (menolak keras raport `DRAFT`).
    * `getGuardianStudentTahfidz`: Capaian ayat ziyadah & muraja'ah beserta riwayat setoran.
    * `getGuardianStudentDormitory`: Informasi penempatan kamar asrama, kapasitas, dan presensi malam santri mukim.
    * `getGuardianNotifications`: Log riwayat pesan WhatsApp outbox resmi yang dikirim ke nomor HP wali.
* `src/actions/guardian.ts`: Server Actions untuk aktivasi akun wali (`activateGuardianAction`) dan keluar sistem (`logoutGuardianAction`).
* `src/app/manifest.ts` & `public/manifest.json`: Web App Manifest PWA native Next.js untuk Portal Wali (nama: "NataSekolah - Portal Wali Murid", display: "standalone", theme_color: "#0f766e").
* `src/components/guardian-nav.tsx`: Komponen navigasi terpadu wali murid (Top Bar dengan logo & pemilih santri aktif instan, Mobile Sticky Bottom Bar dengan target sentuh $\ge 44\text{px}$, dan Mobile Drawer Menu).
* Antarmuka Pengguna Mobile-First (`/wali/*`):
  * `src/app/wali/(portal)/layout.tsx`: Layout pelindung portal wali terisolasi dari halaman aktivasi publik.
  * `src/app/wali/(portal)/page.tsx`: Dasbor utama wali murid menyajikan 6 kartu domain terpadu + empty states.
  * `src/app/wali/(portal)/kehadiran/page.tsx`: Riwayat presensi, persentase kehadiran, dan filter konteks kelas vs asrama.
  * `src/app/wali/(portal)/keuangan/page.tsx`: Rincian SPP/tagihan, status lunas/cicilan/nunggak, dan bukti kwitansi.
  * `src/app/wali/(portal)/akademik/page.tsx`: Rekap nilai penilaian dan direktori buku raport resmi.
  * `src/app/wali/(portal)/akademik/raport/[reportId]/page.tsx`: Halaman pratinjau raport resmi berbasis frozen snapshot abadi yang ramah cetak (`window.print()`).
  * `src/app/wali/(portal)/tahfidz/page.tsx`: Riwayat setoran mutaba'ah Al-Qur'an (surah, ayat, kualitas, catatan musyrif).
  * `src/app/wali/(portal)/asrama/page.tsx`: Informasi kamar asrama, kapasitas, dan presensi malam santri mukim (empty state santri non-mukim).
  * `src/app/wali/(portal)/notifikasi/page.tsx`: Log pesan notifikasi WhatsApp outbox resmi yang ditujukan ke wali.
  * `src/app/wali/aktivasi/page.tsx`: Halaman aktivasi akun wali murid via tautan atau token undangan 1x pakai.
* `test/guardian-portal.test.ts`: Rangkaian 16 automated tests mencakup resolusi profil & anak terhubung, penolakan akses santri milik orang lain, penolakan cross-tenant, isolasi total dari RBAC staf internal, proteksi mutlak penyembunyian raport DRAFT, pembacaan frozen snapshot raport PUBLISHED, query terisolasi untuk kehadiran, keuangan, tahfidz, dan asrama, serta validasi form aktivasi akun.

### Changed
* `src/app/login/page.tsx`: Menambahkan tautan ramah pengguna menuju halaman aktivasi portal wali murid.
* `03_EXECUTION/PROGRESS.md`: Memperbarui status Phase 7 Parent Experience menjadi COMPLETE (16/16 test baru lulus, total 245/245 tests lulus).

---

## [2026-09-23] - Phase 6: Pesantren & Tahfidz Living Core (Diniyah, Mutaba'ah, Asrama & Living Attendance) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/tahfidz/`: Modul domain mutaba'ah tahfidz santri terpadu:
  * `types.ts`: Konstanta jenis setoran (`SETORAN`, `MURAJAAH`), predikat kualitas (`MUMTAZ`, `JAYYID`, `MAQBUL`, `REPEAT`), dan kelas galat domain (`TahfidzDomainError`, `TahfidzRecordNotFoundError`, `InvalidAyahRangeError`, `InvalidSurahError`, `StudentEnrollmentMismatchError`).
  * `quran.ts`: Metadata 114 surah Al-Qur'an (nama, nomor, jumlah ayat) dan validasi matematis rentang ayat (`startAyah >= 1`, `endAyah >= startAyah`, `endAyah <= totalAyahs`).
  * `tahfidz-service.ts`: Layanan pencatatan mutaba'ah (`createTahfidzRecord`, `getTahfidzRecordById`, `listTahfidzRecords`, `getTahfidzSummary`) dengan pengikatan mutlak ke `Student` dan `Enrollment` historis serta ekstraksi `recordedBy` dari sesi server.
  * `index.ts`: Barrel export terpadu modul tahfidz.
* `src/lib/dormitory/`: Modul domain manajemen asrama santri:
  * `types.ts`: Konstanta status penempatan kamar (`ACTIVE`, `ENDED`) dan kelas galat domain (`DormitoryDomainError`, `DormitoryNotFoundError`, `DormitoryRoomNotFoundError`, `DormitoryRoomCapacityExceededError`, `ActiveDormitoryAssignmentExistsError`, `DormitoryAssignmentNotFoundError`, `DormitoryDuplicateNameError`, `DormitoryRoomDuplicateNameError`).
  * `dormitory-service.ts`: Manajemen gedung asrama (`createDormitory`, `getDormitoryById`, `listDormitories`), manajemen kamar (`createDormitoryRoom`, `getDormitoryRoomById`), penempatan kamar santri (`assignStudentToRoom`) dengan validasi kapasitas kamar dan larangan penempatan ganda aktif, pengakhiran penempatan (`endDormitoryAssignment`), dan riwayat penempatan (`listDormitoryAssignments`).
  * `index.ts`: Barrel export terpadu modul asrama.
* `src/lib/validation/tahfidz.ts`: Skema validasi Zod untuk mutaba'ah tahfidz (`createTahfidzRecordInputSchema`, `tahfidzRecordFilterSchema`).
* `src/lib/validation/dormitory.ts`: Skema validasi Zod untuk gedung, kamar, dan penempatan asrama (`createDormitoryInputSchema`, `createDormitoryRoomInputSchema`, `assignStudentToRoomInputSchema`, `endDormitoryAssignmentInputSchema`, `dormitoryAssignmentFilterSchema`).
* `src/actions/tahfidz.ts`: 4 Server Actions terpadu untuk mutaba'ah tahfidz berotorisasi RBAC (`tahfidz:view`, `tahfidz:manage`).
* `src/actions/dormitory.ts`: 8 Server Actions terpadu untuk asrama dan kamar berotorisasi RBAC (`dormitory:view`, `dormitory:manage`).
* Antarmuka Pengguna Mobile-First (`/tahfidz/*`, `/dormitories/*`):
  * `src/app/tahfidz/page.tsx`: Direktori santri mutaba'ah & feed aktivitas setoran terkini.
  * `src/app/tahfidz/[studentId]/page.tsx`: Detail riwayat hafalan santri, kartu ringkasan ziyadah/muraja'ah, dan formulir setoran baru dengan validasi surah & ayat Al-Qur'an.
  * `src/app/dormitories/page.tsx`: Direktori gedung asrama, indikator persentase keterisian kamar, serta modal tambah gedung dan kamar.
  * `src/app/dormitories/[id]/page.tsx`: Roster kamar, daftar penghuni aktif per kamar, modal penempatan santri baru, tombol akhiri penempatan, dan tombol "Buka Absensi Asrama".
* `test/tahfidz.test.ts`: Rangkaian 9 automated tests mencakup pembuatan setoran dan muraja'ah valid, penolakan rentang ayat salah (`startAyah < 1`, `endAyah < startAyah`, `endAyah > totalAyahs`), penolakan surah di luar 1..114, penolakan mismatch santri-enrollment, isolasi tenant, penegakan identitas perekam dari sesi server, penegakan izin RBAC, integritas historis enrollment saat santri naik kelas, dan penghitungan ringkasan tahfidz.
* `test/pesantren-living.test.ts`: Rangkaian 17 automated tests mencakup integrasi kategori mata pelajaran kepesantrenan, pembuatan gedung dan kamar asrama, penolakan duplikasi nama, penegakan batas kapasitas kamar, penolakan penempatan aktif ganda untuk santri yang sama, pengakhiran penempatan dengan pelestarian rekam jejak historis, penolakan santri lintas tenant, pembukaan sesi absensi asrama (`context: "LIVING"`), penolakan pembukaan sesi ganda kamar pada hari yang sama, penurunan roster khusus penghuni kamar aktif, pencatatan presensi granular (`PRESENT`, `SICK`, `EXCUSED`, `ABSENT`), penolakan santri luar kamar, dan penolakan penutupan sesi yang belum lengkap.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-016 (Pesantren & Tahfidz Living Core, Mutaba'ah Enrollment Integrity, and Single Attendance Engine).

### Changed
* `prisma/schema.prisma`:
  * Model `Institution`: Menambahkan relasi `tahfidzRecords`, `dormitories`, `dormitoryRooms`, `dormitoryAssignments`.
  * Model `User`: Menambahkan relasi `recordedTahfidz`.
  * Model `Student`: Menambahkan relasi `tahfidzRecords`, `dormitoryAssignments`.
  * Model `Enrollment`: Menambahkan relasi `tahfidzRecords`.
  * Model `AttendanceSession`: Menambahkan kolom `context String @default("ACADEMIC")`, `dormitoryRoomId String?`, relasi `dormitoryRoom DormitoryRoom?`, dan constraint `@@unique([dormitoryRoomId, attendanceDate])`.
  * Menambahkan model `TahfidzRecord`, `Dormitory`, `DormitoryRoom`, dan `StudentDormitoryAssignment` dengan compound unique keys `@@unique([id, institutionId])` dan compound foreign keys `[institutionId]`.
* `src/lib/auth/permissions.ts`: Menambahkan izin `tahfidz:view`, `tahfidz:manage`, `dormitory:view`, `dormitory:manage` ke dalam daftar `PERMISSIONS` dan memetakan ke peran `SUPER_ADMIN`, `FOUNDATION_HEAD`, `PRINCIPAL`, `ADMIN`, dan `TEACHER`.
* `src/lib/teaching/types.ts`: Memperluas `SUBJECT_CATEGORIES` dengan `DINIAH`, `KITAB`, `TAHSIN`, `TAJWID`, `AKHLAQ`, `FIQIH`, `AQIDAH`, `HADITS`, `LAINNYA`.
* `src/lib/attendance/session-service.ts`: Menambahkan `createLivingAttendanceSession` dan memperbarui `closeAttendanceSession` untuk memvalidasi kelengkapan absen penghuni kamar aktif ketika `context === "LIVING"`.
* `src/lib/attendance/record-service.ts`: Memperbarui `getAttendanceRoster`, `markAttendance`, dan `markAttendanceBatch` untuk mendukung sesi asrama secara dinamis.
* `src/components/nav-header.tsx`: Menambahkan tautan navigasi ke `/tahfidz` ("Tahfidz") dengan ikon `BookMarked` dan `/dormitories` ("Asrama") dengan ikon `Home`.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan model Phase 6 ke Matriks Entitas dan Bab 10 Keputusan Integritas Pesantren & Tahfidz Living.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Menambahkan Bab 10 Pesantren & Tahfidz Living Core.
* `01_ARCHITECTURE/SECURITY.md`: Menambahkan Bab 13 Keamanan Pesantren, Tahfidz Mutaba'ah & Asrama Living.
* `03_EXECUTION/PROGRESS.md`: Memperbarui status Phase 6 Pesantren & Tahfidz Living Core menjadi COMPLETE (26/26 test baru lulus, total 229/229 tests lulus).
* `03_EXECUTION/TODO.md`: Memperbarui checklist Phase 6 menjadi selesai.

---

## [2026-09-23] - Phase 5: Formal Academic Core (Assessment, AssessmentScore, Grade Calculation, Frozen Report Card) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/formal-academic/`: Modul domain core akademik formal terpadu:
  * `types.ts`: Konstanta jenis asesmen (`DAILY`, `QUIZ`, `MIDTERM`, `FINAL`, `PROJECT`, `OTHER`), status raport (`DRAFT`, `PUBLISHED`), predikat nilai (A, B, C, D), dan kelas galat domain (`FormalAcademicDomainError`, `AssessmentNotFoundError`, `AssessmentOwnershipError`, `InvalidScoreRangeError`, `InvalidEnrollmentScopeError`, `DuplicateScoreError`, `ReportCardNotFoundError`, `ReportCardAlreadyPublishedError`).
  * `assessment-service.ts`: Manajemen instrumen asesmen pembelajaran (`createAssessment`, `updateAssessment`, `deleteAssessment`, `listAssessments`, `getAssessmentById`) dengan penegakan kepemilikan guru atas penugasan ajar miliknya (`teacherAssignment.teacherId === session.userId`) dan isolasi tenant.
  * `grade-service.ts`: Manajemen penilaian siswa (`getRosterForAssessment`, `saveAssessmentScore`, `batchSaveAssessmentScores`, `getScoresByAssessment`) dengan validasi `0 <= score <= maxScore`, penurunan roster siswa berbasis `Enrollment` aktif rombel dan tahun ajaran asesmen, serta penyimpanan atomis via `$transaction`.
  * `calculation-service.ts`: Abstraksi penghitungan nilai akhir mata pelajaran berbasis antarmuka `IGradeCalculationStrategy`, normalisasi bobot nilai 0–100, penghitungan predikat (A: >= 85, B: >= 70, C: >= 55, D: < 55) dan deskripsi capaian pembelajaran.
  * `report-card-service.ts`: Manajemen dokumen raport siswa (`generateDraftReportCard`, `getReportCardById`, `listReportCards`, `publishReportCard`) dengan implementasi **Frozen Historical Snapshot**: raport yang berstatus `PUBLISHED` menyimpan seluruh capaian nilai dalam field `frozenData` (JSON) dan menolak perubahan data nilai di masa mendatang secara mutlak.
  * `index.ts`: Barrel export terpadu modul formal academic.
* `src/lib/validation/formal-academic.ts`: Skema validasi Zod terpusat untuk `createAssessmentInputSchema`, `updateAssessmentInputSchema`, `saveAssessmentScoreInputSchema`, `batchSaveAssessmentScoresInputSchema`, `generateDraftReportCardInputSchema`, dan `publishReportCardInputSchema`. Diekspor via `src/lib/validation/index.ts`.
* `src/actions/formal-academic.ts`: 13 Server Actions terpadu dengan otorisasi RBAC (`academic:view`, `academic:manage`, `report:view`, `report:manage`) dan penegakan *teacher resource-level scope*.
* Antarmuka Pengguna Mobile-First (`/assessments`, `/grades`, `/reports`):
  * `src/app/assessments/page.tsx`: Direktori instrumen asesmen pembelajaran dengan filter jenis dan status publikasi, modal pembuatan asesmen baru, serta indikator kepemilikan guru.
  * `src/app/assessments/[id]/page.tsx`: Lembar kerja input nilai massal siswa (batch roster grading table) per penugasan ajar dengan validasi batas nilai realtime, autosave baris, dan tombol simpan massal transaksi atomis.
  * `src/app/grades/page.tsx`: Rekapitulasi nilai dan capaian per siswa per mata pelajaran dengan predikat capaian.
  * `src/app/reports/page.tsx`: Manajemen raport siswa, generator draf raport, pratinjau raport resmi format cetak, dan tombol "Terbitkan & Bekukan (Publish & Freeze)".
* `test/formal-academic.test.ts`: Rangkaian 13 automated tests mencakup pembuatan asesmen, verifikasi teacher assignment scope, penolakan akses guru lain, isolasi tenant lintas lembaga, validasi batas nilai (`score < 0` dan `score > maxScore`), penolakan enrollment luar rombel dan luar tahun ajaran, batch score atomic save, penghitungan nilai akhir mata pelajaran, pembuatan draft raport, penerbitan raport menjadi frozen snapshot, serta bukti ketidakberubahan (immutability) snapshot saat nilai asesmen diubah di kemudian hari.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-015 (Formal Academic Core, Assessment Scoring and Frozen Report Card Snapshot).

### Changed
* `prisma/schema.prisma`:
  * Model `Institution`: Menambahkan relasi `assessments`, `assessmentScores`, `reportCards`, `reportCardSubjects`.
  * Model `User`: Menambahkan relasi `createdAssessments`, `publishedReportCards`.
  * Model `Student`: Menambahkan relasi `assessmentScores`, `reportCards`.
  * Model `Enrollment`: Menambahkan relasi `assessmentScores`, `reportCards`.
  * Model `AcademicYear`: Menambahkan relasi `assessments`, `reportCards`.
  * Model `Classroom`: Menambahkan relasi `assessments`, `reportCards`.
  * Model `Subject`: Menambahkan relasi `assessments`, `reportCardSubjects`.
  * Model `TeacherAssignment`: Menambahkan relasi `assessments`.
  * Menambahkan model `Assessment`, `AssessmentScore`, `ReportCard`, dan `ReportCardSubject` dengan compound unique keys `@@unique([id, institutionId])` dan compound foreign keys `[institutionId]`.
* `src/components/nav-header.tsx`: Menambahkan tautan navigasi ke `/assessments` ("Penilaian") dengan ikon `FileCheck2` dan `/reports` ("Raport") dengan ikon `Award`.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan model Assessment, AssessmentScore, ReportCard, ReportCardSubject ke Matriks Entitas dan Bab 9 Keputusan Integritas Asesmen & Raport Terbekukan.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Menambahkan Bab 9 Formal Academic Core & Diagram Relasi Asesmen ke Raport Terbekukan.
* `03_EXECUTION/PROGRESS.md`: Memperbarui status Phase 5 Formal Academic Core menjadi COMPLETE (13/13 test lulus, total 203/203 tests lulus).
* `03_EXECUTION/TODO.md`: Memperbarui checklist Phase 5 menjadi selesai.

---

## [2026-09-23] - Phase 4: Finance Core (FeeCategory, StudentCharge, PaymentTransaction, PaymentAllocation, CashbookEntry, Receipt) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/finance/`: Modul domain core keuangan sekolah/pesantren terpadu:
  * `types.ts`: Konstanta frekuensi iuran (`ONE_TIME`, `MONTHLY`, `ANNUAL`, `CUSTOM`), status tagihan (`UNPAID`, `PARTIAL`, `PAID`, `VOID`), jenis pembayaran (`CASH`, `TRANSFER`, `OTHER`), jenis BKU (`INCOME`, `EXPENSE`), dan kelas galat domain (`FinanceDomainError`, `FeeCategoryNotFoundError`, `FeeCategoryCodeExistsError`, `StudentChargeNotFoundError`, `ChargeAlreadyVoidError`, `PaymentTransactionNotFoundError`, `InvalidPaymentAllocationError`, `InsufficientPaymentAmountError`).
  * `fee-category-service.ts`: Manajemen katalog tarif master biaya lembaga (`createFeeCategory`, `updateFeeCategory`, `listFeeCategories`, `getFeeCategory`).
  * `charge-service.ts`: Manajemen tagihan kewajiban siswa (`createStudentCharge`, `bulkCreateStudentCharges`, `listStudentCharges`, `getStudentCharge`, `voidStudentCharge`, `calculateStudentFinancialSummary`) dengan pembekuan nominal *historical snapshot*.
  * `cashbook-service.ts`: Manajemen Buku Kas Umum (`createCashbookEntry`, `listCashbookEntries`, `getCashbookSummary`).
  * `receipt-service.ts`: Generator nomor urut atomis (`KW-YYYYMM-XXXXXX`, `TRX-YYYYMM-XXXXXX`, `CSH-YYYYMM-XXXXXX`) dan kwitansi penerimaan pembayaran (`getReceiptByPayment`, `listReceipts`).
  * `payment-service.ts`: Orchestrator penerimaan pembayaran atomis Prisma (`$transaction`) yang memproses penerimaan kas, alokasi multi-tagihan, update status `UNPAID` -> `PARTIAL` -> `PAID`, pembuatan kas masuk `INCOME`, dan penerbitan `Receipt`.
  * `index.ts`: Barrel export terpadu modul finance.
* `src/lib/validation/finance.ts`: Skema validasi Zod untuk FeeCategory, StudentCharge, BulkCharge, PaymentTransaction, PaymentAllocation, CashbookEntry, dan Receipt queries.
* `src/actions/finance.ts`: 18 Server Actions terpadu untuk keuangan dengan otorisasi RBAC (`finance:view`, `finance:manage`).
* Antarmuka Pengguna Mobile-First (`/finance/*`):
  * `src/app/finance/page.tsx`: Dashboard Keuangan (ringkasan total tagihan, terbayar, sisa tagihan, penerimaan hari ini, saldo BKU).
  * `src/app/finance/fees/page.tsx`: Master katalog jenis biaya & modal tambah/edit.
  * `src/app/finance/charges/page.tsx`: Direktori tagihan siswa, status pembayaran, & modal buat tagihan single/bulk.
  * `src/app/finance/payments/page.tsx`: Antarmuka kasir pembayaran, alokasi otomatis multi-tagihan, & modal kwitansi resmi printable.
  * `src/app/finance/cashbook/page.tsx`: Buku Kas Umum (BKU) penerimaan & pengeluaran kas.
* `test/finance-core.test.ts`: Rangkaian 7 test suite menguji snapshot nominal tagihan, alokasi atomis, penolakan over-allocation, perlindungan tagihan VOID, pembentukan otomatis BKU & kwitansi, dan isolasi tenant.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-014 (Financial Historical Data Integrity and Dynamic Calculated Balances).

### Changed
* `prisma/schema.prisma`:
  * Model `Institution`: Menambahkan relasi `feeCategories`, `studentCharges`, `paymentTransactions`, `paymentAllocations`, `cashbookEntries`, `receipts`.
  * Model `User`: Menambahkan relasi `createdCashbookEntries`, `issuedReceipts`, `receivedPayments`.
  * Model `Student`: Menambahkan relasi `studentCharges`, `paymentTransactions`.
  * Model `AcademicYear`: Menambahkan relasi `studentCharges`.
  * Menambahkan model `FeeCategory`, `StudentCharge`, `PaymentTransaction`, `PaymentAllocation`, `CashbookEntry`, dan `Receipt` dengan compound unique keys `@@unique([paymentTransactionId, institutionId])`.
* `src/components/nav-header.tsx`: Menambahkan tautan navigasi ke `/finance` ("Keuangan") dengan ikon `CreditCard`.

---

## [2026-09-20] - Phase 3: Attendance Core (AttendanceSession, AttendanceRecord, Sacred Enrollment, Immutability) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/attendance/`: Modul domain presensi dan absensi harian terpadu:
  * `types.ts`: Konstanta status sesi (`OPEN`, `CLOSED`), konstanta status kehadiran (`PRESENT`, `EXCUSED`, `SICK`, `ABSENT`), label Bahasa Indonesia (`HADIR`, `IZIN`, `SAKIT`, `ALPA`), helper normalisasi tanggal UTC midnight (`normalizeAttendanceDate`, `formatAttendanceDate`), dan kelas galat domain (`AttendanceDomainError`, `AttendanceSessionAlreadyExistsError`, `AttendanceSessionClosedError`, `AttendanceRecordAlreadyExistsError`, `AttendanceIncompleteError`, `AttendanceAccessDeniedError`, `InvalidAttendanceContextError`).
  * `session-service.ts`: Manajemen sesi absensi harian guru (`createAttendanceSession`, `getAttendanceSession`, `listAttendanceSessions`, `closeAttendanceSession`) dengan penegakan 1 sesi per penugasan per hari kalender akademik dan immutability saat ditutup.
  * `record-service.ts`: Manajemen pencatatan kehadiran (`getAttendanceRoster`, `markAttendance`, `markAttendanceBatch`, `getAttendanceRecords`) dengan penurunan roster eksklusif dari pendaftaran aktif siswa pada `Enrollment`.
  * `index.ts`: Central barrel export modul attendance.
* `src/lib/validation/attendance.ts`: Skema validasi Zod untuk pembukaan sesi absensi (`createAttendanceSessionInputSchema`), pencatatan kehadiran siswa (`markAttendanceInputSchema`), pencatatan massal rombel (`markAttendanceBatchInputSchema`), penutupan sesi (`closeAttendanceSessionInputSchema`), dan query filter histori absensi (`attendanceQuerySchema`). Diekspor via `src/lib/validation/index.ts`.
* `src/actions/attendance.ts`: Server Actions terpadu untuk absensi harian guru, pemeriksaan status sesi hari ini, pembukaan sesi, pengisian presensi cepat, absensi massal rombel, dan penutupan sesi dengan verifikasi kelengkapan 100%.
* Antarmuka Pengguna Mobile-First:
  * `src/app/attendance/page.tsx`: Halaman presensi harian guru, navigasi tanggal, kartu jadwal mengajar dengan badge status, tampilan pengisian roster absensi interaktif, tombol aksi cepat "Tandai Semua Hadir", input catatan izin/sakit, modal konfirmasi penutupan sesi permanen.
  * `src/app/attendance/history/page.tsx`: Halaman histori sesi absensi lampau, filter status sesi dan rentang tanggal, modal rincian presensi per rombel.
* `test/attendance-core.test.ts`: Rangkaian 21 automated tests mencakup pembuatan sesi, penolakan sesi duplikat pada tanggal yang sama, teacher resource scope, isolasi tenant, penurunan roster dari enrollment, penolakan siswa luar rombel/tahun ajaran, pencatatan single/batch, penolakan penutupan sesi jika belum lengkap, immutability mutlak sesi CLOSED, dan audit histori absensi.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-013 (Attendance Historical Integrity via Enrollment and Immutability of Closed Sessions).

### Changed
* `prisma/schema.prisma`:
  * Model `Institution`: Menambahkan relasi `attendanceSessions AttendanceSession[]` dan `attendanceRecords AttendanceRecord[]`.
  * Model `TeacherAssignment`: Menambahkan relasi `attendanceSessions AttendanceSession[]`.
  * Model `Student`: Menambahkan relasi `attendanceRecords AttendanceRecord[]`.
  * Model `Enrollment`: Menambahkan relasi `attendanceRecords AttendanceRecord[]`.
  * Menambahkan model `AttendanceSession` (`id`, `institutionId`, `teacherAssignmentId`, `attendanceDate`, `status`, `openedAt`, `closedAt`, `createdAt`, `updatedAt`, `@@unique([id, institutionId])`, `@@unique([teacherAssignmentId, attendanceDate])`).
  * Menambahkan model `AttendanceRecord` (`id`, `institutionId`, `attendanceSessionId`, `studentId`, `enrollmentId`, `status`, `note?`, `markedAt`, `createdAt`, `updatedAt`, `@@unique([id, institutionId])`, `@@unique([attendanceSessionId, studentId])`).
* `src/components/nav-header.tsx`: Menambahkan tautan navigasi ke `/attendance` ("Absensi") dengan ikon `ClipboardCheck`.
* `01_ARCHITECTURE/ARCHITECTURE.md`: Menambahkan Bab 7 Arsitektur Presensi & Immutability Sesi.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan model AttendanceSession & AttendanceRecord serta Bab 7 Keputusan Integritas Presensi & Absensi.
* `01_ARCHITECTURE/SECURITY.md`: Menambahkan Bab 11 Keamanan Presensi, Batasan Guru & Immutability Sesi.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Menambahkan Bab 7 Attendance Core & Historical Derivation Diagram.

---

## [2026-09-20] - Phase 2: Academic Teaching Core (Subject, Teacher & Teaching Assignment) (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/teaching/`: Modul domain pengajaran dan penugasan guru lengkap:
  * `types.ts`: Konstanta kategori mata pelajaran (`UMUM`, `AGAMA`, `MULOK`, `PEMINATAN`) dan kelas galat domain (`TeachingDomainError`, `DuplicateSubjectCodeError`, `DuplicateAssignmentError`, `TeacherAssignmentAccessDeniedError`, `InvalidTeacherRoleError`, `ResourceNotFoundError`).
  * `subject-service.ts`: Manajemen katalog mata pelajaran (`createSubject`, `updateSubject`, `listSubjects`, `getSubject`) dengan keunikan kode per tenant.
  * `teacher-service.ts`: Direktori tenaga pendidik berbasis model `User` internal dengan peran `TEACHER` (`listTeachers`, `getTeacher`) dengan penyembunyian field sensitif.
  * `assignment-service.ts`: Manajemen matriks kuartet penugasan mengajar (`createTeacherAssignment`, `updateTeacherAssignment`, `deleteTeacherAssignment`, `listTeacherAssignments`, `getTeacherAssignments`, `assertTeacherAssignmentAccess`).
  * `index.ts`: Barrel export terpadu modul teaching.
* `src/lib/validation/teaching.ts`: Skema validasi Zod untuk pembuatan/pembaruan subjek kurikulum, filter pencarian mapel, pembuatan/pembaruan penugasan mengajar, dan filter matriks penugasan. Diekspor via `src/lib/validation/index.ts`.
* `src/actions/teaching.ts`: Server Actions terpadu untuk mata pelajaran, guru, dan penugasan mengajar dengan rantai otorisasi ketat.
* Antarmuka Pengguna Mobile-First:
  * `src/app/subjects/page.tsx`: Halaman katalog mata pelajaran, pencarian realtime, filter status aktif, modal tambah/edit mapel, empty/loading/error states.
  * `src/app/teachers/page.tsx`: Halaman direktori guru lembaga, status akun, jumlah rombel ajar yang diampu.
  * `src/app/teacher-assignments/page.tsx`: Halaman matriks penugasan mengajar guru, filter kuartet (Tahun Ajaran, Guru, Mapel, Rombel), modal penugasan dengan sinkronisasi rombel berbasis tahun ajaran, aksi pembatalan penugasan.
* `test/teaching-core.test.ts`: Rangkaian 29 automated tests untuk Subject CRUD & keunikan kode per tenant, Teacher query & penyembunyian password hash, TeacherAssignment invariant & penolakan cross-tenant/mismatch tahun ajaran, preservasi histori penugasan, serta pembatasan resource scope guru.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-012 (Teacher Teaching Assignment and Teaching Scope Architecture).

### Changed
* `prisma/schema.prisma`:
  * Model `Institution`: Menambahkan relasi `subjects Subject[]` dan `teacherAssignments TeacherAssignment[]`.
  * Model `User`: Menambahkan compound unique `@@unique([id, institutionId])` dan relasi `teacherAssignments TeacherAssignment[]`.
  * Model `AcademicYear`: Menambahkan relasi `teacherAssignments TeacherAssignment[]`.
  * Model `Classroom`: Menambahkan relasi `teacherAssignments TeacherAssignment[]`.
  * Menambahkan model `Subject` (`code?`, `name`, `shortName?`, `category?`, `isActive`, `@@unique([id, institutionId])`, `@@unique([institutionId, code])`).
  * Menambahkan model `TeacherAssignment` dengan compound foreign keys PostgreSQL ke `User`, `Subject`, `AcademicYear`, dan `Classroom` (`[classroomId, academicYearId, institutionId]`).
* `src/components/nav-header.tsx`: Memperluas navigasi header dengan tautan ke `/subjects` (Mata Pelajaran), `/teachers` (Direktori Guru), dan `/teacher-assignments` (Penugasan).
* `src/app/page.tsx`: Menambahkan tautan cepat ke modul Phase 2 pada navigasi landing page.
* `01_ARCHITECTURE/ARCHITECTURE.md`: Menambahkan Bab 6 Arsitektur Pengajaran Akademik & Penugasan Guru.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan model Subject & TeacherAssignment ke Matriks Entitas dan Bab 6 Integritas Penugasan Ajar.
* `01_ARCHITECTURE/SECURITY.md`: Menambahkan Bab 10 Keamanan Pengajaran & Resource Scope Penugasan Guru.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Menambahkan Bab 6 Academic Teaching Core & Diagram Hubungan Kuartet Ajar.

---

## [2026-09-20] - Phase 1: Buku Induk & Academic Core (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/academic/`: Modul domain kesiswaan dan struktur akademik lengkap:
  * `types.ts`: Konstanta typed domain (`STUDENT_STATUSES`, `ENROLLMENT_STATUSES`, `GENDERS`) dan kelas galat domain (`DuplicateNisError`, `DuplicateEnrollmentError`, `AcademicYearMismatchError`, `ResourceNotFoundError`).
  * `student-service.ts`: Manajemen Buku Induk kesiswaan (`createStudent`, `updateStudent`, `getStudent`, `listStudents`, `archiveStudent`).
  * `academic-year-service.ts`: Manajemen tahun ajaran (`createAcademicYear`, `setActiveAcademicYear`, `listAcademicYears`, `getAcademicYear`) dengan penegakan *single active year invariant*.
  * `classroom-service.ts`: Manajemen rombongan belajar (`createClassroom`, `listClassrooms`, `getClassroom`).
  * `enrollment-service.ts`: Sacred History penempatan rombel (`enrollStudent`, `updateEnrollment`, `getStudentEnrollments`, `getCurrentEnrollment`).
* `src/lib/validation/academic.ts`: Skema validasi Zod untuk Tahun Ajaran, Rombel, dan Enrollment.
* `src/actions/academic.ts`: Server Actions terpadu untuk kesiswaan dan struktur akademik dengan rantai otorisasi 6-tingkat: UI -> Server Action -> Zod -> Session -> Tenant -> RBAC -> Domain Service -> Prisma.
* Antarmuka Pengguna Mobile-First:
  * `src/app/students/page.tsx`: Halaman daftar Buku Induk siswa, pencarian multi-kriteria (Nama/NIS/NISN), filter status, paginasi, modal pendaftaran siswa, empty state, loading state, error state.
  * `src/app/students/[id]/page.tsx`: Profil detail Buku Induk, banner rombel tahun aktif, riwayat penempatan kelas multi-tahun (Sacred History timeline), modal enrollment ke rombel baru, modal pengubahan status/arsip.
  * `src/app/academic-years/page.tsx`: Halaman manajemen tahun ajaran, badge tahun aktif, aksi aktivasi instan, modal pembuatan tahun ajaran.
  * `src/app/classrooms/page.tsx`: Halaman manajemen rombongan belajar, filter tahun ajaran, kapasitas, jumlah siswa terdaftar, modal penambahan rombel.
  * `src/components/nav-header.tsx`: Komponen header navigasi antar-modul akademik dengan touch target $\ge 44$px.
* `test/academic-core.test.ts`: Rangkaian 21 automated tests untuk master Buku Induk, keunikan NIS per institusi, invariant single active year, relasi rombel, penolakan mismatch tahun ajaran pada enrollment, penolakan enrollment lintas-lembaga (cross-tenant), dan preservasi riwayat penempatan kelas (Sacred History).
* `02_DECISIONS/ADR.md`: Menambahkan ADR-011 (Sacred History Enrollment Engine and Independent Student Master Data).

### Changed
* `prisma/schema.prisma`:
  * Model `Student`: Model identitas kesiswaan mandiri tanpa kolom `classroomId`. Menambahkan `nis` (`@@unique([institutionId, nis])`), status enum typed constants (`ACTIVE`, `INACTIVE`, `GRADUATED`, `TRANSFERRED`, `ALUMNI`), `nik`, `birthPlace`, `birthDate`, `religion`, `address`, `phone`, `email`.
  * Model `AcademicYear`: Menggunakan `isActive Boolean @default(false)` dan compound unique `@@unique([id, institutionId])`.
  * Model `Classroom`: Menggunakan compound unique `@@unique([id, institutionId])`, `@@unique([id, academicYearId, institutionId])`, dan compound FK ke `AcademicYear`.
  * Model `Enrollment`: Menambahkan compound foreign keys relasional ke `Student`, `AcademicYear`, dan `Classroom` menggunakan `[..., institutionId]` dan `[classroomId, academicYearId, institutionId]`.
* `src/lib/validation/student.ts`: Memperluas skema validasi kesiswaan dan filter pencarian siswa.
* `01_ARCHITECTURE/ARCHITECTURE.md`: Menambahkan Bab 5 Master Data Engine & Academic Core Pipeline.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan Bab 5 Prinsip Integritas Kesiswaan dan Compound Relational Keys.
* `01_ARCHITECTURE/SECURITY.md`: Menambahkan Bab 9 Keamanan Kesiswaan, Pertahanan Cross-Tenant Enrollment, dan Anti-Collusion NIS.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Menambahkan Bab 5 Master Data Engine & Sacred History Enrollment.

---

## [2026-09-20] - Phase 0.3: Input Validation & Domain Plugin Registry (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/validation/`: Modul validasi sentral berbasis Zod (`common.ts`, `auth.ts`, `guardian.ts`, `student.ts`, `index.ts`) mencakup skema primitive, login authentication, profil wali, relasi siswa-wali, dan kesiswaan inti.
* `src/lib/plugins/`: Modul registri domain plugins (`registry.ts`, `guard.ts`, `service.ts`, `index.ts`) yang memisahkan fitur Core (selalu aktif) dari toggleable domain plugins (`FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM`).
* `src/lib/plugins/guard.ts`: Penjaga modul domain `requirePlugin()` dan galat terstandarisasi `DomainFeatureDisabledError` (403 Forbidden).
* `test/validation-plugins.test.ts`: Rangkaian 22 automated tests untuk skema validasi Zod, pembersihan field keamanan klien, registri metadata plugin, konfigurasi plugin per institusi, dan rantai otorisasi 5 tingkat.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-010 (Input Validation Boundary with Zod and Toggleable Domain Plugin Registry).

### Changed
* `src/lib/tenant/guard.ts`: Pengerasan `sanitizeClientInput()` untuk secara aktif membuang atribut keamanan sensitif tambahan: `userId` dan `guardianId`.
* `01_ARCHITECTURE/ARCHITECTURE.md`: Menambahkan Bab 4 Arsitektur Validasi Input & Domain Plugin Registry.
* `01_ARCHITECTURE/DATABASE.md`: Menambahkan Bab 4 Konfigurasi Plugin Domain pada `Institution.enabledPlugins`.
* `01_ARCHITECTURE/SECURITY.md`: Menambahkan Bab 8 Rantai Otorisasi 5 Tingkat: Zod -> Session -> Tenant -> RBAC -> Plugin -> Domain.
* `01_ARCHITECTURE/DOMAIN-MODEL.md`: Pembaruan Bab 4 Unified Core vs Toggleable Domain Plugins.

---

## [2026-09-20] - Phase 0.2: Fine-Grained RBAC for Internal Users (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/auth/permissions.ts`: Standarisasi 6 peran resmi (`SUPER_ADMIN`, `FOUNDATION_HEAD`, `PRINCIPAL`, `ADMIN`, `TEACHER`, `FINANCE_STAFF`), daftar izin granular 10 domain, dan matriks tunggal sumber kebenaran `ROLE_PERMISSIONS`.
* `src/lib/auth/permissions.ts`: API otorisasi server-side granular terpadu: `hasPermission(session, permission)`, `requirePermission(session, permission)`, `hasRole(session, role)`, dan `requireRole(session, role)`.
* `src/lib/tenant/guard.ts`: Pengerasan `sanitizeClientInput()` untuk secara aktif membuang atribut `role`, `roles`, `permissions`, dan `isSuperAdmin` kiriman klien.
* `test/rbac-fine-grained.test.ts`: Rangkaian 24 automated unit & security tests mencakup validasi peran, semantic matrix check, negative matrix tests, penolakan mutlak sesi GUARDIAN dari RBAC staf, preservasi tenant boundary, anti-tampering, teacher assignment conceptual separation, dan SUPER_ADMIN platform checks.
* `02_DECISIONS/ADR.md`: Menambahkan ADR-009 (Fine-Grained Role-Based Access Control for Internal Users).

---

## [2026-09-20] - Phase 0.1A: Identity & Access Model (HARDENED & VERIFIED)

### Added
* `src/lib/auth/domain.ts`: Konstanta typed domain (`SESSION_SUBJECT_TYPES`, `GUARDIAN_RELATIONSHIPS`, `GUARDIAN_STATUSES`, `INVITATION_STATUSES`) dan runtime validation guards.
* `src/lib/auth/guardian.ts`: Domain service manajemen profil wali murid (`createGuardian`, `linkGuardianStudent`, `createGuardianInvitation`, `activateGuardian`).
* `src/lib/auth/guardian-guard.ts`: Penjaga otorisasi relasional ReBAC (`assertGuardianStudentAccess`) dengan ekstraksi identitas murni dari server session.
* `test/identity-access.test.ts`: Rangkaian 24 automated tests untuk invariant sesi polimorfik, integritas tenant, kebijakan nomor WhatsApp keluarga, ReBAC siswa, dan siklus hidup undangan sekali-pakai.
* Model `Guardian`, `GuardianStudent`, `GuardianInvitation` di `prisma/schema.prisma` dengan compound foreign keys `[guardianId, institutionId]` dan `[studentId, institutionId]`.

---

## [2026-09-20] - Phase 0.1: Authentication & Session Foundation (IMPLEMENTED / VERIFIED)

### Added
* `src/lib/auth/password.ts`: Utilitas hashing dan verifikasi kata sandi via `bcryptjs` (cost factor 12).
* `src/lib/auth/session.ts`: Manajemen token sesi acak 256-bit dengan hashing SHA-256 di basis data, masa kedaluwarsa 7 hari, dan mekanisme pencabutan (*revocation*).
* `src/lib/auth/cookie.ts`: Penanganan cookie aman (`HttpOnly; Secure; SameSite=Lax; Path=/`) tanpa menyimpan objek pengguna di browser.
* `src/lib/auth/service.ts`: Pemisahan tanggung jawab otentikasi (`authenticateCredentials`, `createSession`, `validateSessionToken`, `revokeSession`, `getAuthenticatedTenantContext`).
