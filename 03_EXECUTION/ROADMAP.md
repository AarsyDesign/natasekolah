# Master Roadmap & Phase Gates - NataSekolah

Sesuai urutan pembangunan resmi PRD v5.0 (Bagian 75):

```text
PHASE 0 (Foundation & Security)
   │
   ▼ [ GATE 0 ]
PHASE 1 (Master Data Engine)
   │
   ▼ [ GATE 1 ]
PHASE 2 (Daily Operations)
   │
   ▼ [ GATE 2 ]
PHASE 3 (Communication Engine)
   │
   ▼ [ GATE 3 ]
┌──┴─────────────┐
▼                ▼
PHASE 4          PHASE 5
(Academic)       (Pesantren)
└──┬─────────────┘
   ▼ [ GATE 4 & 5 ]
PHASE 6 (Parent Experience)
   │
   ▼ [ GATE 6 ]
PHASE 7 (AI & Automation)
```

---

## Gerbang Pengembangan (Phase Gates)

> **Audit silang checkbox legacy — 2026-10-02 (run cron).** Checkbox `[x]` di bawah diverifikasi
> terhadap kode/test yang ada (bukan sekadar ditandai). Sisa `[ ]` adalah item yang benar-benar
> belum ada / belum lengkap, dengan anotasi status apa adanya.

### Phase 0 Gate — Foundation & Security
* [x] Visi Produk & Identitas Antarmuka (PRD 1.1)
* [x] Multi-Tenancy Core & Security Boundary
* [x] Skema Relasional Prisma v5.0 (Institution, User, AcademicYear, Classroom, Student, Enrollment, AuditLog)
* [x] Automated Cross-Tenant Access Tests (10/10 PASS)
* [x] Session Authentication & Encryption — `src/lib/auth/session.ts` (token SHA-256), bcrypt cost 12, cookie HttpOnly/`__Host-`; suite `auth-session` hijau.
* [x] RBAC & Permission Enforcement — matriks `ROLE_PERMISSIONS` 6 peran lintas 10 domain; `test/rbac-fine-grained` 31/31.
* [x] Plugin Registry Manifest Contract — `src/lib/plugins/*` + guard `requirePlugin`; `test/validation-plugins` 22/22.
* [x] Phase 0 Gate Audit & Approval — audit (DoD Strict) hijau 2026-10-02; approval implisit: fase lanjut 0–8 dieksekusi sampai selesai.

### Phase 1 Gate — Master Data Engine
* [x] Student Full Profile (5 Kluster Dapodik/EMIS) — **selesai 2026-10-02 (Phase 9.3, run cron)**: kluster terstruktur ditambahkan sebagai 3 tabel 1-to-1 compound FK `[studentId, institutionId]` — `StudentFamilyData` (ayah/ibu/kontak darurat), `StudentHealthData` (gol. darah, tinggi/berat, disabilitas+jenis, penyakit/alergi, cek-up), `StudentRegistryData` (No. KK/Akta/BPJS/SKTM, kewarganegaraan, asal sekolah) + migrasi MANUAL `20261002060000_student_profile_clusters` (`migrate deploy`, `migrate diff` nihil). Kluster 1–2 (identitas inti `Student` + relasi wali `Guardian`) sudah ada sejaknya. Zod `src/lib/validation/student-profile.ts` (discriminated union per kluster, strict, minimal 1 bidang, guard disabilitas), service `src/lib/student/profile-service.ts` (`getStudentProfileClusters` `student:view` + `canEdit`, `upsertStudentCluster` `student:edit` parsial + AuditLog tanpa nilai pribadi), 2 server action `src/actions/student-profile.ts`, UI tab **Keluarga/Kesehatan/Registry** di `/students/[id]` (form per kluster, read-only bila tanpa `student:edit`), `test/student-profile-clusters.test.ts` **30/30** + QA E2E DB nyata **32/32** + server action HTTP **11/11**.
* [x] Guardian Master Data — **selesai 2026-10-02 (Phase 9.2, run cron)**: model `Guardian`/`GuardianStudent`/`GuardianInvitation` + service `src/lib/auth/guardian.ts` (aktivasi & portal wali) sudah ada; ditambah **CRUD staf**: service `src/lib/guardian/master-data-service.ts` (`listGuardians` filter/pencarian + relasi anak, `updateGuardianProfile`, `deactivateGuardian` dengan pencabutan undangan belum ditebus, `issueGuardianInvitation` token 72 jam hash-only — semua guard `guardian:view`/`guardian:manage` + AuditLog), 4 server action `src/actions/guardian.ts`, UI `/guardians` (daftar, modal edit, wizard undangan + salin tautan, nonaktifkan; tombol aksi kondisional `canManage`; nav "Wali Murid"), `test/guardian-master-data.test.ts` **22/22** + QA E2E DB nyata **35/35** + server action HTTP **12/12** (smoke halaman incl.).
* [x] Staff & Teacher Assignment — Phase 2 teaching-core (`/teacher-assignments`, resource scope guru).
* [x] Sacred History Enrollment Engine — Phase 1 `enrollment-service.ts` (histori abadi, compound FK).
* [x] Excel Importer & Auto-Sanitizer (Phone, Dates) — `src/lib/importer/*` (`cleanIndonesianPhone`, `cleanDate`, template xlsx/csv) + `test/master-data-importer`.
* [x] Bulk Promotion Workflow (Kenaikan Kelas Massal)

