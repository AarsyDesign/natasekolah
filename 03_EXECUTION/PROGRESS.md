# Progress & Development Log - NataSekolah

## 2026-10-02 - Phase 8.4 Fair-Use Enforcement UI: SELESAI
* **Temuan:** commit `eea9b7e` sudah memasang badge quota + cooldown, tetapi item ke-3 (history job) belum ada di UI — `usageHistory` dan `listAIGenerationJobsAction` ter-fetch namun tidak pernah dirender (dead state/import).
* **Ditambahkan:** Blok 2b "Riwayat Generate AI" di `/exams/question-bank` — 5 job terakhir dengan badge status (Draf/Siap Direview/Tersimpan/Dibuang/Gagal), nama mapel, waktu (id-ID), `provider/model`, pesan error bila ada, plus total generate 30 hari terakhir dari `usageHistory`. Data di-refresh via `loadFairUse()` saat mount dan setelah review job (save/discard).
* **Dokumentasi:** TODO 8.4 & ROADMAP 8.4 ditandai selesai; PROGRESS & CHANGELOG diupdate.
* **Verifikasi:** `npx tsc --noEmit` **0** · `npm test` **473/473 pass, 0 fail** · `npm run build` **exit 0** (halaman `/exams/question-bank` prerender tanpa error).
* **Catatan:** UI riwayat ini belum lewat QA E2E eksploratif — termasuk cakupan Phase 8.5.

## 2026-10-01 - Phase 7 Question Bank: SELESAI (Tahap 0-8, Gate Phase 7 lulus)
* **Tahap 0-1:** Schema Prisma + migrasi manual Question/QuestionOption (2 model, compound FK, index, enum). Verifikasi `prisma migrate diff` nihil, `migrate resolve --applied` untuk drift lama → status exit 0.
* **Tahap 2-6:** Backend penuh — Zod strict + invariant superRefine (PG 4 opsi/1 kunci, SHORT_ANSWER wajib kunci, ESSAY tanpa opsi), domain service (CRUD + siklus DRAFT→ACTIVE→ARCHIVED + hapus lunak, resource scope guru via `academic:manage`, AuditLog), kategori agregat, importer (preview VALID/ERROR + deteksi kunci ganda + template xlsx/csv), exporter CSV 16 kolom, 15 server action (semua async), RBAC `exam:view`/`exam:manage` di 6 peran + peta legacy.
* **Tahap 7:** UI mobile-first `/exams/question-bank` (metric bar, filter debounce, tabel/ResourceList, pagination, empty/loading/error) + `/[id]` (edit, transisi status, arsip konfirmasi) + modal impor 4 langkah + nav "Bank Soal" (nav-header + app-shell). QA E2E eksploratif: create soal PG sukses (toast + row + metrik Draf=1), detail page OK, 390px tanpa overflow.
* **BUG kritis (E2E):** nested `options.create` kirim `institutionId` (FK compound) → `Unknown argument` → create/impor gagal di DB nyata. Test mock (45 kasus) lolos padahal bug nyata. Fix: hapus field dari nested create (2 titik). Pelajaran dicatat ke LOG.
* **Verifikasi akhir:** `npx tsc --noEmit` 0 · `npm test` 464/464 · `npm run build` exit 0 · DoD Strict semua terpenuhi.

## 2026-10-01 - Phase 7 Trek C: AI Generator Infrastructure SELESAI
* **Model & Migrasi:** `AiGenerationUsage` (quota harian per guru, unique institution+user+date) + `AiGenerationJob` (async job queue DRAFT→READY_FOR_REVIEW→SAVED/DISCARDED/FAILED, relasi Institution/User/Subject). Migrasi manual `20261001080000_ai_generation_infrastructure` diterapkan via custom script (FK casing fix untuk PostgreSQL).
* **Plugin Registry:** `AI_GENERATION` plugin (coreDependencies: `exam`, category: `AI_AUTOMATION`) — opt-in per institusi.
* **Env Vars:** `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_DAILY_QUOTA_PER_TEACHER=30`, `AI_COOLDOWN_MS=15000`, `AI_GENERATION_ENABLED=false` (default off).
* **Services:** `usage-service.ts` (check quota + cooldown, record usage), `ai-generation-service.ts` (create job → execute → validate → review → save to Question Bank, fair-use guard 30/hari + cooldown 15s, provider-agnostic scaffold).
* **Validation:** `src/lib/validation/ai-generation.ts` (Zod schemas untuk prompt params, job create/execute/review, provider enum, status enum).
* **Cron Monitoring:** `project-completion-monitor` setiap 4 jam (0 */4 * * *) — cek tsc, test 473/473, build, prisma validate, AI infra files, Question Bank files, notifikasi completion otomatis.
* **Verifikasi:** `npx tsc --noEmit` 0 · `npm test` **473/473** (baseline 412 → +61) · `npm run build` exit 0 · `prisma validate` valid · push ke `origin/staging` (`f3e6c06`).
* **Status:** Infrastructure SIAP — tinggal pasang API key provider AI (OpenAI/Anthropic/Gemini/lokal) & implementasi adapter runtime + UI generate modal.

## 2026-10-01 - Phase 8 — AI Provider Adapters (Runtime) SELESAI
* **Provider Interface:** `src/lib/ai-providers/provider.interface.ts` (mirip pola WhatsApp provider abstraction).
* **OpenAI Provider:** `openai.provider.ts` (function calling / structured output JSON, model: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo).
* **Anthropic Provider:** `anthropic.provider.ts` (Claude JSON mode, model: claude-3.5-sonnet/haiku/opus, claude-3-sonnet/haiku).
* **Google Gemini Provider:** `gemini.provider.ts` (Google AI Studio, model: gemini-1.5-pro/flash, gemini-1.0-pro).
* **Local Provider:** `local.provider.ts` (Ollama/vLLM/OpenAI-compatible endpoints, auto-detect OpenAI-compatible / Ollama native, `listModels()` support).
* **Provider Factory:** `provider-factory.ts` (factory pattern, caching, fallback support, `callAIProviderWithFallback`).
* **Integration:** `ai-generation-service.ts` memanggil provider nyata via `getAIProvider()` (mock `callAIProvider` diganti implementasi nyata).
* **Types Update:** `AI_PROVIDERS` ditambah `'local'` di `types.ts` dan `validation/ai-generation.ts`.
* **Verifikasi:** `npx tsc --noEmit` 0 · `npm test` **473/473** · `npm run build` exit 0 · `prisma validate` valid.
* **Sisa Phase 8:** Server Actions AI Generator (8.2), UI Generate Modal (8.3), Fair-Use Enforcement UI (8.4), QA E2E (8.5), Verification Gate (8.6).

## 2026-10-01 - Phase 7 Question Bank: Tahap 7 (UI) selesai + BUG kritis diperbaiki
* UI `/exams/question-bank` (+`/[id]`), modal impor 4 langkah, form soal, nav
  "Bank Soal" — empty/loading/error state, mobile 390px tanpa overflow (QA E2E
  via browser, screenshot bukti).
* **BUG kritis terbukti hanya lewat QA E2E:** nested `options.create` kirim
  `institutionId` (bagian FK compound) → Prisma tolak `Unknown argument` → create
  soal/impor gagal di DB nyata, padahal **45 test lolos** karena suite pakai mock
  Prisma in-memory. Fix: buang field dari nested create (2 titik). Catatan di LOG:
  write path wajib dibuktikan E2E, bukan hanya test mock.
* Verifikasi: tsc 0, **464/464**, create soal sukses end-to-end (toast + row +
  Draf=1), detail page + transisi status OK. Sisa: Tahap 8 (dokumentasi gate).

## 2026-10-01 - Phase 7 Question Bank: Tahap 2-6 selesai (backend lengkap)
* Zod + domain service (invariant soal, resource scope guru, AuditLog) + kategori
  + importer/exporter + 15 server action `async`. RBAC `exam:view`/`exam:manage`
  di 6 peran + peta legacy.
* Verifikasi independen Mizan: tsc 0, **464/464**, `/login` 200, diff bersih
  (schema/migrasi/.github tak tersentuh). Sisa: Tahap 7 (UI `/exams/question-bank`)
  & Tahap 8 (dokumentasi gate).

## 2026-10-01 - Skill anti-slop repo (6 file) + format laporan profesional
* **Rujukan mati diperbaiki:** `antislop.md` + 5 `skills/antislop-*` yang dirujuk
  `AGENTS.md`/`GEMINI.md` (18 sebutan) tidak pernah ada - kini dibuat dari materi
  asli `DESIGN.md`; semua rujuran hidup. tsc 0, `412/412`.
* **Skill Hermes `professional-report`** dibuat: template laporan (tugas/server/
  insiden/jawaban singkat) + filter anti-slop, dipakai untuk laporan chat Arsyad.

> **Unified Education Management Platform**  
> Mengikuti Master PRD v5.0, Panduan Visual `DESIGN.md`, dan Filter Anti-Slop Mode 1 (DURING).

---

## 1. Matriks Gerbang Pengembangan (Development Gate Matrix)

