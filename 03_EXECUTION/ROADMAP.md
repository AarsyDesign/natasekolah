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
* [ ] **10.4 Ekspor DOCX** — dep `docx`; `export-docx.ts` struktur identik PDF memakai `buildExamPaperData()`.
* [ ] **10.5 QA E2E + test DoD strict** — unit (compose/poin/urutan/RBAC/cross-tenant/token), integration (`%PDF` header, DOCX zip, anti-leak verifikasi), smoke HTTP download, QA E2E klik-manual (buat naskah → tarik 10 soal → atur poin → preview → unduh PDF & DOCX → buka URL QR).
* [ ] **10.6 Gate Keluar Phase 10** — `tsc 0` · `npm test` **>600** · `build exit 0` · docs konsisten → **tulis PLAN-PHASE-11** (siklus \"selesai → plan lagi\"); bila backlog habis total → laporan final.