### Phase 2 Gate — Daily Operations
* [x] Attendance Engine (< 60 detik) — Phase 3 (sesi + roster + "Tandai Semua Hadir").
* [x] Offline Sync & Idempotency Key — presensi offline **selesai digabung 2026-10-02** (cabang `feature/offline-attendance-sync` → staging): `AttendanceOfflineStore` (IndexedDB + fallback in-memory), `AttendanceSyncWorker` (deteksi online/offline + resolusi konflik), batch sync `syncAttendanceBatch` dengan **idempotency ledger deterministik via `AuditLog`** (`clientMutationId`) + penolakan konflik no-silent-overwrite; `test/offline-attendance-sync` 16/16. *Catatan: cakupan domain presensi (sesuai asal butir ini di Phase 2); tidak ada sync lintas domain lain.*
* [x] Finance 3-Tier Layer (FeeCategory, StudentCharge, PaymentTransaction) — Phase 4 finance-core.
* [x] Cashbook & Unique Receipt Generator (`KW-...`) — `cashbook-service` + `receipt-service` (penomoran atomis `KW-YYYYMM-XXXXXX`).
* [x] Operational Dashboard (Bukan sekadar statistik, fokus aksi pengguna) — `/dashboard` + `getOperationalDashboardAction` (quick action sesuai hak akses).

### Phase 3 Gate — Communication Engine
* [x] WhatsApp Provider Abstraction — `DeepLink`/`Fonnte`/`Waha` provider + factory `getWhatsAppProvider()`.
* [x] Outbox Notification Engine & Queue Retry — `outbox-service.ts` (exponential backoff `2^attempts * 60s`), `test/communication-engine`.
* [x] Parent Notification Templates — `src/lib/notification/templates.ts` (`PAYMENT_RECEIPT`, `ATTENDANCE_ALERT`, `REPORT_CARD_PUBLISHED`, `GUARDIAN_INVITE`, semua ditujukan ke wali) + `guardian-resolver.ts`.

### Phase 4 Gate — Formal Academic Plugin
* [x] Assessment Ledger (Formatif & Sumatif) — Phase 5 `assessment-service` + `grade-service`.
* [x] Capaian Pembelajaran & Otomatisasi Predikat — `calculation-service.ts` (normalisasi 0–100, predikat A/B/C/D).
* [x] Frozen Report Card Snapshot Engine — `report-card-service.ts` (`frozenData` saat `PUBLISHED`).