| Fase | Modul & Cakupan | Status | Tanggal Rilis / Verifikasi |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Multi-Tenancy & Foundation** | **COMPLETE** | 2026-09-20 |
| | - Bagian 1.1: Visi Produk & Single Source of Truth | Selesai (Verified) | 2026-09-20 |
| | - Tenant Security Boundary & AsyncLocalStorage Context | Selesai (10 Tests Pass) | 2026-09-20 |
| | - Prisma Schema Blueprint (Institution, User, Session, Academic, Student) | Selesai (Prisma Valid) | 2026-09-20 |
| | - Phase 0.1: Authentication & Session Foundation | Selesai (IMPLEMENTED / VERIFIED, 31 Tests Pass) | 2026-09-20 |
| | - Phase 0.1A: Identity & Access Model (Guardian ReBAC, Unified Session) | Selesai (HARDENED & VERIFIED, 59 Tests Pass) | 2026-09-20 |
| | - Phase 0.2: Fine-Grained RBAC for Internal Users | Selesai (IMPLEMENTED & VERIFIED, 83 Tests Pass) | 2026-09-20 |
| | - Phase 0.3: Input Validation & Domain Plugin Registry | Selesai (IMPLEMENTED & VERIFIED, 105 Tests Pass) | 2026-09-20 |
| **Phase 1** | **Buku Induk & Academic Core** (Student Master, AcademicYear, Classroom, Sacred History Enrollment) | **COMPLETE** | 2026-09-20 (126 Tests Pass) |
| **Phase 2** | **Academic Teaching Core** (Subject, Teacher Identity, TeacherAssignment, Teaching Scope) | **COMPLETE** | 2026-09-20 (155 Tests Pass) |
| **Phase 3** | **Attendance Core** (AttendanceSession, AttendanceRecord, Sacred Enrollment Integration, Immutability) | **COMPLETE** | 2026-09-20 (176 Tests Pass) |
| **Phase 4** | **Finance Core** (FeeCategory, StudentCharge, PaymentTransaction, PaymentAllocation, CashbookEntry, Receipt) | **COMPLETE** | 2026-09-23 (190 Tests Pass) |
| **Phase 5** | **Formal Academic Core** (Assessment, AssessmentScore, Grade Calculation, Frozen Report Card) | **COMPLETE** | 2026-09-23 (203 Tests Pass) |
| **Phase 6** | **Pesantren & Tahfidz Living Core** (Diniyah/Kitab, Tahfidz Mutaba'ah, Asrama & Living Attendance) | **COMPLETE** | 2026-09-23 (229 Tests Pass) |
| **Phase 7** | **Parent Experience** (PWA Wali Murid, Transparansi Rekap Tagihan) | **COMPLETE** | 2026-09-23 (245 Tests Pass) |
| **Milestone** | **Operational Admin Experience / Daily Operations** (Command Center, Perlu Perhatian, RBAC Quick Actions & Global Search) | **COMPLETE** | 2026-09-23 (256 Tests Pass) |
| **Milestone** | **Institution Configuration & Settings** (Profile, Plugins, Dynamic Terminology, Operational Rules, User Management) | **COMPLETE** | 2026-09-23 (273 Tests Pass) |
| **Milestone** | **Finance & Billing Operations** (Fee Categories, Bulk Billing with Duplicate Prevention, Cashier Multi-Charge Counter, Atomic Allocations, Printable Receipts, Cashbook Immutability, Operational Reports & CSV Export) | **COMPLETE** | 2026-09-23 (288 Tests Pass) |
| **Milestone** | **Teacher Workspace / Academic Operations** (Teacher Workspace `/teacher`, Class View `/teacher/classes/[id]`, Student Academic Summary, Attendance & Assessment Integration, Plugin Guard) | **COMPLETE** | 2026-09-23 (303 Tests Pass) |
| **Milestone** | **NataSekolah Design System & Product UX Reset** (DESIGN.md v2, Design Tokens, Navigation Contract, Data Density, A11y & Anti-Patterns) | **COMPLETE** | 2026-09-23 (303 Tests Pass) |
| **Milestone** | **UI Foundation & Persistent App Shell** (Design Tokens, 15 Primitives, Persistent AppShell, Mobile Nav, Loading Skeletons, DataTableView, Dashboard Reference) | **COMPLETE** | 2026-09-23 (315 Tests Pass) |
| **Milestone** | **Finance Workspace UX Migration** (Unified Workspace Navigation, Charges, Payments & Cashier Counter, Cashbook BKU, Fee Categories, Reports & CSV, Design Tokens, Anti-Slop Mode 1) | **COMPLETE** | 2026-09-23 (325 Tests Pass) |
| **Milestone** | **Motion System & Interaction Polish** (Motion Tokens, Micro-Interactions, Shimmer Skeletons, Modal/Drawer Primitives, Cashier Success Micro-Animation, WCAG AA Reduced Motion) | **COMPLETE** | 2026-09-24 (340 Tests Pass) |
| **Milestone** | **Master Data Engine — Excel Importer & Auto-Sanitizer** (Upload, Auto-Sanitize, Validate, Duplicate Detection, Preview, Confirm & Atomic Import) | **COMPLETE** | 2026-09-24 (17 Tests Pass) |
| **Milestone** | **Master Data Engine — Bulk Promotion Workflow** (Kenaikan Kelas Massal, Review, Validation, Mapping, Sacred History, Idempotency & Audit Log) | **COMPLETE** | 2026-09-28 (13 Tests Pass) |
| **Milestone** | **Communication Automation** (Cross-Domain Notification Outbox, Deterministic Idempotency, Guardian Precedence Resolution, Worker Atomic Claim & Exponential Backoff, Admin Workspace) | **COMPLETE** | 2026-09-28 (14 Tests Pass) |

| **Phase 8** | **AI & Automation** (Bank Soal 3-Tier, AI Generator dengan Fair Use) | Belum Dimulai | - |

---

## 2. Catatan Log Aktivitas Kronologis

### [2026-10-01] - Login E2E tanpa password + 2 fix QA (VERIFIED)
* **Teknik QA baru:** sesi dibuat via `createSession()` (skrip lokal
  `scripts/_local-mint.ts`, di-`.git/info/exclude`) → cookie dipasang via CDP.
  Password TIDAK PERNAH ditangani — terbukti bisa dogfood penuh.
* **Hasil:** modal Tambah Pengguna sukses dari ujung ke ujung; RBAC benar di
  kedua sisi (ADMIN ditolak & tombol disembunyikan, SUPER_ADMIN lolos).
* **Temuan & fix:** tombol tampil tanpa izin (kini ikut `canManage`), banner
  error kembar (kini disembunyikan saat modal terbuka).
* **Pitfall fixture:** `test/master-data-importer.test.ts` memakai ID institusi
  tetap `inst_importer_test_a/b` dan menghapus SEMUA user di sana tiap run —
  akun QA sempat hilang; solusi: akun QA dibuat di institusi terpisah
  (`qa-lokal-terpisah`).


### [2026-10-01] - QA browser pertama: rate limit UI + fix 500 (VERIFIED)
* **Dogfood `/login`:** form lengkap (autocomplete benar, required), login salah
  4× dapat pesan generik tanpa enumerasi akun, percobaan ke-5 kena throttle —
  rate limit terbukti jalan di UI, bukan cuma di test.
* **Bug ditemukan QA:** pesan throttle "599 detik" (mentah, tidak manusiawi) →
  diganti "9 menit 59 detik" via `formatDurasi`.
* **Regresi selama perbaikan:** ekspor sync di `"use server"` file membuat dev
  server 500 total (tsc & test TIDAK menangkap — kaidah khusus transformasi
  Next 16) → helper dipindah ke `src/lib/auth/rate-limit.ts`; 14 file action
  lain diaudit bersih. Bukti screenshot: `cache/scratch/qa/login-throttle-format.png`.


### [2026-10-01] - Fix keamanan dependensi: audit 0 (VERIFIED)
* **Temuan:** 3 advisory high — `deepmerge-ts@7.1.5` di rantai
  `prisma → @prisma/config`. Catatan lama bilang "butuh prisma major 8" — TERNYATA
  TIDAK: `npm audit fix` memang klaim fix tapi dry-run "up to date" (rentang pin),
  sedangkan **override `deepmerge-ts ^8.0.2`** langsung beres tanpa menyentuh prisma.
* **Risiko diuji sungguhan** sebelum dinyatakan aman: v8 dual-format (tetap bisa
  `require`), `@prisma/config` hanya pakai ekspor `deepmerge`, lalu dijalankan
  `prisma validate/generate/migrate status/migrate diff` — semua jalan,
  `migrate diff` tetap "No difference detected".
* **Hasil:** `npm audit` 0 (total & prod), 410/410, tsc 0, build hijau.


### [2026-10-01] - Fitur: Tambah Pengguna Staf/Guru (IMPLEMENTED & VERIFIED)
* **Temuan lanjutan gap akun:** `src/` juga nol `user.create` — ada halaman
  `/settings/users` (list/ubah-peran/nonaktifkan) tapi TIDAK ADA cara membuat
  akun staf/guru dari aplikasi; selama ini akun hanya bisa lahir dari skrip
  bootstrap, dan `staff:manage` hanya dimiliki SUPER_ADMIN + FOUNDATION_HEAD
  (ADMIN cuma `staff:view` — fakta yang ditemukan saat menulis test eskalasi).
* **Implementasi:** `createManagedUser` (tenant dari sesi, skema `.strict()`
  menolak `institutionId` klien, anti-escalation, email ganda, bcrypt) +
  `createManagedUserAction` + modal form di `/settings/users` dengan validasi
  ringan klien dan error banner di dalam modal.
* **Verifikasi:** `test/user-management.test.ts` 8/8 — termasuk bukti akun baru
  **benar-benar bisa login** dan lembaga lain tidak melihatnya; full suite
  **410/410**; `tsc` 0; `npm run build` exit 0.

### [2026-10-01] - Critical: Bootstrap Akun (IMPLEMENTED & VERIFIED)
* **Temuan:** aplikasi **tidak punya jalur pembuatan akun sama sekali** — nol
  `institution.create` / `user.create` di `src/`, `hashPassword` tidak pernah
  dipanggil, tidak ada onboarding maupun seed. Pada DB kosong mustahil login.
* **Perbaikan:** `npm run seed` (`scripts/seed-core.ts` + `scripts/seed.ts`) —
  membuat lembaga + akun `SUPER_ADMIN`; idempoten; validasi Zod (password ≥12
  karakter, slug ketat); kata sandi hanya dari env, tidak pernah argv/cetak;
  run ulang tidak menimpa akun lama.
* **Verifikasi:** `tsc --noEmit` **0 error** · `npm test` **402/402**
  (395 + 7 test baru yang membuktikan akun hasil seed **bisa login** lewat jalur
  autentikasi resmi + sesi tervalidasi) · CLI diuji nyata: run 1 "dibuat baru",
  run 2 "sudah ada", output bebas kata sandi/email, tanpa-env exit 1.
* **Sisa (belum):** belum ada cara membuat staf/guru **dari dalam aplikasi**
  (`user.create` tetap nol di `src/`) — pembuatan user lewat UI/RBAC jadi task
  berikutnya. Status task ini: **PARTIALLY COMPLETE** untuk sisi "penambahan
  akun dari aplikasi"; bootstrap itu sendiri DONE.

### [2026-10-01] - Integritas FK + Kebersihan Repo & Konfigurasi (IMPLEMENTED & VERIFIED)
* **3 warning Prisma `onDelete: SetNull`** berasal dari FK komposit
  `StudentCharge.academicYear`, `CashbookEntry.paymentTransaction`,
  `ReportCard.publishedBy` — semuanya memuat `institutionId` **not-null**
  (penjaga tenant), sehingga `SET NULL` mustahil di DB. Diubah ke **`Restrict`**
  (data suci: induk tak boleh dihapus selama dirujuk); kode aplikasi tidak pernah
  hard delete ketiga induk itu. Migrasi `20261001004500_restrict_setnull_integrity`
  dibuat **dan diterapkan**; `migrate diff` DB vs schema = kosong.
* **`SESSION_SECRET` dihapus dari `.env.example`** (tidak pernah dibaca kode);
  `CRON_SECRET` (nyata dipakai `/api/cron/*`) didokumentasikan.
* **`tsconfig.tsbuildinfo`** dilepas dari tracking + masuk `.gitignore`.
* **PR #4 ditutup** sebagai duplikat PR #5 — diverifikasi isi 13 file-nya identik
  dengan `staging`; kini 0 PR terbuka.
* **Temuan baru (belum ditangani):** `prisma migrate status` melaporkan migrasi
  `20260924012230_init` **belum pernah di-apply** — DB lokal dibuat lewat
  `db push`, bukan migrasi. Konsekuensi: `prisma migrate dev` akan menawarkan
  **reset database**; jangan dijalankan. Jalur yang dipakai: tulis migrasi +
  apply manual via SQL. Status ini dicatat sebagai backlog.

### [2026-10-01] - Security: Rate Limiting Brute-Force Login (IMPLEMENTED & VERIFIED)
* **Masalah:** audit menemukan **0 rate limiting** pada login — `loginAction`
  menjalankan verifikasi bcrypt tanpa batas, jadi password bisa ditebak
  berulang tanpa hambatan.
* **Perbaikan:** `src/lib/auth/rate-limit.ts` (sliding-window, dua lapis
  per-akun 5×/10m + per-IP 30×/10m) dipasang di `loginAction` **sebelum**
  bcrypt; login sukses me-reset hitungan; `ipAddress` + `userAgent` kini
  benar-benar diteruskan ke `loginUser` (sebelumnya tidak).
* **Verifikasi:** `tsc --noEmit` 0 error · `npm test` **395/395 lulus**
  (384 baseline + 11 pengujian baru) · `npm run build` exit 0.
* **Status:** commit di `feature/mizan-work`, di-push & di-merge ke `staging`.
* **Batas:** state in-memory per proses — di serverless batas efektif dibagi
  per instance. Pembatasan keras (Redis/DB) masuk backlog.

### [2026-10-01] - Proteksi Branch `staging` di GitHub (IMPLEMENTED & VERIFIED)
* Dipasang via REST API branch protection: **blokir force push**, **blokir
  hapus branch**, **wajib linear history** (fast-forward saja).
* Sengaja **tidak** mewajibkan PR/approval/status check — alur kerja "push
  langsung ke `staging` setelah verifikasi hijau" tetap berjalan; status check
  baru masuk akal ketika CI workflow sudah ada.
* **Verifikasi:** `GET .../branches/staging/protection` mengembalikan
  `allow_force_pushes=false`, `allow_deletions=false`,
  `required_linear_history=true`, `enforce_admins=false`.

### [2026-09-30] - Security: Dependency Upgrade — Next.js 16.3.6 & SheetJS (xlsx) 0.20.3 (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menutup dua kerentanan kritis hasil audit 2026-09-30 sesuai urutan perbaikan yang disepakati: RCE pada `next@16.3.4` (**GHSA-vcvr-r3jv-pc5j**, picu `next/image`) dan `xlsx@0.18.5` (**CVE-2023-30533** prototype pollution + **CVE-2024-22363** ReDoS) yang dipakai Excel Importer.
* **Implementasi:**
  1. **`next` 16.3.4 → 16.3.6** (pin versi persis, rilis patch resmi) tanpa perubahan kode aplikasi.
  2. **`xlsx` ^0.18.5 → SheetJS CE 0.20.3** dari tarball resmi `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (registry npm publik memang ditahan di 0.18.5, rilis baru hanya ada di CDN SheetJS). Integritas terkunci di `package-lock.json` (sha512).
  3. **Zero code change:** API `XLSX.read` / `XLSX.utils` / `XLSX.writeFile` kompatibel, sehingga `src/lib/importer/parser.ts` dan 17 test importer tetap utuh tanpa penyesuaian.
  4. **Skema database tidak disentuh** → tanpa migrasi baru (sesuai aturan: migrasi = file baru).
* **Verifikasi:**
  * Typecheck `npx tsc --noEmit` → **0 error**.
  * Full regression `npx tsx --test` (env `.env` dimuat) → **384/384 pass, 0 fail** (baseline terjaga).
  * `prisma validate` → **valid** (3 warning `onDelete: SetNull` lama, tidak berubah).
  * `npm run build` → **sukses**, seluruh route terkompilasi.
  * `npm audit` → advisory `next` dan `xlsx` tidak lagi muncul; sisa 3 high semuanya dev-only (`prisma` → `@prisma/config` → `deepmerge-ts`).
* **Sisa / Berikutnya:** perbaikan CI workflow + script `test`, `deepmerge-ts` (toolchain Prisma), branch protection, README/LICENSE/ESLint, rate limit login.

### [2026-09-28] - Milestone: Communication Automation — Cross-Domain Notification Platform & Outbox Engine (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun platform notifikasi otomatis lintas domain terpusat berbasis Outbox Pattern untuk NataSekolah sesuai PRD Phase 4, dengan alur: `Business Event -> Notification Event -> Notification Outbox -> Worker -> Provider -> Delivery Status`.
* **Implementasi:**
  1. **Deterministic Idempotency Key:**
     * Menghasilkan ID deterministik berbasis hash SHA-256 (`notif_${hash(institutionId:idempotencyKey)}`) pada primary key `NotificationOutbox.id`.
     * Menjamin deduplikasi mutlak pada layer basis data tanpa penambahan skema migrasi baru (Zero DB Migration).
     * Mencegah duplikasi akibat server retry, network glitch, atau double submit pengguna.
  2. **Guardian Precedence Resolution (`src/lib/notification/guardian-resolver.ts`):**
     * Resolusi hierarkis nomor WhatsApp wali: `GuardianStudent` (primary -> created awal) -> `Student.parentWaPhone` -> `Student.phone`.
     * Validasi nomor seluler Indonesia (`628xxx`, 10–14 digit) dan sanitasi otomatis.
     * Penanganan anggun (*graceful skip*): kegagalan kontak wali tidak membatalkan atau merusak transaksi bisnis utama.
  3. **Integrasi Event Lintas Domain:**
     * **Keuangan (Payment):** Terpemicu secara ketat *post-commit* setelah `prisma.$transaction` selesai (`PAYMENT_RECEIPT:${payment.id}`). Jika payment rollback, notifikasi tidak dibuat.
     * **Kehadiran (Attendance):** Terpemicu saat sesi absensi ditutup (`status: "CLOSED"`), menerbitkan `ATTENDANCE_ALERT:${record.id}` khusus santri berstatus `ABSENT`.
     * **Akademik (Raport):** Terpemicu saat raport dibekukan dan diterbitkan (`status: "PUBLISHED"`), menerbitkan `REPORT_CARD_PUBLISHED:${reportCard.id}` lengkap dengan tautan portal wali (`/wali/akademik/raport/${reportCard.id}`).
  4. **Worker Hardening & Concurrency Protection:**
     * Atomic claim menggunakan `updateMany` pada status `PENDING`/`FAILED`, mencegah *race condition* antar worker bersamaan.
     * Klasifikasi kegagalan: *permanent failure* (nomor tidak valid, provider tidak didukung) langsung `FAILED` tanpa retry; *transient failure* menerapkan exponential backoff (`2^attempts * 60s`).
     * Route handler terjadwal `src/app/api/cron/notifications/route.ts` dengan proteksi `CRON_SECRET`.
  5. **Admin Workspace UX (`src/app/notifications/page.tsx`):**
     * Filter lengkap berdasarkan status, template key, dan channel komunikasi.
     * Observabilitas metadata (idempotency key, jadwal retry, batas percobaan).
     * Desain responsif berstandar WCAG AA, touch target >= 44px, dan kepatuhan `DESIGN.md`.
* **Verifikasi:**
  * 14 unit & integration tests (`test/communication-automation.test.ts` & `test/communication-engine.test.ts`) lolos 100%.
  * Total 384 tests di seluruh suite pengujian repositori lolos 100%.
  * Typecheck `npx tsc --noEmit` bersih (0 error).
  * Build produksi `npm run build` sukses dengan Turbopack.
  * Prisma schema validasi `npx prisma validate` sukses.

### [2026-09-24] - Milestone: Master Data Engine — Excel Importer & Auto-Sanitizer (Upload, Auto-Sanitize, Validate, Duplicate Detection, Preview, Confirm & Atomic Import) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Mengembangkan workflow import master data siswa dan wali murid yang aman, tangguh, dan reusable berbasis Master PRD v5.0 Phase 1 dengan alur: **Upload → Parse → Sanitize → Validate → Preview → Confirm → Import → Result**.
* **Implementasi:**
  1. **Spreadsheet Parser & Template Generator (`src/lib/importer/parser.ts`):**
     * Membaca file `.xlsx`, `.xls`, dan `.csv` menggunakan pustaka `xlsx`.
     * Menangani auto-mapping alias kolom fleksibel bahasa Indonesia/Inggris (NIS, Nama Lengkap, JK, NISN, NIK, Tempat/Tanggal Lahir, Nomor HP, Nama Wali, Rombel/Kelas).
     * Generator template file Excel berformat standar resmi siap unduh.
  2. **Indonesian Educational Data Auto-Sanitizer (`src/lib/importer/sanitizer.ts`):**
     * Pembersihan spasi berlebih, penanganan placeholder kosong (`-`, `null`, `N/A`).
     * Netralisasi formula injection (prefix kutip `'` pada sel yang diawali `=,+,-,@`).
     * Normalisasi nomor identitas dari float Excel (`1001.0` -> `1001`) dan stripping tanda hubung.
     * Normalisasi nomor telepon seluler Indonesia (`08...`, `8...`, `+628...` -> canonical `628...`) dengan validasi panjang 10–14 digit.
     * Normalisasi variasi jenis kelamin (`L`/`P`, `Laki-laki`, `Perempuan`, `Pria`, `Wanita`).
     * Konversi tanggal multi-format (Excel serial numbers, format Indonesia `DD/MM/YYYY`, `YYYY-MM-DD`, dan validasi batas kalender).
     * Normalisasi variasi hubungan wali (`AYAH`, `IBU`, `WALI`, `LAINNYA`).
  3. **Validator & Duplicate Detection (`src/lib/importer/validator.ts`):**
     * Integrasi skema validasi Zod (`createStudentInputSchema`).
     * Klasifikasi baris: `VALID`, `WARNING`, `ERROR` dengan rencana aksi `CREATE`, `SKIP_DUPLICATE`, `REJECT`.
     * Deteksi duplikasi internal (NIS sama dalam 1 file) sebagai `ERROR`.
     * Deteksi *Exact Duplicate* (NIS terdaftar di database institusi) sebagai `SKIP_DUPLICATE`.
     * Deteksi *Potential Duplicate* (NISN sama atau Nama + Tanggal Lahir sama dengan NIS berbeda) sebagai `WARNING`.
  4. **Atomic Transaction Importer Service (`src/lib/importer/importer-service.ts`):**
     * Guard izin RBAC (`student:create`) dan batas tenant mutlak dari context terautentikasi (`ctx.institutionId`).
     * Eksekusi dalam `prisma.$transaction`.
     * Pembuatan otomatis entitas `Guardian` & relasi `GuardianStudent`.
     * Penempatan rombel otomatis (`Enrollment`) pada tahun ajaran aktif dengan penjagaan *Sacred History*.
     * Pencatatan histori ke `AuditLog` (`action: "IMPORT"`).
  5. **Server Actions & UI Integration (`src/actions/importer.ts`, `src/components/importer/student-import-modal.tsx`, `src/app/students/page.tsx`):**
     * Server Actions terautentikasi: `previewStudentImportAction`, `executeStudentImportAction`, `getStudentImportTemplateAction`.
     * Modal interaktif 4-tahap: Upload (Drag & Drop + download template), Prapinjau metrik ringkasan & tabel data berfilter, Eksekusi, dan Kartu ringkasan hasil impor.
     * Tombol aksi "Impor Excel" pada halaman Buku Induk Siswa.
* **Verifikasi:**
  * Typecheck: `npx tsc --noEmit` lulus 100% (0 errors).
  * Unit & Integration Tests: `test/master-data-importer.test.ts` (17/17 tests PASS).
  * Full Regression Suite: 53 tests PASS (Buku Induk, Communication Engine, Master Data Importer, Tenant Isolation).
  * Build: `npm run build` sukses 100% (41 rute statically/dynamically generated).

---

### [2026-09-28] - Milestone: Master Data Engine — Bulk Promotion Workflow (Review, Classroom Mapping, Candidate Selection, Validation Preview, Sacred History Preservation, Idempotency & Audit Log) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Mengembangkan workflow kenaikan kelas siswa secara massal (*Bulk Promotion Workflow*) berbasis Master PRD v5.0 Bagian 15 dengan urutan alur: **Review → Preview → Validate → Promote → Audit** serta penegakan integritas data sakral (*Sacred History*).
* **Implementasi:**
  1. **Domain Types & Error Contracts (`src/lib/academic/promotion-types.ts`):**
     * Kontrak tipe `PromotionPreviewRow`, `PromotionPreviewSummary`, `ClassroomMapping`, `PromotionExecutionResult`, dan galat domain `PromotionValidationError`.
  2. **Zod Validation Schemas (`src/lib/validation/promotion.ts`):**
     * Skema `previewBulkPromotionInputSchema`: validasi CUID tahun ajaran asal & target (`sourceAcademicYearId !== targetAcademicYearId`), array pemetaan rombel minimal 1 baris, dan filter opsional ID siswa terpilih.
     * Skema `executeBulkPromotionInputSchema`: validasi array eksekusi promosi `studentId` dan `targetClassroomId`.
     * Skema `promotionCandidateFilterSchema`: paginasi, pencarian nama/NIS, filter rombel asal dan penandaan konflik tahun target.
  3. **Domain Service Engine (`src/lib/academic/promotion-service.ts`):**
     * `getPromotionCandidates`: Pengambilan calon siswa dengan paginasi server-side dan deteksi otomatis apakah siswa telah terdaftar pada tahun target (`isAlreadyEnrolledInTarget`).
     * `previewBulkPromotion`: Prapinjau validasi tanpa mutasi basis data. Mengklasifikasikan siswa ke dalam status `READY`, `WARNING` (siswa non-ACTIVE), dan `ERROR` (sudah terdaftar di tahun target / ketidaksesuaian tahun ajaran rombel). Menghasilkan metrik ringkasan metrik Total, Ready, Warning, dan Error.
     * `executeBulkPromotion`: Eksekusi atomik dalam `prisma.$transaction`. Memeriksa idempotency pencegahan duplikasi target enrollment, membuat baris baru `Enrollment` pada tahun ajaran target dengan status `ENROLLED`, **mempertahankan rekaman histori lama tanpa mengubah atau menghapusnya (Sacred History)**, serta mencatat entri riwayat ke `AuditLog` (`action: "BULK_PROMOTION"`).
  4. **Server Actions Terautentikasi (`src/actions/promotion.ts`):**
     * `getPromotionCandidatesAction`, `previewBulkPromotionAction`, dan `executeBulkPromotionAction` dengan guard otorisasi RBAC (`academic:manage`), isolasi tenant dari sesi terautentikasi (`ctx.institutionId`), dan auto revalidation path (`/students`, `/classrooms`, `/academic-years`).
  5. **Antarmuka Responsive Kenaikan Kelas (`src/app/students/promotions/page.tsx`):**
     * Workflow 4 tahap interaktif: (1) Setup Tahun Ajaran & Pemetaan Rombel dinamis, (2) Pemilihan Siswa massal dengan checkbox, filter kelas, dan pencarian instan, (3) Prapinjau validasi metrik ringkasan kartu, filter status, tabel detail, dan dialog modal konfirmasi eksplisit, (4) Kartu hasil sukses dengan micro-animation `SuccessCheck`, ringkasan metrik, ID jejak audit, dan navigasi cepat.
     * Integrasi tombol pintas "Kenaikan Kelas" pada bilah aksi utama `/students` dan `/classrooms`.
* **Verifikasi:**
  * Typecheck: `npx tsc --noEmit` lulus 100% (0 errors).
  * Build: `npm run build` berhasil dengan pembuatan rute `/students/promotions` (42 static/dynamic routes).
  * Unit & Integration Tests: `test/bulk-promotion.test.ts` (13/13 PASS).
  * Full Regression Tests: `test/academic-core.test.ts` (21/21 PASS) & `test/tenant-isolation.test.ts` (10/10 PASS).
  * Schema & Database: `npx prisma validate` valid 100%, 0 migrasi skema diperlukan.

---


### [2026-09-24] - Milestone: Motion System & Interaction Polish (Motion Tokens, Reusable Motion Primitives, Shimmer Skeleton, Dialog/Drawer Motion, Cashier Multi-Step Success Feedback, Reduced-Motion WCAG AA) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun dan mengimplementasikan **Motion Language NataSekolah** yang halus, intensional, konsisten, cepat ($\le 240\text{ms}$), dan *non-disruptive* berbasis `DESIGN.md v2.0` (Dial `ENERGY 1 / RHYTHM 2 / MOTION 1`, Anti-Slop Mode 1). Menghilangkan perubahan state yang kaku (*instant snap*) dan mengganti pulse generik dengan shimmer halus, tanpa menambah bobot library pihak ketiga ataupun merombak logika domain/finansial backend.
* **Implementasi:**
  1. **Audit Motion & Eliminasi Anti-Patterns:**
     * Mengidentifikasi dan membasmi seluruh animasi bouncing (`active:scale-95`, `active:scale-98`), efek rotasi berat, dan spinner fullscreen blocking.
     * Mengklasifikasikan motion menjadi sistem terarah berbasis CSS native dan Tailwind `@theme`.
  2. **Motion Tokens Semantik (`src/app/globals.css`):**
     * Durasi terstandarisasi: `--duration-instant: 75ms` (feedback mikro), `--duration-fast: 120ms` (hover/focus), `--duration-standard: 180ms` (dropdown/tab/fade), `--duration-slow: 240ms` (modal/drawer).
     * Easing cubic-bezier semantik: `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, `--ease-enter: cubic-bezier(0, 0, 0.2, 1)`, `--ease-exit: cubic-bezier(0.4, 0, 1, 1)`.
     * Utility classes berkinerja tinggi berbasis GPU (`transform`, `opacity`): `.animate-modal-enter`, `.animate-drawer-slide-up`, `.animate-dropdown-enter`, `.animate-tooltip-enter`, `.animate-fade-in`, `.animate-content-enter`, `.animate-shimmer`, `.animate-checkmark`.
  3. **Aksesibilitas & Reduced Motion (WCAG 2.1 AA):**
     * Menerapkan aturan global `@media (prefers-reduced-motion: reduce)` yang menetralkan seluruh durasi animasi dan transisi ke `0.01ms !important`, menjaga 100% kelengkapan fungsionalitas dan keamanan bagi pengguna dengan gangguan vestibular.
  4. **Komponen Primitif Motion Reusable:**
     * `Skeleton`: Shimmering sheen tenang berbasis linear gradient tanpa flicker.
     * `Dialog`: Transisi masuk halus (`animate-fade-in` pada backdrop dan `animate-modal-enter` dengan scale 0.985 -> 1).
     * `Dropdown` & `Tooltip`: Transisi buka cepat tanpa pantulan (`animate-dropdown-enter`, `animate-tooltip-enter`).
     * `Tabs` & `Button`: Respons taktil instan (`duration-150 ease-standard active:opacity-95`).
     * `SuccessCheck` (`src/components/ui/success-check.tsx`): Komponen SVG centang sukses dengan animasi goresan garis (`animate-checkmark`) terintegrasi.
  5. **App Shell & Navigasi:**
     * Kontinuitas rute: Transisi konten halaman menggunakan `.animate-content-enter` tanpa me-remount navbar atau shell utama.
     * Mobile navigation: Reflow drawer bawah menggunakan `.animate-drawer-slide-up` dan transisi tab bilah bawah halus.
  6. **Reference Implementation — Finance Workspace:**
     * Kasir Pembayaran (`/finance/payments`): Alur 3-tahap mulus: (1) Form input, (2) Konfirmasi penerimaan kas, (3) Tampilan status sukses dengan micro-animation `SuccessCheck`, detail pembayaran, dan aksi cetak kwitansi langsung.
     * Tagihan Siswa (`/finance/charges`): Tampilan verifikasi kandidat tagihan massal transisi halus `animate-fade-in` dan modal konfirmasi VOID aman.
     * Buku Kas (`/finance/cashbook`): Toggle jenis mutasi pengeluaran/pemasukan ber-feedback taktil halus `active:opacity-95 duration-150`.
  7. **Otomasi Pengujian (`test/motion-system.test.ts`):**
     * 15 automated contract tests untuk token durasi/easing, prefers-reduced-motion, verifikasi 0 `active:scale-95`, 0 fullscreen blocking spinner, primitif Skeleton shimmer, Dialog modal enter, Dropdown enter, dan alur pembayaran kasir 3-tahap.
* **Hasil Verifikasi:**
  * Unit & Contract Test Suite: **340 tests pass** (120 test suites, 0 fail).
  * TypeScript Compiler (`npx tsc --noEmit`): **0 errors**.
  * Prisma Schema Validation (`npx prisma validate`): **Valid**.
  * Production Build (`npm run build`): **100% sukses** (41 rute statically optimized).

### [2026-09-23] - Milestone: Finance Workspace UX Migration (Unified Finance Workspace Layout & Navigation, Charges, Payments Cashier Counter, Cashbook BKU, Fee Categories, Reports & CSV Export) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Memigrasikan seluruh ruang kerja keuangan (`/finance`, `/finance/charges`, `/finance/payments`, `/finance/cashbook`, `/finance/fees`, `/finance/reports`) ke fondasi visual dan UX Design System baru (`DESIGN.md v2.0` & UI Foundation). Mentransformasi modul keuangan menjadi **SATU WORKSPACE TERPADU** yang konsisten, tenang (*calm*), berkecepatan tinggi (*fast*), terstruktur (*organized*), data-dense, dan responsif tanpa merombak logika bisnis, skema Prisma, ataupun aturan transaksi atomik backend yang telah terkunci.
* **Implementasi:**
  1. **Struktur Workspace & Persistent Sub-Navigasi (`src/app/finance/layout.tsx` & `src/components/finance/finance-workspace-nav.tsx`):**
     * Membungkus seluruh sub-halaman keuangan dalam persistent layout terpadu dengan judul *"Workspace Keuangan"*, deskripsi operasional ringkas, dan bilah navigasi tab internal (6 rute: *Ringkasan*, *Tagihan Siswa*, *Kasir Pembayaran*, *Buku Kas (BKU)*, *Kategori Biaya*, *Laporan*).
     * Mencegah remount shell aplikasi ataupun header saat bernavigasi antar-submodul keuangan (`Charges` → `Payments` → `Cashbook` → `Reports`).
     * Tab interaktif ramah sentuh jempol (target sentuh $\ge 44\text{px}$) dengan indikator rute aktif `bg-teal-700 text-white font-semibold shadow-2xs` dan reflow horizontal mulus pada layar ponsel.
  2. **Dashboard Keuangan & Syahriah (`src/app/finance/page.tsx`):**
     * Mengeliminasi duplikasi `NavHeader` dan wrapper `bg-slate-50`.
     * Mengganti spinner fullscreen dengan kisi 5 `CardSkeleton` saat memuat ringkasan realtime (*zero-CLS*).
     * Metrik kontekstual terformat tabular monospaced (`tabular-nums font-mono`): Penerimaan Hari Ini, Sudah Terbayar, Sisa Tunggakan, Jatuh Tempo (Overdue), dan Saldo Bersih BKU.
     * Navigasi pintas terarah menuju modul-modul operasional kasir dan penagihan.
  3. **Operasional Tagihan Santri (`src/app/finance/charges/page.tsx`):**
     * Mengganti seluruh badge pill `rounded-full` menjadi `Badge` primitif bersudut tumpul `rounded-md` dengan varian semantik (`success`, `warning`, `danger`, `info`, `neutral`).
     * Mengadopsi `DataTableView` responsif: tabel multi-kolom rapi di desktop (`md:table`) dengan penjajaran teks kiri dan angka mata uang kanan (`tabular-nums font-mono`), serta transformasi otomatis menjadi kartu *ResourceList* vertikal terstruktur di layar ponsel (`md:hidden`) tanpa overflow horizontal.
     * Dialog modal terstandar (`Dialog`, `Input`, `Select`, `Button`) untuk penerbitan Tagihan Tunggal dan Tagihan Massal per rombel dengan live candidate preview.
     * Modal dialog konfirmasi pembatalan (VOID) dengan proteksi permanen dan feedback yang jelas.
  4. **Kasir Pembayaran & Kwitansi Resmi (`src/app/finance/payments/page.tsx`):**
     * Workflow kasir terpadu yang cepat: (1) Cari santri pembayar, (2) Daftar tagihan tertunggak terurut jatuh tempo tertua dengan opsi "Pilih Semua", (3) Input nominal alokasi rata kanan berjarak tetap, (4) Layar konfirmasi penerimaan kas, (5) Eksekusi atomik transaksi dengan dialog kwitansi sah siap cetak (`window.print()`).
     * Menjaga 100% integritas aturan transaksi domain: `PaymentTransaction`, `PaymentAllocation`, mutasi otomatis `CashbookEntry`, dan penomoran `Receipt`.
     * Riwayat kasir multi-kolom di desktop dan kartu di ponsel dengan aksi cetak ulang kwitansi instan.
  5. **Buku Kas Umum / BKU (`src/app/finance/cashbook/page.tsx`):**
     * Tabel mutasi kas berdensitas tinggi (36px compact desktop, reflow kartu mobile).
     * Pembedaan sumber mutasi yang jelas via Badge semantik: `Kasir Pembayaran` (otomatis, terkunci) vs `Manual Operasional`.
     * Angka nominal bertanda (`+ Rp ...` emerald untuk INCOME, `- Rp ...` rose untuk EXPENSE) dengan `tabular-nums font-mono`.
     * Modal pencatatan kas manual dengan tombol switch jenis pengeluaran/pemasukan ber-target sentuh min 44px.
  6. **Master Kategori Biaya (`src/app/finance/fees/page.tsx`):**
     * Manajemen pos syahriah dan biaya kesiswaan terintegrasi `DataTableView` dan modal dialog formulir baru/edit.
     * Status aktif/nonaktif menggunakan semantic `Badge` persegi tumpul `rounded-md`.
  7. **Laporan Keuangan & Operasional (`src/app/finance/reports/page.tsx`):**
     * Tiga sub-laporan terpadu via tab interaktif: *Rekap Pembayaran*, *Tagihan & Tunggakan*, dan *Arus Kas (BKU)*.
     * Filter rentang tanggal transaksi dengan integrasi unduh CSV/Excel (`generatePaymentsCSV`, `generateChargesCSV`, `generateCashbookCSV`).
     * Visualisasi data-dense berbasis tabel dan metrik ringkas tanpa grafik dekoratif berlebihan.
  8. **Pengujian & Quality Gate (`test/finance-ui-workspace.test.ts`):**
     * Menambahkan 10 test assertion baru untuk validasi navigasi workspace, verifikasi 0 penggunaan `rounded-full` pada seluruh halaman keuangan, verifikasi 0 animasi bouncing `active:scale-95`, penjajaran angka/mata uang `tabular-nums font-mono`, target sentuh $\ge 44\text{px}$, dan aturan keselamatan VOID.
* **Hasil Verifikasi:**
  * Unit & Contract Test Suite: **325 tests pass** (113 test suites, 0 fail).
  * TypeScript Compiler (`npx tsc --noEmit`): **0 errors**.
  * Prisma Schema Validation (`npx prisma validate`): **Valid**.
  * Production Build (`npm run build`): **100% sukses** (41 rute statically optimized).

### [2026-09-23] - Milestone: UI Foundation & Persistent App Shell (Design Tokens, UI Primitives, Persistent AppShell, Mobile Navigation, Zero-CLS Skeletons, DataTableView & Dashboard Reference Implementation) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Mengimplementasikan fondasi antarmuka pengguna (UI Foundation) dan shell aplikasi persisten (*Persistent Application Shell*) berbasis `DESIGN.md v2.0` untuk menjamin seluruh halaman operasional NataSekolah konsisten, responsif, berkecepatan tinggi (*fast perceived navigation*), dan bebas dari kedipan remount navigasi tanpa merombak logika domain backend yang telah terkunci.
* **Implementasi:**
  1. **Semantic Design Tokens (`src/app/globals.css`):**
     * Mengonfigurasi token CSS semantik terpadu menggunakan `@theme` Tailwind CSS v4: Canvas (`--color-canvas`), Surface (`--color-surface`, `--color-surface-muted`), Brand Primary (`--color-primary`, Pine Teal `#0f766e`), Foreground (`--color-foreground`, Zinc 900 `#18181b`), Borders (`--color-border`), dan Status Semantik (`success`, `warning`, `danger`, `info`).
     * Standar focus-visible terpadu (`outline: 2px solid var(--primary)`), angka berjarak tetap (`.tabular-nums`), dan target sentuh minimum jempol (`.touch-target` min 44x44px).
  2. **Komponen Primitif UI Standar (`src/components/ui/*` & `src/lib/utils.ts`):**
     * Utilitas standar `cn` berbasis `clsx` dan `tailwind-merge`.
     * `Button`: Varian `primary`, `secondary`, `outline`, `ghost`, `destructive` dengan target sentuh min 44px, status `isLoading`, dan eliminasi animasi pantul (*bouncy scale-95*).
     * `Input` & `Select`: Form control berstandar aksesibel dengan label, error helper, dan min-h 44px.
     * `Checkbox` & `Switch`: Kontrol seleksi ramah sentuh jempol dengan atribut WAI-ARIA `role="switch"` dan keyboard support.
     * `Tabs`: Segmented tab bar ramping dengan WAI-ARIA `role="tablist"` dan `role="tab"`.
     * `Card`: Kontainer datar dengan bayangan lembut `shadow-2xs` dan border stone-200.
     * `Badge`: Indikator status persegi tumpul `rounded-md` (pelarangan ketat bentuk kapsul `rounded-full` untuk status fungsional).
     * `Dialog`: Modal dialog dengan backdrop blur, penutupan via tombol `Escape`, dan perangkap fokus.
     * `Dropdown`: Menu dropdown terstruktur dengan penutup klik luar (*click outside*) dan navigasi keyboard.
     * `Tooltip`, `Breadcrumb`, `Pagination`: Komponen pelengkap navigasi dan navigasi halaman terstandar.
     * `Skeleton`: Blok dasar animasi pulse abu-abu halus untuk perceived performance.
  3. **Persistent Application Shell (`src/components/app-shell.tsx` & `src/components/app-shell-wrapper.tsx`):**
     * Arsitektur shell persisten di `src/app/layout.tsx`: Header dan bilah navigasi tidak pernah di-unmount/remount saat berpindah rute operasional.
     * Navigasi 2-level terprediksi (GitLab Pajamas pattern):
       * Level 1 (Pusat Aktivitas Harian): Dashboard, Workspace Guru, Presensi, Keuangan, Penilaian, Raport.
       * Level 2 (Master Data & Administrasi): Siswa/Buku Induk, Tahun Ajaran, Rombel, Mapel, Direktori Guru, Penugasan, Asrama, Tahfidz, Outbox WA, Pengaturan.
     * Bilah Navigasi Bawah Ponsel (*Mobile Bottom Bar*): 4 aksi jempol frekuensi tinggi (Dasbor, Guru, Presensi, Keuangan) + Drawer menu selengkapnya.
     * Singleton GlobalSearchDialog (Ctrl+K): Dikelola terpusat di shell tanpa re-instansiasi di setiap halaman.
     * Koordinasi Subtitle Otomatis via `AppShellContext`: Mempertahankan kompatibilitas penuh dengan komponen `NavHeader` eksisting tanpa terjadinya double header.
     * Pengecualian rute non-operasional: Halaman landing (`/`), login (`/login`), dan portal wali (`/wali/*`) dikecualikan secara elegan tanpa membebani shell staf.
  4. **Loading Foundation & Zero CLS (`src/components/loading/skeletons.tsx`):**
     * Pustaka skeleton reusable seukuran container target: `PageSkeleton`, `TableSkeleton`, `CardSkeleton`, `ListSkeleton`, `FormSkeleton`.
     * Menghilangkan total spinner fullscreen yang membekukan layar pada navigasi normal.
  5. **Responsive Data-Dense Foundation (`src/components/data-dense/data-table-view.tsx`):**
     * Kontrak tabel data operasional:
       * Desktop (`md:table`): Tabel multi-kolom padat dengan angka/nominal rata kanan (`font-mono tabular-nums`) dan teks rata kiri.
       * Mobile (`md:hidden`): Transformasi otomatis menjadi *ResourceList* vertikal terstruktur tanpa geser horizontal.
  6. **Reference Implementation — Dashboard (`/dashboard`):**
     * Migrasi struktur visual `/dashboard` menggunakan UI Primitives (`Button`, `Badge`, `Card`), semantic design tokens, dan `PageSkeleton` saat memuat data awal (CLS = 0).
     * Seluruh domain service (`getOperationalDashboardAction`), penanganan hak akses, dan logika operasional tetap 100% utuh tanpa modifikasi backend.
* **Hasil Verifikasi:**
  * 12 Unit/Integration Tests baru pada `test/ui-foundation.test.ts` lulus 100%.
  * Total 315 tests lulus 100% tanpa regresi (108 test suites, 0 fail).
  * TypeScript typecheck (`npx tsc --noEmit`) bersih (0 error).
  * Prisma schema validasi (`npx prisma validate`) valid (0 error).
  * Next.js production build (`npm run build`) sukses untuk seluruh 41 routes.

### [2026-09-23] - Milestone: NataSekolah Design System & Product UX Reset (DESIGN.md v2, Design Tokens, Navigation Contract, Data Density, A11y & Anti-Patterns) (COMPLETE / SPECIFIED)
* **Tujuan:** Menetapkan kontrak arsitektur dan spesifikasi desain antarmuka menyeluruh (*Design System & Product UX Contract*) melalui perombakan `DESIGN.md` menjadi v2.0 yang komprehensif, terstruktur, dan berakar pada karakter produk: **Clean · Fresh · Calm · Fast · Organized** tanpa mengubah arsitektur backend atau mendestabilkan kode aplikasi yang sudah berjalan.
* **Hasil Kerja & Implementasi Spesifikasi:**
  1. **Audit UI Eksisting:**
     * Mengidentifikasi unmount/remount navigasi `NavHeader` pada setiap pergantian halaman akibat belum adanya persistent application shell.
     * Mengidentifikasi inkonsistensi penggunaan border radius (`rounded-lg`, `rounded-xl`, dan penyalahgunaan `rounded-full` pada badge status).
     * Mengidentifikasi arbitrary raw color dan gradien banner yang berpotensi melanggar prinsip *ENERGY 1 / MOTION 1*.
     * Mengidentifikasi risiko overflow horizontal pada tabel data padat saat dibuka di layar ponsel sempit.
  2. **Riset & Benchmark Open-Source Berkualitas:**
     * *Shopify Polaris:* Adopsi pola pemisahan tabel interaktif (`IndexTable`) vs ringkasan vertikal ramah ponsel (`ResourceList`), penjajaran data terstandar (angka rata kanan tabular, teks rata kiri).
     * *GitLab Pajamas:* Adopsi navigasi 2-level terprediksi (Workspace Operasional Harian vs Master Data Lembaga).
     * *IBM Carbon:* Adopsi skala kepadatan tabel (~36px compact, ~48px comfortable, ~56px spacious) dan skeleton loader presisi seukuran container target untuk eliminasi *Cumulative Layout Shift* (CLS).
     * *Radix UI / shadcn/ui:* Standar komponen primitif berbasis WAI-ARIA, indikator fokus tegas, dan penelusuran keyboard penuh.
  3. **Penyusunan DESIGN.md v2 (24 Bagian Lengkap):**
     * Filosofi & kepribadian produk (*Clean, Fresh, Calm, Fast, Organized*).
     * Token semantik CSS lengkap (Canvas, Surface, Primary, Foreground, Borders, Semantic Status).
     * Standar tipografi Bahasa Indonesia dengan ukuran teks minimum yang nyaman bagi guru dan orang tua.
     * Sistem navigasi lintas perangkat (Desktop, Tablet, Ponsel Bottom Bar) dengan arsitektur *Persistent App Shell*.
     * Standar 15 komponen inti (Button, Input, Select, Checkbox, Switch, Tabs, Card, Table, Badge, Dialog, Dropdown, Tooltip, Toast, Breadcrumb, Pagination).
     * Standar penanganan Data-Dense UI dan reflow responsif ponsel.
     * Standar loading (skeleton only, zero fullscreen spinner), empty state solutif, dan error state manusiawi.
     * Standar aksesibilitas WCAG 2.1 AA (rasio kontras 5.3:1 - 14.5:1, target sentuh min 44px, keyboard navigation).
     * Standar motion fungsional (maks 150-200ms, tanpa efek bouncing `scale-95`).
     * Pengalaman spesifik 5 peran pengguna (*Admin, Guru, Bendahara, Wali, Pimpinan*).
     * Komposisi halaman standar 4-blok (Header, Metrik, Filter/Kontrol, Area Data).
     * Pedoman penulisan (Anti-Slop R-02, tanpa em dash, format rupiah/tanggal resmi).
     * Daftar larangan tegas (*Anti-Patterns*).
     * Tata kelola implementasi (*Design System Primitives → Composite Components → Role Workspaces*).
  4. **Zero-Migration & Zero-Disruption Compliance:**
     * Menegakkan batasan ketat: tidak menambah domain baru, tidak mengubah backend atau skema Prisma, dan tidak melakukan redesign massal mendadak pada fase ini. Seluruh pengujian eksisting (303 tests) tetap lulus 100%.

### [2026-09-23] - Milestone: Teacher Workspace / Academic Operations (Teacher Workspace, Class View, Student Academic Summary, Attendance & Assessment Integration, Plugin Guard) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menghadirkan ruang kerja terpadu bagi guru (`/teacher`) untuk menjawab: *"Kelas apa yang saya ajar, apa yang harus saya kerjakan, dan bagaimana perkembangan siswa saya?"* di atas Teaching Core, Attendance Core, dan Formal Academic Core tanpa membuat model database atau engine duplikat.
* **Implementasi:**
  1. **Experience Layer Over Locked Domains (Zero-Migration):**
     * Mempertahankan seluruh skema Prisma locked: `TeacherAssignment`, `Subject`, `Classroom`, `AcademicYear`, `Enrollment`, `AttendanceSession`, `AttendanceRecord`, `Assessment`, `AssessmentScore`.
     * Menggunakan `TeacherAssignment` sebagai single source of scope untuk seluruh akses operasional guru.
  2. **Teacher Workspace Dashboard (`/teacher`):**
     * Menampilkan salam kontekstual guru, tahun ajaran aktif, metrik ringkasan (jumlah kelas yang diajar, jumlah mapel, sesi presensi hari ini, dan assessment yang perlu dikerjakan/belum lengkap).
     * Kartu penugasan mengajar dengan informasi mapel, kelas, tahun ajaran, jumlah siswa ter-enroll, status presensi hari ini, serta shortcut 1-klik: *Presensi*, *Penilaian*, dan *Rekap Kelas*.
     * Menangani kondisi empty state elegan jika guru belum memiliki penugasan aktif.
  3. **Student Class View (`/teacher/classes/[assignmentId]`):**
     * Menampilkan daftar siswa riil berdasarkan `Enrollment` (`classroomId` dan `academicYearId` dari penugasan).
     * Agregasi statistik kelas: total siswa, rata-rata kehadiran kelas (%), rata-rata nilai kelas, dan jumlah tugas/ujian.
     * Pencarian instan siswa berdasarkan nama atau NISN/NIS.
     * Tabel daftar siswa dengan rincian persentase kehadiran, rata-rata nilai, dan tautan ke profil akademik siswa.
  4. **Student Academic Summary & Privacy Invariant (`/teacher/classes/[assignmentId]/students/[studentId]`):**
     * Tampilan profil akademik terfokus: riwayat presensi siswa pada sesi penugasan dan seluruh nilai assessment pada mapel tersebut.
     * *Strict Privacy Invariant:* Data keuangan (tagihan, pembayaran, kwitansi) dan data wali santri (nomor WhatsApp orang tua) sama sekali TIDAK diekspos kepada guru, menjamin prinsip hak akses minimum.
  5. **Attendance Integration & Immutability:**
     * Integrasi langsung dengan Attendance Core (`/attendance`). Guru hanya dapat membuka dan mencatat sesi presensi untuk penugasan miliknya.
     * Sesi yang telah berstatus `CLOSED` bersifat kekal (immutable) dan tidak dapat dimanipulasi.
  6. **Assessment Integration & Formal Academic Plugin Enforcement:**
     * Guru dapat mengelola assessment dan menginput nilai secara batch pada penugasan miliknya.
     * Penegakan otorisasi kepemilikan: guru tidak dapat membuat/mengubah assessment pada penugasan guru lain.
     * *Plugin Awareness:* Jika plugin `FORMAL_ACADEMIC` dinonaktifkan pada lembaga, server melempar `DomainFeatureDisabledError` (403) dan UI secara graceful menyembunyikan shortcut penilaian.
  7. **Strict Multi-Tenant & Teacher Resource Scoping:**
     * Validasi kepemilikan penugasan dilakukan di sisi server (`assertTeacherAssignmentAccess`).
     * Guru ditolak keras (`TeacherAssignmentAccessDeniedError` / `ResourceNotFoundError`) jika mencoba mengakses assignment guru lain, roster kelas yang tidak diajar, atau manipulasi URL.
  8. **Navigation & Quick Actions:**
     * Menambahkan tautan "Workspace Guru" (`/teacher`) pada header navigasi utama (`src/components/nav-header.tsx`).
     * Menambahkan tombol aksi cepat *Workspace Guru* pada Operational Dashboard (`src/app/dashboard/page.tsx`).
* **Hasil Verifikasi:**
  * 15 Unit/Integration Tests baru pada `test/teacher-workspace.test.ts` lulus 100%.
  * Total 303 tests lulus 100% tanpa regresi.
  * TypeScript typecheck (`npx tsc --noEmit`) bersih (0 error).
  * Prisma schema validasi (`npx prisma validate`) valid.
  * Next.js production build (`npm run build`) sukses untuk seluruh 41 routes.

### [2026-09-23] - Milestone: Finance & Billing Operations (Fee Categories, Bulk Billing, Cashier Multi-Charge Counter, Atomic Allocations, Printable Receipts, Cashbook Immutability, Operational Reports & CSV Export) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Mengubah Finance Core yang sudah terkunci menjadi alur kerja operasional nyata bagi bendahara/kasir sekolah dan pesantren dengan integritas finansial mutlak, isolasi tenant ketat, transaksi atomik, kwitansi cetak instan, dan pelaporan operasional terintegrasi portal wali.
* **Implementasi:**
  1. **Zero-Migration Compliance & Finance Core Integrity:**
     * Mempertahankan skema Prisma Finance Core secara utuh tanpa modifikasi field atau constraint (`FeeCategory`, `StudentCharge`, `PaymentTransaction`, `PaymentAllocation`, `CashbookEntry`, `Receipt`).
     * Memanfaatkan konfigurasi operasional lembaga dari `Institution.settingsJson` (`receiptNumberPrefix`, `receiptFooterNote`, `invoiceDueDays`).
  2. **Billing Operations & Bulk Charge Generation with Duplicate Prevention:**
     * Menambahkan `bulkCreateStudentCharges` cerdas dengan deteksi tagihan eksisting per `(studentId, feeCategoryId, period / academicYearId)` non-`VOID` dalam tenant yang sama. Melewati siswa yang sudah ditagih untuk menjamin nol duplikasi tagihan.
     * Endpoint preview target siswa `getTargetStudentsForBilling`: mengevaluasi siswa target (seluruh siswa aktif atau per rombel/kelas) dan menyajikan live preview jumlah siswa eligible vs yang sudah ditagih.
     * Halaman operasional `/finance/charges` dengan ringkasan status derived dari alokasi pembayaran (`Total Tagihan`, `Sudah Terbayar`, `Sebagian`, `Belum Dibayar`, dan `Jatuh Tempo` berbasis `dueDate < now`).
     * Tindakan pembatalan tagihan (VOID) yang aman: hanya dapat dibatalkan jika belum memiliki alokasi pembayaran.
  3. **Cashier Payment Counter & Multi-Charge Allocation (`/finance/payments`):**
     * Alur kasir berkecepatan tinggi: pencarian instan siswa/santri via nama atau NISN, menampilkan seluruh tagihan outstanding (`UNPAID` dan `PARTIAL`).
     * Dukungan pembayaran multi-tagihan secara fleksibel: kalkulasi alokasi otomatis (FIFO) atau input manual per tagihan.
     * Dialog konfirmasi wajib sebelum eksekusi transaksi untuk mencegah salah input kasir.
     * Transaksi database atomik (Prisma `$transaction`): validasi tenant boundary, status tagihan aktif, alokasi tidak melebihi sisa tagihan, pembuatan `PaymentTransaction`, pembuatan `PaymentAllocation`, pembukuan otomatis `CashbookEntry` (INCOME), dan penerbitan `Receipt` secara atomik dengan rollback otomatis bila terjadi error.
     * Penolakan keras terhadap over-allocation, tagihan VOID, dan tagihan lintas tenant.
  4. **Printable Receipt & Operational Branding:**
     * Penomoran kwitansi bebas tabrakan (atomic counter collision-free) dengan prefix kustom dari konfigurasi lembaga (misal: `KW-202609-0001` atau `KWT-SMP-202609-0001`).
     * Modal detail kwitansi ramah cetak (`@media print` CSS clean): kop logo dan informasi lembaga, rincian pembayaran & alokasi komponen biaya, stempel/status lunas, serta catatan kaki operasional lembaga (`receiptFooterNote`).
  5. **Operational Cashbook (`/finance/cashbook`):**
     * Buku Kas Umum dengan pemisahan tegas antara mutasi masuk otomatis kasir pembayaran (sumber `PAYMENT`, immutable) dan mutasi manual operasional (sumber `MANUAL`).
     * Modal pencatatan pengeluaran (EXPENSE) dan pemasukan (INCOME) operasional non-SPP.
     * Ringkasan real-time: Total Masuk, Total Keluar, Saldo Bersih, dan Penerimaan Hari Ini.
  6. **Operational Financial Reporting (`/finance/reports`):**
     * 3 tab laporan agregasi transaksi aktual database:
       * *Rekap Pembayaran:* filter rentang tanggal, total penerimaan, jumlah transaksi, rata-rata, breakdown kategori biaya & metode pembayaran, serta tabel transaksi terperinci.
       * *Tagihan & Tunggakan:* total piutang/tagihan, tagihan terbayar, sisa piutang, santri menunggak dengan hitungan hari keterlambatan.
       * *Arus Kas Operasional:* total arus masuk, arus keluar, dan saldo bersih kas.
  7. **Universal Client-Safe CSV Export:**
     * Ekspor CSV siap buka di Microsoft Excel dengan UTF-8 BOM (`\uFEFF`) untuk Rekap Pembayaran, Tagihan & Tunggakan, serta Buku Kas Umum.
  8. **Guardian Portal Synchronization:**
     * Seluruh transaksi pembayaran kasir yang completed langsung tersinkronisasi dan dapat dilihat oleh wali murid yang tertaut pada `/wali/keuangan` dengan pembatasan ReBAC Guardian tetap terjaga.
* **Hasil Verifikasi:**
  * 15 Unit/Integration Tests baru pada `test/finance-operations.test.ts` lulus 100%.
  * Total 288 tests lulus 100% tanpa regresi.
  * TypeScript typecheck (`npx tsc --noEmit`) bersih (0 error).
  * Prisma schema validasi (`npx prisma validate`) valid.
  * Next.js production build (`npm run build`) sukses untuk seluruh 40 routes.

### [2026-09-23] - Milestone: Institution Configuration & Settings (Multi-Tenant Profile, Plugin Config, Dynamic Terminology, Operational Rules & User Management) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Memungkinkan NataSekolah dikonfigurasi secara menyeluruh per lembaga tanpa modifikasi source code atau fork codebase, mencakup profil lembaga, kontrol plugin domain, terminologi kultural dinamis, aturan operasional (presensi, keuangan, komunikasi, akademik), dan manajemen pengguna internal terotorisasi.
* **Implementasi:**
  1. **Zero-Migration Multi-Tenant Architecture:**
     * Menggunakan kolom `settingsJson` pada model `Institution` yang sudah tersedia di Prisma schema untuk menyimpan pengaturan terminologi, aturan operasional, serta kontak web & email tanpa perlu destructive migration.
  2. **Institution Profile Management (`/settings/institution`):**
     * Menampilkan dan mengedit nama, alamat, nomor telepon, logoUrl, email, dan website.
     * Slug lembaga dilindungi sebagai read-only untuk menjaga konsistensi domain/subdomain tenant.
     * Penegakan otorisasi mutlak dengan izin `institution:manage`.
  3. **Plugin Registry & Configuration (`/settings/plugins`):**
     * Menggunakan `Institution.enabledPlugins` sebagai single source of truth.
     * Menyediakan toggle plugin terdaftar: `FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM`.
     * Plugin `CORE` dilindungi dan tidak dapat dinonaktifkan.
     * Prinsip zero-data-loss: penonaktifan plugin hanya menyembunyikan UI dan menegakkan error 403 di server, tanpa menghapus data historis domain. Mengaktifkan kembali langsung memulihkan akses data lama.
  4. **Dynamic Terminology Dictionary (`/settings/terminology`):**
     * Menyediakan preset terminologi otomatis sesuai jenis lembaga:
       * Pesantren: Santri, Santri (jamak), Wali Santri, Halaqah, Tahun Ajaran, Syahriah, Ustadz.
       * Sekolah Formal: Siswa, Siswa (jamak), Wali Murid, Kelas, Tahun Ajaran, SPP, Guru.
       * Rumah Tahfidz: Santri, Wali Santri, Halaqah, Tahun Ajaran, Infaq / Syahriah, Ustadz / Muhaffizh.
       * PKBM: Warga Belajar, Wali / Pendamping, Kelompok Belajar, Tahun Ajaran, Biaya Pendidikan, Tutor / Fasilitator.
     * Memungkinkan kustomisasi per istilah dengan fallback aman ke preset default. Terminologi hanya memengaruhi presentasi UI, bukan semantik database.
  5. **Operational Rules Settings (`/settings/operations`):**
     * Pengaturan presensi: batas menit keterlambatan (`lateThresholdMinutes`), kewajiban catatan kehadiran.
     * Pengaturan keuangan: prefix nomor kwitansi (`receiptNumberPrefix`), jatuh tempo tagihan (`invoiceDueDays`), catatan kaki kwitansi (`receiptFooterNote`).
     * Pengaturan komunikasi: saklar notifikasi WhatsApp outbox dan pemilihan provider tanpa menyimpan rahasia/kredensial API di database (kredensial tetap di `.env`).
     * Pengaturan akademik: KKM bawaan (`passingGradeDefault`) dan judul kop cetak raport.
  6. **User & Role Management (`/settings/users`):**
     * Daftar pengguna internal lembaga terisolasi tenant (`listManagedUsers`).
     * Pembaruan multi-role aman dari daftar 6 peran resmi (`ASSIGNABLE_ROLES`).
     * Pengaktifan/penonaktifan akun pengguna dengan pembatalan sesi instan (`Session.deleteMany`).
     * Perlindungan diri: pengguna tidak dapat menonaktifkan akun sendiri atau mencabut seluruh role admin dari dirinya sendiri.
  7. **Settings Layout & Hub (`/settings`):**
     * Halaman hub terpadu dengan kartu ringkasan untuk setiap seksi pengaturan.
     * Sub-navigasi responsif (tabs) dengan feedback status simpan/error dan target sentuh $\ge 44\text{px}$.
  8. **Automated Testing Suite (`test/institution-settings.test.ts`):**
     * 17 targeted tests komprehensif mencakup isolasi tenant, penegakan izin `institution:manage` dan `staff:manage`, pengalihan plugin aman, preset dan fallback terminologi, validasi aturan operasional, serta pencegahan mutasi role sepihak dan deaktivasi diri.
* **Testing & Verifikasi Milestone:**
  * 273 automated tests di 17 file test **PASS 100% (0 fail)**.
  * TypeScript typecheck (`npx tsc --noEmit`) **PASS 100% (0 errors)**.
  * Prisma schema validation (`npx prisma validate`) **VALID**.
  * Next.js production build (`npm run build`) **PASS 100% (39 static & dynamic routes compiled)**.

---

### [2026-09-23] - Milestone: Operational Admin Experience / Daily Operations (Operational Command Center, Perlu Perhatian, RBAC Quick Actions & Tenant Global Search) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Mentransformasikan NataSekolah dari sekadar kumpulan modul terisolasi menjadi Pusat Komando Operasional Harian (Operational Command Center) bagi admin/operator sekolah dan pondok, menjawab dengan cepat: apa yang perlu dikerjakan hari ini, apa yang belum selesai, ada masalah apa, dan data mana yang butuh perhatian.
* **Implementasi:**
  1. **Operational Dashboard Service (`src/lib/operations/dashboard-service.ts`):**
     * Mengagregasi metrik hari ini: jumlah siswa aktif, sesi presensi hari ini (dibuka vs ditutup, rekap hadir/sakit/izin/alpa), arus kas pembayaran hari ini & total tagihan aktif.
     * Plugin-aware: hanya memuat asesmen & raport jika `FORMAL_ACADEMIC` aktif, mutaba'ah tahfidz jika `TAHFIDZ` aktif, dan santri mukim asrama jika `PESANTREN_LIVING` aktif.
  2. **Section "Perlu Perhatian" (Operational Attention Aggregation):**
     * Mendeteksi sesi presensi gantung/belum ditutup (`AttendanceSession.status === "OPEN"`).
     * Mendeteksi pesan notifikasi WhatsApp outbox yang gagal terkirim (`NotificationOutbox.status === "FAILED"`).
     * Mendeteksi tagihan santri yang melewati batas jatuh tempo (`dueDate < now()`).
     * Mendeteksi asesmen akademik draf yang belum dipublikasikan (`isPublished: false`).
     * Mendeteksi rombel aktif yang belum memiliki penugasan guru pengajar (`TeacherAssignment`).
     * Mendeteksi buku raport semester yang masih berstatus `DRAFT`.
     * Setiap item memiliki severity, ringkasan jumlah, dan tombol direct action menuju halaman penyelesaian.
  3. **Aksi Cepat Terotorisasi (RBAC & Plugin Aware Quick Actions):**
     * Dihitung secara dinamis di server berdasarkan izin pengguna (`hasPermission`) dan plugin aktif (`isPluginEnabled`).
     * Menyediakan tombol aksi cepat: Tambah Siswa, Kelola Rombel, Catat Presensi, Input Nilai, Buat Tagihan, Catat Pembayaran, Buka Data Wali, Setoran Tahfidz, Kelola Asrama, dan Tinjau Outbox WA.
  4. **Pencarian Global Terisolasi Tenant (Global Search / Quick Navigation):**
     * `src/lib/operations/search-service.ts`: Query multi-entitas cepat (Siswa, NIS, NISN, Rombel, Guru/Staf, dan Wali Murid) dengan isolasi `institutionId` mutlak.
     * `src/components/global-search-dialog.tsx`: Modal dialog pencarian ramah keyboard (`Ctrl+K` / `Cmd+K`, Arrow Up/Down, Enter), responsif mobile dengan target sentuh $\ge 44\text{px}$.
  5. **Antarmuka Komando Operasional (`src/app/dashboard/page.tsx` & `src/components/nav-header.tsx`):**
     * NavHeader diperbarui dengan link Dashboard, tombol pencarian cepat, dan shortcut keyboard.
     * Default redirect post-login diperbarui menuju `/dashboard`.
  6. **Automated Testing (`test/operations-dashboard.test.ts`):**
     * 11 targeted tests komprehensif mencakup isolasi tenant dashboard, isolasi izin RBAC guru vs bendahara, pemfilteran quick action, penegakan plugin lembaga, deteksi item perhatian, dan isolasi tenant pada pencarian global.
* **Testing & Verifikasi Milestone:**
  * 256 automated tests di 16 file test **PASS 100% (0 fail)**.
  * TypeScript typecheck (`npx tsc --noEmit`): **PASS (0 error)**.
  * Prisma schema validation (`npx prisma validate`): **VALID 🚀**.
  * Next.js Production Build (`npm run build`): **PASS (33 routes compiled)**.

### [2026-09-23] - Phase 7: Parent Experience / Portal Wali (PWA Mobile-First, ReBAC Read Model, Frozen Report & Multi-Child) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun antarmuka terpadu wali murid (Portal Wali) berprinsip ReBAC (`GuardianStudent`), menghadirkan transparansi kehadiran, keuangan, mutaba'ah tahfidz, asrama, dan buku raport resmi berbasis frozen snapshot abadi.
* **Implementasi:**
  1. **Strict ReBAC Domain Read Service (`src/lib/guardian/portal-service.ts`):**
     * Penegakan otorisasi relasi via `assertGuardianStudentAccess` di setiap query domain.
     * Pencegahan manipulasi `studentId`, `guardianId`, atau `institutionId` dari sisi klien.
     * Layanan query: `getGuardianProfile`, `getGuardianChildren`, `getGuardianStudentOverview`, `getGuardianStudentAttendance`, `getGuardianStudentFinance`, `getGuardianStudentAcademic`, `getGuardianStudentReportCard`, `getGuardianStudentTahfidz`, `getGuardianStudentDormitory`, `getGuardianNotifications`.
  2. **Perlindungan Dokumen Raport (Draft Protection & Frozen Data):**
     * Raport berstatus `DRAFT` mutlak disembunyikan dari antarmuka wali.
     * Hanya raport `PUBLISHED` yang dapat diakses dengan membongkar snapshot `frozenData`.
  3. **PWA Shell & Mobile-First Nav (`src/components/guardian-nav.tsx`, `src/app/manifest.ts`):**
     * Standalone web app manifest dengan tema `#0f766e`.
     * Bottom navigation bar sticky mobile (< 430px) dengan target sentuh jempol $\ge 44\text{px}$.
     * Pemilih santri aktif (Child Selector) instan bagi wali dengan lebih dari 1 anak asuh.
  4. **Dedicated Portal Views (`src/app/wali/(portal)/*` & `/wali/aktivasi`):**
     * `/wali`: Dasbor utama ringkasan 6 domain + empty states.
     * `/wali/kehadiran`: Riwayat kehadiran akademik & living beserta persentase hadir.
     * `/wali/keuangan`: Tagihan, sisa kewajiban, dan riwayat transaksi kwitansi resmi.
     * `/wali/akademik`: Nilai penilaian harian dan daftar raport resmi.
     * `/wali/akademik/raport/[reportId]`: Tampilan resmi raport frozen snapshot ramah cetak.
     * `/wali/tahfidz`: Mutaba'ah tahfidz Al-Qur'an (ziyadah, muraja'ah, surah, ayat, kualitas).
     * `/wali/asrama`: Informasi kamar asrama, kapasitas, dan presensi malam santri mukim.
     * `/wali/notifikasi`: Log pesan WhatsApp outbox resmi ke nomor wali.
     * `/wali/aktivasi`: Halaman aktivasi akun wali via tautan/token undangan 1x pakai.
  5. **Automated Testing (`test/guardian-portal.test.ts`):**
     * 16 pengujian komprehensif mencakup ReBAC, penolakan santri tidak terhubung, penolakan cross-tenant, draft raport protection, scoping kehadiran, keuangan, tahfidz, asrama, notifikasi, dan isolasi total dari RBAC staf internal.
* **Testing & Verifikasi Milestone:**
  * 245 automated tests di 15 file test **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (32 routes compiled)**.

### [2026-09-23] - Phase 6: Pesantren & Tahfidz Living Core (Diniyah, Mutaba'ah, Asrama & Living Attendance) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun fondasi kepesantrenan meliputi kurikulum diniyah/kitab kuning, mutaba'ah tahfidz Al-Qur'an harian terikat enrollment historis, penempatan kamar asrama historis, dan presensi asrama berbasis single attendance engine.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * Model baru: `TahfidzRecord`, `Dormitory`, `DormitoryRoom`, `StudentDormitoryAssignment`.
     * Model perluasan: `AttendanceSession` diperkaya `context` (`ACADEMIC`/`LIVING`) dan `dormitoryRoomId` nullable dengan compound unique `@@unique([dormitoryRoomId, attendanceDate])`.
  2. **Diniyah / Pesantren Subject Integration:**
     * Memperluas `SUBJECT_CATEGORIES` di `src/lib/teaching/types.ts` dengan `DINIAH`, `KITAB`, `TAHSIN`, `TAJWID`, `AKHLAQ`, `FIQIH`, `AQIDAH`, `HADITS`, `LAINNYA` secara backward-compatible.
  3. **Tahfidz Mutaba'ah Core (`src/lib/tahfidz/*`):**
     * Metadata Al-Qur'an 114 surah dengan validasi jumlah ayat.
     * Service `createTahfidzRecord`, `getTahfidzRecordById`, `listTahfidzRecords`, `getTahfidzSummary`.
     * Integritas historis: record terikat pada `Student` dan `Enrollment` aktif saat setoran dilakukan.
     * Keamanan identitas: `recordedBy` diambil secara mutlak dari server session.
  4. **Dormitory Management & Assignment (`src/lib/dormitory/*`):**
     * Service `createDormitory`, `getDormitoryById`, `listDormitories`, `createDormitoryRoom`, `getDormitoryRoomById`, `assignStudentToRoom`, `endDormitoryAssignment`, `listDormitoryAssignments`.
     * Aturan bisnis: penolakan melebihi kapasitas kamar, larangan penempatan ganda aktif, dan pelestarian riwayat historis kamar (`status: ENDED`).
  5. **Living Attendance Integration (`src/lib/attendance/*`):**
     * Memperluas Attendance Core tanpa membuat engine kedua.
     * `createLivingAttendanceSession`, integrasi roster asrama dari `StudentDormitoryAssignment.status == "ACTIVE"`, pencatatan presensi `PRESENT`/`SICK`/`EXCUSED`/`ABSENT`, dan penutupan sesi yang memvalidasi kelengkapan absen seluruh penghuni kamar.
  6. **Mobile-First UI (`src/app/tahfidz/*`, `src/app/dormitories/*`):**
     * `/tahfidz`: Santri roster, feed mutaba'ah terbaru.
     * `/tahfidz/[studentId]`: Riwayat mutaba'ah santri, ringkasan ziyadah/muraja'ah, form setoran baru dengan validasi ayat.
     * `/dormitories`: Gedung asrama, progress bar keterisian kamar, modal tambah gedung & kamar.
     * `/dormitories/[id]`: Roster kamar, daftar penghuni aktif, modal penempatan santri, akhiri penempatan, dan tombol buka absensi asrama.
     * `NavHeader`: Penambahan tautan "Tahfidz" (`BookMarked`) dan "Asrama" (`Home`).
  7. **Automated Unit Testing (`test/tahfidz.test.ts`, `test/pesantren-living.test.ts`):**
     * 26 test baru (9 tahfidz tests + 17 pesantren living tests) mencakup seluruh skenario validasi ayat, enrollment matching, teacher identity, capacity constraint, assignment history, duplicate active assignment rejection, living attendance, dan tenant isolation.
* **Testing & Verifikasi Milestone:**
  * 229 automated tests di 14 file test **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (23 routes compiled)**.

### [2026-09-23] - Phase 5: Formal Academic Core (Assessment, Grading & Frozen Report Card) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun fondasi akademik formal meliputi penilaian (`Assessment`), pencatatan nilai per siswa (`AssessmentScore`), penghitungan agregat per mata pelajaran, dan penerbitan buku raport (`ReportCard` & `ReportCardSubject`) dengan pembekuan *historical frozen snapshot*.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * Tabel `assessments`, `assessment_scores`, `report_cards`, `report_card_subjects` terisolasi per `institutionId` dengan compound unique `@@unique([id, institutionId])`, `@@unique([assessmentId, studentId])`, dan `@@unique([enrollmentId, semester])`.
  2. **Zod Validation (`src/lib/validation/formal-academic.ts`):**
     * Skema input untuk pembuatan/pembaruan penilaian, pencatatan nilai single/batch, filter nilai, draf raport, dan penerbitan raport.
  3. **Domain Services (`src/lib/formal-academic/*`):**
     * `assessment-service.ts`: Pengelolaan rencana penilaian, penegakan teacher resource scope, dan tenant isolation.
     * `grade-service.ts`: Pengambilan roster siswa aktif pada enrollment penugasan, validasi rentang skor `0 <= score <= maxScore`, pencegahan cross-classroom & cross-year scoring, dan batch score upsert.
     * `calculation-service.ts`: Strategi kalkulasi nilai akhir per mata pelajaran teragregasi dan konversi predikat huruf (A/B/C/D).
     * `report-card-service.ts`: Pembuatan draf raport berjalan dan penerbitan raport dengan pembekuan data ke format `frozenData` (JSON snapshot). Raport yang telah berstatus `PUBLISHED` dilarang diterbitkan ulang atau dimutasi oleh perubahan nilai di masa mendatang.
  4. **Server Actions (`src/actions/formal-academic.ts`):**
     * 13 Server Actions terproteksi hak akses session, tenant isolation, dan RBAC (`academic:view`, `academic:manage`, `report:view`, `report:manage`).
  5. **Mobile-First UI (`src/app/assessments/*`, `src/app/grades/*`, `src/app/reports/*`):**
     * `/assessments`: Direktori penilaian, filter jenis & rombel, modal pembuatan penilaian.
     * `/assessments/[id]`: Roster pengisian nilai siswa interaktif, tombol simpan batch, indikator kelengkapan nilai.
     * `/grades`: Rekapitulasi nilai siswa per penilaian.
     * `/reports`: Dashboard raport, modal generate draf raport, modal pratinjau raport resmi dengan tombol "Terbitkan & Bekukan (Publish & Freeze)" serta layout ramah cetak (`window.print()`).
     * `NavHeader`: Penambahan tautan ke `/assessments` ("Penilaian") dan `/reports` ("Raport").
  6. **Automated Unit Testing (`test/formal-academic.test.ts`):**
     * 13 automated tests mencakup Assessment CRUD, teacher scope, tenant isolation, score range validation, cross-classroom rejection, batch scoring, subject calculation, draf raport, snapshot immutability, dan penolakan double publishing.
* **Testing & Verifikasi Milestone:**
  * 203 automated tests di 11 file test **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100%**.

### [2026-09-23] - Phase 4: Finance Core (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun core keuangan terisolasi per tenant meliputi master `FeeCategory`, kewajiban tagihan `StudentCharge` (historical snapshot), transaksi penerimaan `PaymentTransaction`, alokasi pembayaran `PaymentAllocation`, Buku Kas Umum `CashbookEntry`, dan penomoran kwitansi atomis `Receipt`.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * Tabel `fee_categories`, `student_charges`, `payment_transactions`, `payment_allocations`, `cashbook_entries`, `receipts` terikat pada `institutionId` dengan compound unique index `@@unique([paymentTransactionId, institutionId])`.
  2. **Zod Validation (`src/lib/validation/finance.ts`):**
     * Skema input untuk FeeCategory, StudentCharge, BulkCharge, PaymentTransaction, PaymentAllocation, CashbookEntry, dan Receipt query.
  3. **Domain Services (`src/lib/finance/*`):**
     * `fee-category-service.ts`, `charge-service.ts`, `cashbook-service.ts`, `receipt-service.ts`, dan `payment-service.ts`.
     * `payment-service.ts` mengeksekusi pembuatan transaksi pembayaran, alokasi tagihan, pembaruan status `UNPAID` -> `PARTIAL` -> `PAID`, pembuatan kas masuk `INCOME`, dan penerbitan `Receipt` dalam 1 `$transaction` Prisma atomis.
  4. **Server Actions (`src/actions/finance.ts`):**
     * 18 Server Actions terproteksi session, tenant isolation, dan RBAC (`finance:view`, `finance:manage`).
  5. **Mobile-First UI (`/finance/*`):**
     * `/finance` (Dashboard Keuangan), `/finance/fees` (Master Tarif), `/finance/charges` (Tagihan Siswa), `/finance/payments` (Kasir & Kwitansi), `/finance/cashbook` (Buku Kas Umum / BKU).
  6. **Automated Unit Testing (`test/finance-core.test.ts`):**
     * 7 suite test menguji snapshot nominal, alokasi atomis, penolakan over-allocation, perlindungan tagihan `VOID`, otomatisasi BKU & kwitansi, dan isolasi tenant.
* **Testing & Verifikasi Milestone:**
  * 190 automated tests di 10 file test **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (18 routes terkompilasi)**.

### [2026-09-23] - Phase 4: Communication Engine (WhatsApp Outbox Pattern & Gateway Abstraction) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun antrean pesan `NotificationOutbox` terisolasi per tenant dengan *exponential backoff retry*, abstraksi provider (DeepLink, Fonnte, WAHA), serta penanganan event domain (Presensi, Pembayaran SPP, Undangan Wali) yang tidak menggagalkan transaksi bisnis utama jika gateway pihak ketiga mengalami kendala.
* **Implementasi:**
  1. **Prisma Relational Hardening (`NotificationOutbox`):**
     * Tabel `notification_outbox` terisolasi per `institutionId` dengan compound unique key `@@unique([id, institutionId])`, status (`PENDING`, `PROCESSING`, `DELIVERED`, `FAILED`, `CANCELLED`), tracking `attempts`, `maxAttempts`, `lastAttemptAt`, `nextRetryAt`, `providerId`, dan `externalId`.
     * Menambahkan relasi `notificationOutbox` pada model `Institution`.
  2. **Zod Validation (`src/lib/validation/notification.ts`):**
     * Sanitizer otomatis nomor seluler Indonesia (`sanitizeIndonesianPhone`: format `628...`).
     * Skema `queueNotificationInputSchema`, `notificationFilterSchema`, `whatsappProviderConfigSchema`.
  3. **Gateway Abstraction Layer (`src/lib/notification/providers/*`):**
     * Interface `IWhatsAppProvider`.
     * Provider `DeepLinkWhatsAppProvider` (bebas biaya/offline `https://wa.me/...`).
     * Provider `FonnteWhatsAppProvider` (Fonnte API Gateway).
     * Provider `WahaWhatsAppProvider` (WAHA HTTP API Gateway).
     * Factory `getWhatsAppProvider()`.
  4. **Outbox Domain Service & Event Helpers (`src/lib/notification/*`):**
     * `templates.ts`: Renderer template notifikasi (`PAYMENT_RECEIPT`, `ATTENDANCE_ALERT`, `GUARDIAN_INVITE`, `ANNOUNCEMENT`).
     * `outbox-service.ts`: `queueNotification`, `processOutboxQueue` (exponential backoff retry `2^attempts * 60s`), `listOutboxNotifications`, `cancelNotification`.
     * `events.ts`: Event helpers `notifyPaymentCompleted`, `notifyAttendanceAlert`, `notifyGuardianInvitation`.
  5. **Server Actions & Mobile-First UI (`/notifications`):**
     * Server actions di `src/actions/notification.ts`.
     * Antarmuka `/notifications`: Dashboard pemantauan antrean outbox, pencarian nomor/pesan, filter status, pemroses antrean latar belakang manual, tombol WA DeepLink langsung.
     * `NavHeader`: Penambahan tautan terpadu ke `/notifications` dengan ikon `MessageSquare`.
* **Testing & Verifikasi Milestone:**
  * 183 automated tests di 9 file test (`test/communication-engine.test.ts` + 8 file test sebelumnya) **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (Turbopack, 13 routes terkompilasi)**.

### [2026-09-20] - Phase 3: Attendance Core (AttendanceSession, AttendanceRecord, Sacred Enrollment, Immutability) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun sistem absensi harian yang bersumber dari **Enrollment + TeacherAssignment**, tenant-safe, teacher-scoped, dan memiliki histori yang dapat dipertanggungjawabkan tanpa menyimpan status kehadiran statis pada `Student`.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * `AttendanceSession`: Sesi presensi harian per penugasan guru dan tanggal kalender akademik (`@@unique([teacherAssignmentId, attendanceDate])`), status `OPEN` dan `CLOSED`, compound foreign keys ke `TeacherAssignment([teacherAssignmentId, institutionId])`.
     * `AttendanceRecord`: Rekaman kehadiran siswa menyimpan `studentId` DAN `enrollmentId` sekaligus (`@@unique([attendanceSessionId, studentId])`), compound foreign keys ke `AttendanceSession`, `Student`, dan `Enrollment`.
     * Menambahkan relasi `attendanceSessions` dan `attendanceRecords` pada entitas `Institution`, `TeacherAssignment`, `Student`, dan `Enrollment`.
  2. **Zod Validation (`src/lib/validation/attendance.ts`):**
     * `createAttendanceSessionInputSchema`, `markAttendanceInputSchema`, `markAttendanceBatchInputSchema`, `closeAttendanceSessionInputSchema`, `attendanceQuerySchema`.
  3. **Domain Services (`src/lib/attendance/*`):**
     * `session-service.ts`: `createAttendanceSession`, `getAttendanceSession`, `listAttendanceSessions`, `closeAttendanceSession`.
     * `record-service.ts`: `getAttendanceRoster`, `markAttendance`, `markAttendanceBatch`, `getAttendanceRecords`.
     * Menegakkan normalisasi tanggal UTC midnight (`normalizeAttendanceDate`) untuk mencegah timezone shift bug.
  4. **Domain Invariants & Immutability:**
     * Roster presensi diturunkan secara eksklusif dari siswa yang terdaftar aktif (`status: "ENROLLED"`, `Student.status: "ACTIVE"`) pada rombel dan tahun ajaran penugasan. Siswa dari rombel atau tahun ajaran lain ditolak keras (`InvalidAttendanceContextError` 400).
     * Immutability Sesi Tertutup: Setelah sesi berstatus `CLOSED`, seluruh penulisan record ditolak permanen (`AttendanceSessionClosedError` 400).
     * Kelengkapan Presensi: Penutupan sesi mensyaratkan 100% siswa eligible telah memiliki catatan kehadiran (`AttendanceIncompleteError` 400).
     * Resource Scope Guru: Guru (`TEACHER`) hanya boleh melihat, membuka, mengisi, dan menutup sesi untuk penugasan miliknya sendiri (`teacherId = session.userId`). Upaya mengakses sesi guru lain ditolak instan (`AttendanceAccessDeniedError` 403).
  5. **Antarmuka Mobile-First & Server Actions:**
     * `/attendance`: Tampilan presensi guru harian, seleksi tanggal, kartu penugasan, pembukaan sesi, pengisian cepat satu-per-satu atau bulk ("Tandai Semua Hadir"), penutupan sesi dengan dialog konfirmasi immutability, catatan kehadiran per siswa.
     * `/attendance/history`: Histori sesi absensi dengan filter status dan rentang tanggal, modal rincian presensi siswa.
     * `NavHeader`: Penambahan tautan terpadu ke `/attendance` dengan ikon `ClipboardCheck`.
* **Testing & Verifikasi:**
  * 176 automated tests di 8 file test (`test/attendance-core.test.ts` + 7 file test sebelumnya) **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (Turbopack, seluruh 11 routes terkompilasi)**.

### [2026-09-20] - Phase 2: Academic Teaching Core (Subject, Teacher & Teaching Assignment) (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun fondasi hubungan: $\text{Teacher} \rightarrow \text{TeacherAssignment} \rightarrow (\text{Subject}, \text{Classroom}, \text{AcademicYear})$ sehingga sistem mengetahui secara presisi: *Guru siapa mengajar mata pelajaran apa, di rombel mana, pada tahun ajaran mana*, tanpa menduplikasi sistem otentikasi.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * `Subject`: Model katalog mata pelajaran terisolasi per tenant dengan `@@unique([institutionId, code])`, `isActive`, dan kategori (`UMUM`, `AGAMA`, `MULOK`, `PEMINATAN`).
     * `User` (Teacher): Menggunakan identitas internal `User` yang sudah ada dengan peran `TEACHER` tanpa model auth/login kedua. Menambahkan `@@unique([id, institutionId])`.
     * `TeacherAssignment`: Memetakan kuartet `[teacherId, subjectId, classroomId, academicYearId]` dengan `@@unique([teacherId, subjectId, classroomId, academicYearId])`.
     * Relasi compound foreign keys ketat: `teacher User @relation([teacherId, institutionId])`, `subject Subject @relation([subjectId, institutionId])`, `academicYear AcademicYear @relation([academicYearId, institutionId])`, `classroom Classroom @relation([classroomId, academicYearId, institutionId])`. Mencegah mismatch tahun ajaran rombel fisik dan penugasan lintas-lembaga di level PostgreSQL.
  2. **Zod Validation (`src/lib/validation/teaching.ts`):**
     * `createSubjectInputSchema`, `updateSubjectInputSchema`, `subjectFilterSchema`.
     * `createTeacherAssignmentInputSchema`, `updateTeacherAssignmentInputSchema`, `teacherAssignmentFilterSchema`.
  3. **Domain Services (`src/lib/teaching/*`):**
     * `subject-service.ts`: `createSubject`, `updateSubject`, `listSubjects`, `getSubject`.
     * `teacher-service.ts`: `listTeachers`, `getTeacher` (memfilter user dengan role `TEACHER`, menyembunyikan password hash).
     * `assignment-service.ts`: `createTeacherAssignment`, `updateTeacherAssignment`, `deleteTeacherAssignment`, `listTeacherAssignments`, `getTeacherAssignments`, `assertTeacherAssignmentAccess`.
  4. **Teacher Resource Scope Enforcement:**
     * Guru murni (`TEACHER` tanpa `academic:manage`) hanya dapat melihat dan mengakses penugasan miliknya sendiri (`teacherId = session.userId`). Upaya mengueri atau mengubah penugasan guru lain ditolak instan (`TeacherAssignmentAccessDeniedError` 403).
  5. **Antarmuka Minimal Mobile-First:**
     * `/subjects`: Katalog mapel, pencarian realtime, filter status, modal tambah/edit mapel, empty/loading/error state.
     * `/teachers`: Direktori guru lembaga, status aktif, jumlah rombel diampu.
     * `/teacher-assignments`: Matriks penugasan mengajar, filter 4 dimensi (T.A, Guru, Mapel, Rombel), modal penugasan baru dengan sinkronisasi rombel berbasis tahun ajaran terpilih, pembatalan penugasan.
     * `NavHeader`: Penambahan tautan terpadu ke `/subjects`, `/teachers`, `/teacher-assignments`.
* **Testing & Verifikasi:**
  * 155 automated tests di 7 file test (`test/teaching-core.test.ts` + seluruh test suite Phase 0 dan Phase 1) **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (Turbopack, seluruh 9 routes terkompilasi)**.

### [2026-09-20] - Phase 1: Buku Induk & Academic Core (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun fondasi master data peserta didik (Buku Induk) dan struktur akademik (Tahun Ajaran, Rombel, Enrollment) dengan prinsip sakral: *Student tidak boleh memiliki `classroomId` langsung, penempatan kelas wajib melalui entitas Enrollment*.
* **Implementasi:**
  1. **Prisma Relational Hardening:**
     * `Student`: Model identitas kesiswaan mandiri tanpa kolom `classroomId`. Menambahkan `nis` (`@@unique([institutionId, nis])`), status enum typed constants (`ACTIVE`, `INACTIVE`, `GRADUATED`, `TRANSFERRED`, `ALUMNI`), `nik`, `birthPlace`, `birthDate`, `religion`, `address`, `phone`, `email`.
     * `AcademicYear`: Mendukung `isActive` boolean (hanya 1 tahun ajaran aktif per institusi via transaksi atomik).
     * `Classroom`: Terikat pada `academicYearId` dan institusi induk (`institutionId`).
     * `Enrollment`: Menghubungkan `studentId`, `academicYearId`, dan `classroomId` dengan `@@unique([studentId, academicYearId])` dan compound foreign keys ganda `[studentId, institutionId]`, `[academicYearId, institutionId]`, serta `[classroomId, academicYearId, institutionId]`.
  2. **Zod Validation (`src/lib/validation/student.ts` & `academic.ts`):**
     * Skema validasi untuk create/update student, filter pencarian (NIS/NISN/Nama), arsip siswa, pembuatan tahun ajaran, pembuatan rombel, dan enrollment siswa.
  3. **Domain Services (`src/lib/academic/*`):**
     * `student-service.ts`: `createStudent`, `updateStudent`, `getStudent`, `listStudents`, `archiveStudent`.
     * `academic-year-service.ts`: `createAcademicYear`, `setActiveAcademicYear`, `listAcademicYears`, `getAcademicYear`.
     * `classroom-service.ts`: `createClassroom`, `listClassrooms`, `getClassroom`.
     * `enrollment-service.ts`: `enrollStudent`, `updateEnrollment`, `getStudentEnrollments`, `getCurrentEnrollment`.
  4. **Server Actions Layer (`src/actions/academic.ts`):**
     * Alur otorisasi 6 tingkat: $\text{UI} \rightarrow \text{Server Action} \rightarrow \text{Zod} \rightarrow \text{Session} \rightarrow \text{Tenant} \rightarrow \text{RBAC} \rightarrow \text{Domain Service} \rightarrow \text{Prisma}$.
  5. **Antarmuka Minimal Mobile-First:**
     * `/students`: Daftar siswa, search bar multi-kriteria, filter status, paginasi, modal tambah siswa, empty state, loading state, error state.
     * `/students/[id]`: Profil Buku Induk lengkap, banner rombel tahun aktif, riwayat penempatan kelas multi-tahun (Sacred History timeline), modal mutasi kelas / enrollment, modal arsip status.
     * `/academic-years`: Daftar tahun ajaran, badge tahun aktif, tombol pengaktifan satu sentuhan, modal tambah tahun ajaran.
     * `/classrooms`: Daftar rombel per tahun ajaran, kapasitas, jumlah siswa terdaftar, modal tambah rombel.
     * `src/components/nav-header.tsx`: Navigasi tab responsif dengan touch target $\ge 44$px.
* **Testing & Verifikasi:**
  * 126 automated tests di 6 file test (`test/academic-core.test.ts`, `test/validation-plugins.test.ts`, `test/rbac-fine-grained.test.ts`, `test/identity-access.test.ts`, `test/auth-session.test.ts`, `test/tenant-isolation.test.ts`) **PASS 100% (0 fail)**.
  * `npx tsc --noEmit` **0 Error**.
  * `npx prisma validate` **Valid 🚀**.
  * `npm run build` **Sukses 100% (Turbopack, seluruh 6 routes terkompilasi)**.

### [2026-09-20] - Phase 0.3: Input Validation & Domain Plugin Registry (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menegakkan validation boundary menggunakan Zod dan membangun Plugin Registry sebagai fondasi modular NataSekolah.
* **Hasil:** 105 automated tests PASS, Zod sanitization aktif, 4 domain plugins (`FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM`).

### [2026-09-20] - Phase 0.2: Fine-Grained RBAC for Internal Users (IMPLEMENTED & VERIFIED)
* **Tujuan:** Membangun lapisan otorisasi server-side granular dengan 6 peran resmi internal lembaga.
* **Hasil:** 83 automated tests PASS, matrix permission terpusat, proteksi anti-tampering.

### [2026-09-20] - Phase 0.1A: Identity & Access Model (HARDENED & VERIFIED)
* **Tujuan:** Memisahkan identitas staf internal (RBAC) dan wali murid (ReBAC), menyatukan model sesi polimorfik.
* **Hasil:** 59 automated tests PASS, compound foreign keys aktif di PostgreSQL level.

### [2026-09-20] - Phase 0.1: Authentication & Session Foundation (IMPLEMENTED / VERIFIED)
* **Tujuan:** Autentikasi kredensial dan manajemen sesi aman berbasis database.
* **Hasil:** 31 automated tests PASS, bcryptjs, opaque session token sha256.

---

## 3. Langkah Selanjutnya (Next Immediate Gate)
1. **Phase 2 Gate — Daily Operations:**
   * Attendance Engine (< 60 detik) & offline cache idempotency.
   * Finance 3-Tier Layer (FeeCategory, StudentCharge, PaymentTransaction).
   * Cashbook & Unique Receipt Generator (`KW-...`).
   * Operational Dashboard berbasis aksi pengguna.