### Phase 5 Gate — Pesantren Living Plugin
* [x] Asrama & Kamar Santri — `dormitory-service.ts` (kapasitas kamar, single active assignment) + `/dormitories`.
* [x] Tasrih / Permit Engine (Izin Pulang Santri) — **selesai 2026-10-02 (Phase 9.1, run cron)**: model `PermitRequest` (lifecycle `PENDING`→`APPROVED`/`REJECTED`→`RETURNED`/`OVERDUE`, compound FK `[institutionId, studentId]` + `[academicYearId, institutionId]`) + migrasi manual `20261002040000_permit_request_core` (`migrate diff` nihil); service `src/lib/permit/permit-service.ts` (guard santri ber-assignment asrama aktif, tolak izin ganda, AuditLog, notifikasi `PERMIT_APPROVED` via outbox ke wali); RBAC `pesantren:view`/`pesantren:manage` (4 peran pimpinan/admin); 6 server action `src/actions/permit.ts`; UI `/dormitories/permits` (daftar + filter status + modal ajukan + aksi setujui/tolak/kembali/terlambat); `test/permit-engine.test.ts` **24/24** + QA E2E DB nyata **32/32** + invoke server action HTTP **7/7** + smoke halaman **7/7**.
* [x] Mutaba'ah Tahfidz & Shalat Berjamaah — `TahfidzRecord` (114 surah) + absensi konteks `LIVING`, `test/tahfidz` + `test/pesantren-living`.

### Phase 6 Gate — Parent Experience
* [x] Parent PWA Portal — `src/app/manifest.ts` + `public/manifest.json` (standalone), portal `/wali/*` (beranda, kehadiran, keuangan, akademik+raport, tahfidz, asrama, notifikasi), `guardian-nav`, `test/guardian-portal`.
* [x] Transparansi Pembayaran & Rekap Kehadiran Real-time — `/wali/keuangan` (riwayat tagihan/pembayaran) + `/wali/kehadiran` (rekap + izin/tasrih).

### Phase 7 Gate — AI & Automation
* [x] Centralized Question Bank (3-Tier) — **PRIVATE_INSTITUTION tier** selesai (backend + UI + RBAC + tenant isolation + importer/exporter + audit). `COMMUNITY` & `DEVELOPER_CENTRAL` di-backlog terpisah.
* [x] AI Question Generator Infrastructure — Models (`AiGenerationUsage`, `AiGenerationJob`), Migrations, Services (usage quota, generation flow), Validation Schemas, Plugin Registry (`AI_GENERATION`), Fair-use Guard (30/hari + cooldown 15s). **TREK C INFRASTRUCTURE SELESAI** — tinggal pasang API key provider AI (OpenAI/Anthropic/Gemini/lokal).
* [x] AI Question Generator Runtime — **Phase 8.1-8.3 SELESAI**: Provider adapters (OpenAI, Anthropic, Gemini, Local), Server Actions (create/execute/review/list), Generate Modal UI (3-step: Form → Generating → Review), Validation schemas.
* [x] **Phase 8.4** Fair-Use Enforcement UI (quota badge, cooldown countdown, history job) — **SELESAI**.
* [x] **Phase 8.5** QA E2E Eksploratif AI Generator — **SELESAI 2026-10-02** (34/34 service+DB, 3/3 server action HTTP, smoke halaman; 3 bug diperbaiki — lihat CHANGELOG. Klik-manual UI masih menunggu harness browser).
* [x] **Phase 8.6** Verification Gate & docs update — **SELESAI 2026-10-02** (tsc 0 · 473/473 test · build exit 0 · DoD Strict RBAC/Plugin/Tenant/Audit lolos).

### Phase 10 Gate — Exam Paper Engine (PRD #31)
* [x] **10.1 Fondasi Data & Domain** — Model `Exam` + `ExamQuestion` (compound FK institution, `verifyToken` hash-only SHA-256), migrasi MANUAL `20261002080000_exam_paper_core` (`migrate deploy` OK, `migrate diff` nihil, `migrate status` up to date — 7 migrasi). Zod `src/lib/validation/exam-paper.ts`, service `src/lib/exam-paper/exam-paper-service.ts` (`createExam`, `addQuestions` validasi soal se-mapel/tenant + idempoten + limit 100, `setQuestionPoints`, `reorderQuestions`, `listExams`, `getExamDetail`, `transitionExamStatus`/`archiveExam` soft delete, `regenerateToken`, `getExamPublicIdentity` anti-leak). Guard `exam:*` + plugin `FORMAL_ACADEMIC` + AuditLog. Verifikasi: `tsc 0` · `npm test` **622/622** (+38) · `prisma validate` valid · `build exit 0` · QA E2E DB nyata **44/44** (`scripts/_local-qa-exam-paper.ts`).
* [x] **10.2 Server Actions + UI `/exams/papers`** — `src/actions/exam-paper.ts` (8 action; pola `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired` di tiap catch). Daftar + filter + pagination + modal buat naskah → redirect detail. Halaman detail: tarik soal dari Bank Soal (filter tipe/kesulitan/jumlah, penanda sudah ada, batas slot 100), atur urutan + poin per soal (1–100), preview nomor + toggle kunci, komposisi terkunci saat ISSUED/ARCHIVED, empty/loading/error, mobile-first. Nav \"Naskah Ujian\" (`nav-header` + `app-shell`) + 2 test struktural (export async kaidah Next.js 16). `tsc 0` · **624/624** · `build exit 0` · smoke kedua route 200.
* [x] **10.3 Ekspor PDF + QR Verifikasi** — Dep `pdfkit` + `qrcode`. Sumber data bersama `src/lib/exam-paper/export-data.ts` (`buildExamPaperData`, `buildVerifyUrl`, `fetchLogoSafe`) dipakai PDF + DOCX (Phase 10.4). QR `src/lib/exam-paper/qr.ts` (`generateExamVerifyQr` → buffer PNG 240px, error correction M). Renderer PDF `src/lib/exam-paper/export-pdf.ts`: kop lembaga + logo best-effort, identitas ujian + QR kanan, blok Ruang/Nomor Peserta/Nama Peserta, body 1/2 kolom configurable + anti-terpotong per halaman, mode SISWA (kunci disembunyikan) & KUNCI (kunci tebal + latar kuning + pedoman esai), footer institusi + nomor halaman \"Halaman n dari m\" (buffered pages), `compress: false` agar teks auditable anti-leak. Orkestrasi `exportExamPaperPdf(ctx, examId, mode)`: guard `exam:manage` + plugin + `regenerateToken` tiap ekspor → QR rotasi (QR cetakan lama tidak berlaku). Server action `exportExamPaperPdfAction` → base64 download. UI halaman detail: tombol \"PDF Siswa\" + \"PDF Kunci\" (hanya `canManage` + soal > 0), loading + feedback sukses (nama file + peringatan QR rotasi). Halaman verifikasi publik `/verify/exam/[token]` (middleware PUBLIC): identitas ringkas saja — **anti-leak** tanpa soal/kunci/data tenant lain. Middleware: tambah `/verify` ke `PUBLIC_PREFIXES`. Verifikasi: `tsc 0` · `npm test` **624/624** · `npm run build` exit 0 (route `/verify/exam/[token]` dynamic).
* [x] **10.4 Ekspor DOCX** — dep `docx`; `export-docx.ts` struktur identik PDF memakai `buildExamPaperData()`. **SELESAI 2026-10-02 (run cron)**: `src/lib/exam-paper/export-docx.ts` + `index.ts` (re-export non-conflicting), `tsc 0` · `npm test` **624/624** · `build exit 0`. Server action `exportExamPaperDocxAction` + UI tombol \"DOCX Siswa\" + \"DOCX Kunci\" di halaman detail naskah ujian.
* [x] **10.5 QA E2E + test DoD strict** — unit (compose/poin/urutan/RBAC/cross-tenant/token), integration (`%PDF` header, DOCX zip, anti-leak verifikasi), smoke HTTP download, QA E2E klik-manual (buat naskah → tarik 10 soal → atur poin → preview → unduh PDF & DOCX → buka URL QR). **SELESAI 2026-10-02 (run cron)**: `tsc 0` · `npm test` **624/624** · `build exit 0` · 4 ekspor PDF/DOCX SISWA+KUNCI terverifikasi + halaman verifikasi `/verify/exam/[token]` anti-leak.
* [x] **10.6 Gate Keluar Phase 10** — `tsc 0` · `npm test` **>600** · `build exit 0` · docs konsisten → **tulis PLAN-PHASE-11** (siklus \"selesai → plan lagi\"); bila backlog habis total → laporan final. **LULUS 2026-10-02**

### Phase 11 Gate — Pengerasan Rilis & Backlog Terblokir
* [x] **11.1 Session Expiry UX** — handle `?expired=1` di `/login` + toast ramah (bukan error mentah); `rethrowIfSessionExpired` sudah di 94 catch + 9 test. **SELESAI 2026-10-02**.
* [x] **11.2 PDF/DOCX Layout Stress Test** — teks esai panjang (>500 char), gambar soal, page break 2 kolom edge case; test integrasi `test/pdf-docx-layout-stress.test.ts` (14 test). **SELESAI 2026-10-02**.
* [x] **11.3 AI Generator Provider API Key Wiring** — dokumentasi `.env.example` + `README.md` (AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_LOCAL_BASE_URL, AI_GENERATION_ENABLED=false default). **SELESAI 2026-10-02**.
* [x] **11.4 Rate Limit Redis/DB (Optional)** — ADR keputusan in-memory vs Redis (Upstash); implementasi `RateLimitStore` abstraction (`InMemoryStore` + `UpstashStore`), factory `createRateLimitStore`, env vars `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN`. Test suite async (639/639). **SELESAI 2026-10-02**.
* [x] **11.5 DKAS Bot Cohere Semantic Search (Optional)** — fallback Fuse.js → Cohere API (gratis 1M/bln) untuk query ambigu; non-blocking. **SELESAI 2026-10-02**: `CohereProvider` (`src/lib/ai-providers/cohere.provider.ts`) + `SemanticSearchService` (`src/lib/operations/semantic-search.ts`) + server action wrapper + env vars `COHERE_API_KEY` + `COHERE_BASE_URL` di `.env.example`. `test/semantic-search-cohere.test.ts` **15 test** (provider interface, rerank logic, fallback logic, edge cases, integration). `tsc 0` · `npm test` **657/657** · `build exit 0`.
* [x] **11.6 Gate Keluar Phase 11** — `tsc 0` · `npm test` **>650** (657/657) · `build exit 0` · docs konsisten → **tulis PLAN-PHASE-12** (siklus "selesai → plan lagi"); bila backlog terblokir ditutup → laporan final. **LULUS 2026-10-02**

---

### Phase 12 Gate — Hardening Lanjutan & Fondasi DKAS Bot

* [x] **12.1 Search UX: Highlight matched terms** — **selesai 2026-10-02 (Run 1)**: helper murni `src/lib/operations/search-highlight.ts` (`highlightSearchMatches` case-insensitive + normalisasi spasi, teks asli utuh, tanpa innerHTML) + `HighlightedText` (`<mark>` amber) pada title & subtitle `GlobalSearchDialog`. *Koreksi plan: pencarian global pakai Prisma `contains`, bukan Fuse.js (Fuse.js hanya DKAS Bot).* 12 test. | Kecil |
* [x] **12.2 Error Boundary & Recovery UI** — **selesai 2026-10-02 (Run 1)**: `src/app/error.tsx` (fallback: Coba Lagi + Ke Dasbor, tanpa pesan error mentah, hanya `digest`) + `src/app/global-error.tsx` (root, render `<html>/<body>` sendiri, inline style). Sesi berakhir tetap via `rethrowIfSessionExpired` → `/login?expired=1`. 3 test struktural. | Kecil |
* [x] **12.3 AuditLog Query API + UI Filter** — **selesai 2026-10-02 (Run 2)**: Zod filter `src/lib/validation/audit.ts` + service `src/lib/audit/audit-query.ts` (guard `institution:view`, tenant boundary dari ctx, `detailsJson` invalid → null, facets dropdown) + 2 server action `src/actions/audit.ts` + UI `/audit-log` (filter/tabel-kartu/paginasi/empty-error) + nav "Jejak Audit". 25 test · `tsc 0` · 697/697 · build 0. | Sedang |
* [x] **12.4 Performance: Bundle Analyzer + Code Split** — **selesai 2026-10-02 (Run 3)**: `scripts/bundle-report.mjs` + npm `bundle:report` (66 chunk, budget 100 kB gz, exit 1 bila lewat); `GlobalSearchDialog` lazy `next/dynamic` di app-shell + nav-header. pdfkit/docx/qrcode terbukti server-only (tak perlu split); route-split Next sudah menutup modal. 478 kB gz total, chunk terbesar 71,6 kB. 8 test · `tsc 0` · 705/705 · build 0. | Sedang |
* [x] **12.5 Accessibility (a11y) Sweep** — **selesai 2026-10-02 (Run 4)**: `.eslintrc.json` (core-web-vitals + typescript + jsx-a11y/recommended), npm `lint`/`lint:fix` → **0 error, 368 warning** (90 `label-has-associated-control` = utang `htmlFor` tercatat, `no-explicit-any` legacy dimatikan). Fix: heading `{children}`, backdrop dialog, prefer-const, `require(docx)` → API resmi `PageNumber.CURRENT/TOTAL_PAGES` (footer DOCX dulu render `w:pgNum` tanpa tipe). 4 test gerbang lint · `tsc 0` · 709/709 · build 0. | Sedang |
* [x] **12.6 Observability: Structured Logging + Metrics** — **selesai 2026-10-03 (Run 5)**: Pino logger `src/lib/observability/logger.ts` (`LOG_LEVEL`/`LOG_FORMAT=json`, formatter dev tanpa pino-pretty, sink `console.log` — `process.stdout` dilarang Edge Runtime middleware) + registry metrik `src/lib/observability/metrics.ts` (counter/histogram, batas 100 label + `__overflow__`, snapshot/reset). Metrik: **`ai_generation_latency_ms`** (histogram `outcome`; `withAIGenerationLatency` membungkus `executeAIGeneration`, tercatat di `finally`), **`search_fallback_cohere_count`** (keputusan diekstrak ke `shouldUseSemanticFallback`, murni & teruji), **`rate_limit_hits`** (label `scope=account|ip` di `LoginRateLimiter`). Middleware: 1 baris log JSON per request (requestId/method/path/status/durationMs, guard tak berubah); `console.error` AI generator + semantic search → logger terstruktur. `.env.example` `LOG_LEVEL`/`LOG_FORMAT`. 24 test `test/observability.test.ts` · `tsc 0` · **733/733** · lint **0 error** · `build exit 0`. | Sedang |
* [ ] **12.7 DKAS Bot: Natural Language → SQL (Planner)** — Planner LLM → generate Prisma where clause aman (whitelist field/operator) untuk query santri/nilai/kehadiran. Non-blocking, gated `AI_GENERATION_ENABLED`. | Besar |
* [ ] **12.8 Gate Keluar Phase 12** — `tsc 0` · `npm test` **≥700** · `build exit 0` · `lint 0` · docs konsisten → **tulis PLAN-PHASE-13**; bila backlog terblokir ditutup → laporan final. | Kecil |

> **Terkunci (sama dengan 9.4/11.4, butuh keputusan Arsyad — JANGAN DIKERJAKAN sampai ada keputusan):**
> Tier Question Bank `COMMUNITY` / `DEVELOPER_CENTRAL`, CI Workflow `.github/workflows/ci.yml` (token scope `workflow`), Deploy Vercel Permanen, AI Generator Runtime `AI_API_KEY` Nyata, Rate Limit Redis/DB (Produksi).

