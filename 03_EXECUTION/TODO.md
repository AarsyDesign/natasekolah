# Immediate Execution Backlog (TODO) - NataSekolah

## Temuan QA E2E (semua sudah dikerjakan)

- [x] **Sesi kedaluwarsa di tengah sesi tidak diarahkan ke login.** Selesai 2026-10-01
  (lihat LOG run "Task QA #1"): guard `rethrowIfSessionExpired` (`src/lib/auth/action-session.ts`,
  `SESSION_EXPIRED_PATH = /login?expired=1`) dipasang di ~94 catch server action + 9 test baru.

## Phase 0 — Foundation & Security (COMPLETE)

- [x] **0.1 Multi-Tenancy Core:**
  - [x] Prisma Schema blueprint dengan relasi cascading dan compound unique keys.
  - [x] `TenantContext` berbasis `AsyncLocalStorage`.
  - [x] `TenantGuard` (`assertTenantAccess`, `enforceTenantFilter`, `sanitizeClientInput`).
  - [x] `BaseTenantService` & `TenantStudentService`.
  - [x] Automated Unit Tests (10 test pass).

- [x] **0.1 Authentication & Session Foundation:**
  - [x] Model kredensial & password hashing (`bcryptjs` cost 12).
  - [x] Database-backed Session dengan SHA-256 token hashing (`src/lib/auth/session.ts`).
  - [x] HttpOnly secure cookie (`__Host-` pada prod) (`src/lib/auth/cookie.ts`).
  - [x] Generic authentication error & scoped institution login.
  - [x] Automated Unit Tests (21 test pass).

- [x] **0.1A Identity & Access Model:**
  - [x] Dual-Track Identity: User (staf) vs Guardian (wali).
  - [x] Unified Session Model dengan invariant ketat (`INTERNAL_USER` vs `GUARDIAN`).
  - [x] Cross-tenant relational compound foreign keys PostgreSQL.
  - [x] Realistic Phone Policy (`@@index([institutionId, phoneWa])`).
  - [x] Ephemeral One-Time Guardian Invitation & Activation (72 jam, single-use).
  - [x] ReBAC Guard (`assertGuardianStudentAccess`).
  - [x] Pembersihan peran `PARENT` dari RBAC staf internal.
  - [x] Automated Tests (24 test pass, total 55 passing tests).

- [x] **0.2 Fine-Grained RBAC Enforcement:**
  - [x] 6 Peran Resmi Internal Lembaga (`SUPER_ADMIN`, `FOUNDATION_HEAD`, `PRINCIPAL`, `ADMIN`, `TEACHER`, `FINANCE_STAFF`).
  - [x] Matriks tunggal sumber kebenaran (`ROLE_PERMISSIONS`) lintas 10 domain.
  - [x] Authorization Guard API: `hasPermission`, `requirePermission`, `hasRole`, `requireRole`.
  - [x] Isolasi total sesi `GUARDIAN` dari RBAC staf internal (403 Forbidden).
  - [x] Rantai otorisasi mutlak: Session -> Tenant -> RBAC -> Domain.
  - [x] Anti-tampering: Pembersihan role, roles, permissions, isSuperAdmin dari payload klien via `sanitizeClientInput`.
  - [x] Teacher assignment boundary pada domain layer.
  - [x] Automated Tests (24 test baru, total 83 passing tests).

- [x] **0.3 Input Validation & Plugin Registry:**
  - [x] Standardisasi input validation (Zod) di `src/lib/validation/*`.
  - [x] Kontrak manifest plugin (`src/lib/plugins/*`) & resolver per `Institution.enabledPlugins`.
  - [x] Guard `requirePlugin()` dan pemisahan fitur Core vs Toggleable Domain Plugins.
  - [x] Rantai otorisasi 5 tingkat: Session -> Tenant -> RBAC -> Plugin -> Domain.
  - [x] Automated Tests (22 test baru, total 105 passing tests).

---

## Phase 1 — Buku Induk & Academic Core (COMPLETE)

- [x] **1.1 Student Core & Buku Induk:**
  - [x] Model identitas peserta didik primer tanpa foreign key `classroomId` langsung.
  - [x] Penegakan NIS unik per institusi (`@@unique([institutionId, nis])`).
  - [x] Status enum kesiswaan finite (`ACTIVE`, `INACTIVE`, `GRADUATED`, `TRANSFERRED`, `ALUMNI`).
  - [x] Skema validasi Zod (`createStudentInputSchema`, `updateStudentInputSchema`, `studentFilterSchema`, `archiveStudentInputSchema`).
  - [x] Layanan domain `student-service.ts` (`createStudent`, `updateStudent`, `getStudent`, `listStudents`, `archiveStudent`).

- [x] **1.2 Academic Year & Classroom:**
  - [x] Model `AcademicYear` dengan invariant *single active year* per institusi via transaksi atomik.
  - [x] Model `Classroom` terikat secara relasional pada `AcademicYear` dan institusi induk.
  - [x] Layanan domain `academic-year-service.ts` dan `classroom-service.ts`.

- [x] **1.3 Sacred History Enrollment Engine:**
  - [x] Penempatan siswa ke kelas secara eksklusif via entitas `Enrollment` (`@@unique([studentId, academicYearId])`).
  - [x] Compound foreign keys PostgreSQL (`[studentId, institutionId]`, `[academicYearId, institutionId]`, `[classroomId, academicYearId, institutionId]`).
  - [x] Pencegahan tabrakan akademik: penolakan keras mismatch rombel dan tahun ajaran target.
  - [x] Sacred history timeline: histori kelas masa lalu abadi saat siswa naik kelas.
  - [x] Layanan domain `enrollment-service.ts` (`enrollStudent`, `updateEnrollment`, `getStudentEnrollments`, `getCurrentEnrollment`).

- [x] **1.4 Server Actions & UI Minimal:**
  - [x] Server actions di `src/actions/academic.ts` dengan rantai otorisasi utuh.
  - [x] Antarmuka mobile-first `/students` (daftar, pencarian NIS/NISN/Nama, filter status, tambah siswa, paginasi).
  - [x] Antarmuka mobile-first `/students/[id]` (detail Buku Induk, banner rombel tahun aktif, timeline Sacred History, form penempatan rombel).
  - [x] Antarmuka mobile-first `/academic-years` (daftar tahun ajaran, aktivasi, tambah tahun ajaran).
  - [x] Antarmuka mobile-first `/classrooms` (daftar rombel, filter tahun ajaran, tambah rombel).
  - [x] Komponen navigasi terpadu `src/components/nav-header.tsx`.

- [x] **1.5 Verifikasi & Automated Tests:**
  - [x] 21 automated test baru di `test/academic-core.test.ts`.
  - [x] 126 total automated tests PASS (100%).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`).
- [x] **1.6 Master Data Engine — Bulk Promotion Workflow (Kenaikan Kelas Massal):**
  - [x] Kontrak tipe domain & galat (`src/lib/academic/promotion-types.ts`).
  - [x] Skema validasi Zod (`src/lib/validation/promotion.ts`).
  - [x] Layanan domain `promotion-service.ts` (`getPromotionCandidates`, `previewBulkPromotion`, `executeBulkPromotion`).
  - [x] Penegakan Sacred History: tidak menghapus atau menimpa enrollment masa lalu.
  - [x] Transaksi atomik `prisma.$transaction`, pencegahan duplikasi idempotency, dan jejak `AuditLog`.
  - [x] Server Actions `src/actions/promotion.ts` dengan guard otorisasi RBAC & isolasi tenant.
  - [x] Antarmuka mobile-first 4-tahap `/students/promotions` (Setup Rombel, Pilih Siswa, Prapinjau Validasi, Hasil Eksekusi).
  - [x] 13 automated tests baru di `test/bulk-promotion.test.ts` (100% PASS).

---

## Phase 2 — Academic Teaching Core (COMPLETE)

- [x] **2.1 Subject Core & Catalog:**
  - [x] Model `Subject` dengan `@@unique([institutionId, code])`, `isActive`, dan kategori standar (`UMUM`, `AGAMA`, `MULOK`, `PEMINATAN`).
  - [x] Skema validasi Zod (`createSubjectInputSchema`, `updateSubjectInputSchema`, `subjectFilterSchema`).
  - [x] Layanan domain `subject-service.ts` (`createSubject`, `updateSubject`, `listSubjects`, `getSubject`).

- [x] **2.2 Teacher Identity & Directory:**
  - [x] Menggunakan model `User` internal lembaga dengan peran `TEACHER` tanpa sistem otentikasi ganda.
  - [x] Layanan domain `teacher-service.ts` (`listTeachers`, `getTeacher`) dengan penyembunyian password hash dan penghitungan rombel diampu.

- [x] **2.3 TeacherAssignment Core & Invariants:**
  - [x] Matriks kuartet akademik: `Teacher` + `Subject` + `Classroom` + `AcademicYear`.
  - [x] Constraint unik `@@unique([teacherId, subjectId, classroomId, academicYearId])`.
  - [x] Compound foreign keys PostgreSQL (`[teacherId, institutionId]`, `[subjectId, institutionId]`, `[academicYearId, institutionId]`, `[classroomId, academicYearId, institutionId]`).
  - [x] Layanan domain `assignment-service.ts` (`createTeacherAssignment`, `updateTeacherAssignment`, `deleteTeacherAssignment`, `listTeacherAssignments`, `getTeacherAssignments`, `assertTeacherAssignmentAccess`).

- [x] **2.4 Resource Scope Enforcement:**
  - [x] Guru (`TEACHER` tanpa `academic:manage`) otomatis hanya melihat penugasan miliknya sendiri (`teacherId = session.userId`).
  - [x] Upaya mengueri atau memodifikasi penugasan guru lain ditolak instan (403 Forbidden).
  - [x] Mutasi penugasan (create/update/delete) diwajibkan memiliki izin administratif `academic:manage`.

- [x] **2.5 Server Actions & UI Minimal Mobile-First:**
  - [x] Server actions di `src/actions/teaching.ts`.
  - [x] `/subjects`: katalog mapel, pencarian, filter status, modal create/edit, empty/loading/error states.
  - [x] `/teachers`: direktori guru lembaga, status aktif, jumlah rombel diampu.
  - [x] `/teacher-assignments`: matriks penugasan, filter 4 dimensi (T.A, Guru, Mapel, Rombel), modal penugasan dengan sinkronisasi rombel berbasis tahun ajaran, pembatalan penugasan.
  - [x] `NavHeader`: navigasi terpadu ke seluruh halaman baru.

- [x] **2.6 Verifikasi & Automated Tests:**
  - [x] 29 automated test baru di `test/teaching-core.test.ts`.
  - [x] 155 total automated tests PASS (100% across 7 test suites).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`).
  - [x] Prisma validation PASS (`prisma validate`).

---

## Phase 3 — Attendance Core (COMPLETE)

- [x] **3.1 AttendanceSession & AttendanceRecord Models:**
  - [x] Model `AttendanceSession` terikat pada `TeacherAssignment` dengan `@@unique([teacherAssignmentId, attendanceDate])`.
  - [x] Model `AttendanceRecord` menyimpan `studentId` DAN `enrollmentId` sekaligus (`@@unique([attendanceSessionId, studentId])`).
  - [x] Compound foreign keys ke `TeacherAssignment`, `Student`, dan `Enrollment` berpasangan dengan `institutionId`.
  - [x] Status kehadiran resmi: `PRESENT` (HADIR), `EXCUSED` (IZIN), `SICK` (SAKIT), `ABSENT` (ALPA).

- [x] **3.2 Sacred Enrollment Integration:**
  - [x] Roster diturunkan secara eksklusif dari siswa yang terdaftar aktif (`Enrollment.status = "ENROLLED"`, `Student.status = "ACTIVE"`) pada rombel dan tahun ajaran penugasan.
  - [x] Siswa rombel lain, tahun ajaran lain, atau lembaga lain secara mutlak ditolak (`InvalidAttendanceContextError` 400).
  - [x] Tidak ada kolom status kehadiran langsung pada `Student`.

- [x] **3.3 Zod Validation & Domain Services:**
  - [x] Skema validasi Zod di `src/lib/validation/attendance.ts`.
  - [x] Layanan domain `session-service.ts` (`createAttendanceSession`, `getAttendanceSession`, `listAttendanceSessions`, `closeAttendanceSession`).
  - [x] Layanan domain `record-service.ts` (`getAttendanceRoster`, `markAttendance`, `markAttendanceBatch`, `getAttendanceRecords`).
  - [x] Normalisasi tanggal UTC midnight (`normalizeAttendanceDate`) untuk mencegah pergeseran zona waktu.

- [x] **3.4 Teacher Scope & Immutability Enforcement:**
  - [x] Guru (`TEACHER`) hanya boleh melihat, membuka, mengisi, dan menutup sesi untuk penugasan miliknya sendiri (`teacherId = session.userId`).
  - [x] Upaya mengakses atau mengotak-atik sesi guru lain ditolak instan (403 Forbidden).
  - [x] Immutability sesi tertutup: Sesi `CLOSED` menolak modifikasi atau penambahan catatan kehadiran secara permanen (400 Bad Request).
  - [x] Penutupan sesi mensyaratkan kelengkapan catatan 100% siswa eligible (`AttendanceIncompleteError` 400).

- [x] **3.5 Server Actions & Mobile-First UI:**
  - [x] Server actions di `src/actions/attendance.ts`.
  - [x] `/attendance`: Presensi harian guru, pemilihan tanggal, pembukaan sesi, pengisian cepat, tombol "Tandai Semua Hadir" (< 60 detik), penutupan sesi dengan peringatan immutability.
  - [x] `/attendance/history`: Histori sesi absensi, filter status dan rentang tanggal, modal rincian presensi siswa.
  - [x] `NavHeader`: Navigasi terpadu ke `/attendance` dengan ikon `ClipboardCheck`.

- [x] **3.6 Verifikasi & Automated Tests:**
  - [x] 21 automated test baru di `test/attendance-core.test.ts`.
  - [x] 176 total automated tests PASS (100% across 8 test suites).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`, 11 routes).
  - [x] Prisma validation PASS (`prisma validate`).

---

## Phase 4 — Communication Engine & WhatsApp Outbox Pattern (COMPLETE)

- [x] **4.1 NotificationOutbox Schema & Relational Hardening:**
  - [x] Model `NotificationOutbox` di `prisma/schema.prisma` terikat pada `institutionId` (`@@unique([id, institutionId])`).
  - [x] Status lifecycle (`PENDING`, `PROCESSING`, `DELIVERED`, `FAILED`, `CANCELLED`) & tracking `nextRetryAt` / `attempts`.

- [x] **4.2 Zod Validation & Phone Sanitizer:**
  - [x] Sanitizer nomor telepon seluler Indonesia (`sanitizeIndonesianPhone`: format `628...`).
  - [x] Skema `queueNotificationInputSchema`, `notificationFilterSchema`, `whatsappProviderConfigSchema` di `src/lib/validation/notification.ts`.

- [x] **4.3 WhatsApp Gateway Abstraction:**
  - [x] Interface `IWhatsAppProvider`.
  - [x] Implementasi `DeepLinkWhatsAppProvider` (bebas biaya/offline `https://wa.me/...`).
  - [x] Implementasi `FonnteWhatsAppProvider` (Fonnte Gateway API).
  - [x] Implementasi `WahaWhatsAppProvider` (WAHA Gateway API).
  - [x] Factory `getWhatsAppProvider()`.

- [x] **4.4 Outbox Domain Services & Event Helpers:**
  - [x] Template renderer `renderNotificationMessage` di `src/lib/notification/templates.ts`.
  - [x] Domain service `outbox-service.ts` (`queueNotification`, `processOutboxQueue` exponential backoff retry `2^attempts * 60s`, `listOutboxNotifications`, `cancelNotification`).
  - [x] Event helpers `events.ts` (`notifyPaymentCompleted`, `notifyAttendanceAlert`, `notifyGuardianInvitation`).

- [x] **4.5 Server Actions & Mobile-First Outbox UI:**
  - [x] Server actions di `src/actions/notification.ts`.
  - [x] Halaman antarmuka `/notifications`: Dashboard outbox, pencarian nomor/pesan, filter status, pemroses antrean latar belakang, tombol WA DeepLink langsung.
  - [x] Integrasi navigasi `NavHeader` dengan ikon `MessageSquare`.

- [x] **4.6 Verifikasi & Quality Gate Milestone:**
  - [x] Automated unit tests baru di `test/communication-engine.test.ts`.
  - [x] 183 total automated tests PASS (100% across 9 test suites).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`, 13 routes).
  - [x] Prisma validation PASS (`prisma validate`).

---

## Phase 4 — Finance Core (COMPLETE)

- [x] **4.1 Finance Core Models & Relational Hardening:**
  - [x] Model `FeeCategory`, `StudentCharge`, `PaymentTransaction`, `PaymentAllocation`, `CashbookEntry`, dan `Receipt` di `prisma/schema.prisma`.
  - [x] Compound unique index `@@unique([paymentTransactionId, institutionId])` pada 1-to-1 relations (`CashbookEntry` & `Receipt`).
  - [x] Compound foreign key `[studentId, institutionId]`, `[feeCategoryId, institutionId]`, `[paymentTransactionId, institutionId]`, `[studentChargeId, institutionId]`.

- [x] **4.2 Zod Validation Schemas:**
  - [x] Validasi input di `src/lib/validation/finance.ts` (`feeCategoryInputSchema`, `studentChargeInputSchema`, `bulkChargeInputSchema`, `paymentTransactionInputSchema`, `paymentAllocationInputSchema`, `cashbookEntryInputSchema`, `receiptQuerySchema`).

- [x] **4.3 Domain Services & Atomic Payment Orchestrator:**
  - [x] `fee-category-service.ts` (Master tarif & status aktif/nonaktif).
  - [x] `charge-service.ts` (Kewajiban tagihan snapshot nominal & pembatalan VOID).
  - [x] `cashbook-service.ts` (Pencatatan Buku Kas Umum INCOME/EXPENSE & saldo terhitung).
  - [x] `receipt-service.ts` (Penomoran atomis `KW-YYYYMM-XXXXXX` & generator bukti penerimaan).
  - [x] `payment-service.ts` (Orchestrator atomis Prisma `$transaction` memproses pembayaran, alokasi tagihan, update status `UNPAID` -> `PARTIAL` -> `PAID`, pembuatan kas masuk `INCOME`, dan penerbitan `Receipt`).

- [x] **4.4 Server Actions & Mobile-First UI:**
  - [x] 18 Server Actions terproteksi di `src/actions/finance.ts`.
  - [x] `/finance`: Dashboard Keuangan (Ringkasan Realtime Total Tagihan, Terbayar, Sisa Tagihan, Penerimaan Hari Ini, Saldo BKU).
  - [x] `/finance/fees`: Master Katalog Biaya.
  - [x] `/finance/charges`: Manajemen & Pembuatan Tagihan Siswa.
  - [x] `/finance/payments`: Kasir Pembayaran, Alokasi Multi-Tagihan, & Modal Kwitansi Resmi.
  - [x] `/finance/cashbook`: Buku Kas Umum (BKU) Masuk/Keluar.
  - [x] Navigasi terpadu di `NavHeader` dengan ikon `CreditCard`.

- [x] **4.5 Verifikasi & Quality Gate Milestone:**
  - [x] 7 suite test baru di `test/finance-core.test.ts`.
  - [x] 190 total automated tests PASS (100% across 10 test suites).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`, 18 routes).
  - [x] Prisma validation PASS (`prisma validate`).

---

## Phase 5 — Formal Academic Core (COMPLETE)

- [x] **5.1 Formal Academic Models & Database Integrity:**
  - [x] Model `Assessment`, `AssessmentScore`, `ReportCard`, `ReportCardSubject` di `prisma/schema.prisma`.
  - [x] Relasi kuartet `TeacherAssignment` -> `Assessment` -> `AssessmentScore`.
  - [x] Compound unique keys `@@unique([id, institutionId])`, `@@unique([assessmentId, studentId])`, dan `@@unique([enrollmentId, semester])`.
  - [x] Kolom `frozenData` pada `ReportCard` untuk snapshot historis abadi.

- [x] **5.2 Zod Validation Boundary:**
  - [x] `createAssessmentInputSchema`, `updateAssessmentInputSchema`, `assessmentFilterSchema`.
  - [x] `recordScoreInputSchema`, `recordBatchScoresInputSchema`, `scoreFilterSchema`.
  - [x] `generateReportCardInputSchema`, `publishReportCardInputSchema`, `reportCardFilterSchema`.

- [x] **5.3 Domain Services & Calculation Strategy:**
  - [x] `assessment-service.ts`: Assessment lifecycle & teacher resource scope guard.
  - [x] `grade-service.ts`: Roster retrieval, score boundary checks (`0 <= score <= maxScore`), enrollment validation, and atomic batch grading.
  - [x] `calculation-service.ts`: Extensible calculation strategy (`IGradeCalculationStrategy`), normalisasi 0-100, agregasi per subject, dan penentuan predikat huruf A/B/C/D.
  - [x] `report-card-service.ts`: Draf raport dinamis & pembekuan permanen (Frozen Snapshot) saat `PUBLISHED`. Proteksi terhadap mutasi nilai retroaktif.

- [x] **5.4 Server Actions & Mobile-First UI:**
  - [x] 13 Server Actions di `src/actions/formal-academic.ts`.
  - [x] `/assessments`: Direktori penilaian & modal buat penilaian baru.
  - [x] `/assessments/[id]`: Roster pengisian nilai siswa massal (batch input) & validasi batas skor.
  - [x] `/grades`: Rekapitulasi nilai per penilaian & per siswa.
  - [x] `/reports`: Pengelolaan draf raport, pratinjau buku raport resmi, tombol "Terbitkan & Bekukan (Publish & Freeze)", dan tata letak ramah cetak (`window.print()`).
  - [x] Integrasi navigasi `NavHeader` dengan tautan "Penilaian" (`FileCheck2`) dan "Raport" (`Award`).

- [x] **5.5 Verifikasi & Quality Gate Milestone:**
  - [x] 13 automated tests baru di `test/formal-academic.test.ts`.
  - [x] 203 total automated tests PASS (100% across 11 test suites).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`).
  - [x] Prisma validation PASS (`prisma validate`).

---

## Phase 6 — Pesantren & Tahfidz Living Core (COMPLETE)

- [x] **6.1 Pesantren & Tahfidz Living Database Models:**
  - [x] Model `TahfidzRecord`, `Dormitory`, `DormitoryRoom`, `StudentDormitoryAssignment` di `prisma/schema.prisma`.
  - [x] Compound unique keys `@@unique([id, institutionId])`, `@@unique([institutionId, name])` pada Dormitory, `@@unique([dormitoryId, name])` pada DormitoryRoom.
  - [x] Perluasan `AttendanceSession` dengan `context: "ACADEMIC" | "LIVING"` dan `dormitoryRoomId` nullable dengan `@@unique([dormitoryRoomId, attendanceDate])`.
  - [x] Compound foreign keys PostgreSQL untuk isolasi multi-tenant mutlak.

- [x] **6.2 Zod Validation Boundary:**
  - [x] `createTahfidzRecordInputSchema`, `tahfidzRecordFilterSchema` di `src/lib/validation/tahfidz.ts`.
  - [x] `createDormitoryInputSchema`, `createDormitoryRoomInputSchema`, `assignStudentToRoomInputSchema`, `endDormitoryAssignmentInputSchema`, `dormitoryAssignmentFilterSchema` di `src/lib/validation/dormitory.ts`.
  - [x] `createLivingAttendanceSessionInputSchema` di `src/lib/validation/attendance.ts`.

- [x] **6.3 Domain Services & Invariants:**
  - [x] `src/lib/tahfidz/quran.ts`: Metadata 114 surah Al-Qur'an dan validasi rentang ayat (`startAyah >= 1`, `endAyah >= startAyah`, `endAyah <= totalAyahs`).
  - [x] `src/lib/tahfidz/tahfidz-service.ts`: `createTahfidzRecord` (terikat Student & Enrollment, recordedBy dari session), `getTahfidzRecordById`, `listTahfidzRecords`, `getTahfidzSummary`.
  - [x] `src/lib/dormitory/dormitory-service.ts`: `createDormitory`, `getDormitoryById`, `listDormitories`, `createDormitoryRoom`, `getDormitoryRoomById`, `assignStudentToRoom` (kapasitas kamar & single active assignment guard), `endDormitoryAssignment`, `listDormitoryAssignments`.
  - [x] `src/lib/attendance/session-service.ts`: `createLivingAttendanceSession` (context: "LIVING", 1 session per room per day).
  - [x] `src/lib/attendance/record-service.ts`: Living attendance roster derivation dari `StudentDormitoryAssignment` aktif dan presensi granular.

- [x] **6.4 Server Actions & Mobile-First UI:**
  - [x] 4 Server Actions di `src/actions/tahfidz.ts`.
  - [x] 8 Server Actions di `src/actions/dormitory.ts`.
  - [x] `createLivingAttendanceSessionAction` di `src/actions/attendance.ts`.
  - [x] `/tahfidz`: Santri mutaba'ah roster & recent activities feed.
  - [x] `/tahfidz/[studentId]`: Student mutaba'ah history & setoran ziyadah/muraja'ah recording form.
  - [x] `/dormitories`: Dormitory buildings list, capacity progress bar, modal tambah gedung & kamar.
  - [x] `/dormitories/[id]`: Rooms list, room occupants list, modal assign student, tombol end assignment, dan tombol "Buka Absensi Asrama".
  - [x] `NavHeader`: Penambahan tautan navigasi "Tahfidz" (`BookMarked`) dan "Asrama" (`Home`).

- [x] **6.5 Verifikasi & Quality Gate Milestone:**
  - [x] 26 automated tests baru (9 tests di `test/tahfidz.test.ts` + 17 tests di `test/pesantren-living.test.ts`).
  - [x] 229 total automated tests PASS (100% across 14 test suites, 0 fail).
  - [x] TypeScript 0 error (`tsc --noEmit`).
  - [x] Next.js Turbopack build PASS (`next build`, 23 static & dynamic routes).
  - [x] Prisma validation PASS (`prisma validate`).

  ---

  ## Phase 7 — Question Bank (PRIVATE_INSTITUTION Tier) — **SELESAI**

  - [x] **7.0 Schema & Migration:**
    - [x] Model `Question` (UUID, institutionId, subjectId, creatorId, type, difficulty, topic, stem, explanation, shortAnswerKey, status, version, archivedAt).
    - [x] Model `QuestionOption` (UUID, questionId, label A-D, content, isCorrect).
    - [x] Compound FK PostgreSQL: `[institutionId, subjectId]`, `[institutionId, creatorId]`.
    - [x] Migrasi manual `20261001032000_question_bank_core` applied, `migrate diff` nihil.

  - [x] **7.1 Zod Validation & Domain Services:**
    - [x] Strict schemas + `superRefine` invariant (PG 4 opsi/1 kunci, SHORT_ANSWER wajib kunci, ESSAY tanpa opsi).
    - [x] `question-service.ts`: CRUD + siklus DRAFT→ACTIVE→ARCHIVED + hapus lunak, resource scope guru, AuditLog.
    - [x] `category-service.ts`: agregat metrik per kategori.
    - [x] `importer.ts`: preview VALID/ERROR, deteksi kunci ganda, template xlsx/csv.
    - [x] `exporter.ts`: CSV 16 kolom.

  - [x] **7.2 Server Actions & RBAC:**
    - [x] 15 server action async (`src/actions/question-bank.ts`).
    - [x] Permission `exam:view` / `exam:manage` di 6 peran + peta legacy.
    - [x] Test `test/rbac-fine-grained.test.ts` 7 kasus `exam:*`.

  - [x] **7.3 UI Mobile-First (Tahap 7):**
    - [x] `/exams/question-bank`: metric bar, filter debounce, tabel/ResourceList, pagination, empty/loading/error.
    - [x] `/exams/question-bank/[id]`: edit, transisi status, arsip konfirmasi.
    - [x] Modal impor 4 langkah (`QuestionImportModal`).
    - [x] Nav "Bank Soal" (`nav-header` + `app-shell`).
    - [x] QA E2E eksploratif: create soal PG sukses (toast + row + metrik Draf=1), detail page OK, 390px tanpa overflow.

  - [x] **7.4 BUG Krits Fix (E2E-only):**
    - [x] Nested `options.create` kirim `institutionId` → Prisma `Unknown argument` → gagal DB nyata.
    - [x] Test mock (45 kasus) lolos padahal bug nyata → pelajaran: write path wajib dibuktikan E2E.
    - [x] Fix: hapus `institutionId` dari nested create (2 titik di `question-service.ts`).

  - [x] **7.5 Verifikasi Akhir (Tahap 8 Dokumentasi Gate):**
    - [x] `npx tsc --noEmit` 0 · `npm test` 464/464 → **473/473** · `npm run build` exit 0.
    - [x] ROADMAP, PROGRESS, CHANGELOG, TODO updated.
    - [x] Push ke `origin/staging` (`2bb74c0` → `f3e6c06`).

  ---

  ## Phase 7 Trek C — AI Generator Infrastructure — **SELESAI**

  - [x] **Model & Migrasi:**
    - [x] `AiGenerationUsage` — quota harian per guru (unique institution+user+date), kolom `count`, `lastGenerateAt`, `cooldownUntil`.
    - [x] `AiGenerationJob` — async job queue (DRAFT, READY_FOR_REVIEW, SAVED, DISCARDED, FAILED), relasi Institution/User/Subject, `prompt` JSON, `resultJson`, `errorMessage`.
    - [x] Migrasi manual `20261001080000_ai_generation_infrastructure` applied via custom Node script (FK casing fix PostgreSQL).

  - [x] **Plugin Registry:**
    - [x] `AI_GENERATION` plugin (coreDependencies: `exam`, category: `AI_AUTOMATION`) — opt-in per institusi.

  - [x] **Env Vars (.env.example):**
    - [x] `AI_PROVIDER` (openai/anthropic/gemini/local), `AI_API_KEY`, `AI_MODEL`.
    - [x] `AI_DAILY_QUOTA_PER_TEACHER=30`, `AI_COOLDOWN_MS=15000`, `AI_GENERATION_ENABLED=false` (default off).

  - [x] **Services:**
    - [x] `usage-service.ts` — `checkAIGenerationQuota` (limit + cooldown), `recordAIGenerationUsage`.
    - [x] `ai-generation-service.ts` — `createAIGenerationJob`, `executeAIGeneration` (call provider, validate, update job, record usage), `reviewAIGenerationJob` (save/discard, link ke Question Bank), `listAIGenerationJobs`, `getAIGenerationJobDetail`. Fair-use guard 30/hari + cooldown 15s. Provider-agnostic scaffold (`callAIProvider` mock, siap diganti implementasi nyata).

  - [x] **Validation Schemas:**
    - [x] `src/lib/validation/ai-generation.ts` — Zod schemas: prompt params, job create/execute/review, provider enum, status enum.

  - [x] **Cron Monitoring:**
    - [x] `project-completion-monitor` (job ID `abef6fcf4ae7`) — schedule `0 */4 * * *` (setiap 4 jam).
    - [x] Cek: tsc, npm test 473/473, build, prisma validate, AI infra files, Question Bank files.
    - [x] Notifikasi completion otomatis saat semua hijau.

  - [x] **Verifikasi:**
    - [x] `npx tsc --noEmit` 0 · `npm test` **473/473** (baseline 412 → +61) · `npm run build` exit 0 · `prisma validate` valid.
    - [x] Push ke `origin/staging` (`f3e6c06`).

  - [x] **Status:** Infrastructure SIAP — tinggal pasang API key provider AI (OpenAI/Anthropic/Gemini/lokal) & implementasi adapter runtime + UI generate modal.

  ---

  ## Phase 8 — AI & Automation (Runtime & UI)

  - [x] **8.1 AI Provider Adapters:**
    - [x] `OpenAIProvider` (function calling / structured output JSON).
    - [x] `AnthropicProvider` (Claude, JSON mode).
    - [x] `GeminiProvider` (Google AI Studio).
    - [x] `LocalProvider` (Ollama / vLLM endpoint).
    - [x] Factory `getAIProvider()` mirip WhatsApp pattern.

  - [x] **8.2 Server Actions AI Generator:**
    - [x] `createAIGenerationJobAction` (input: subjectId, type, difficulty, count, topic, additionalInstructions).
    - [x] `executeAIGenerationAction` (jobId).
    - [x] `reviewAIGenerationJobAction` (jobId, action: save/discard, selectedQuestionIds?).
    - [x] `listAIGenerationJobsAction` (filters).

  - [x] **8.3 UI Generate Modal:**
    - [x] Modal "Generate Soal AI" di `/exams/question-bank` (trigger dari tombol "Tambah Soal" atau FAB).
    - [x] Form: Mapel (dropdown), Tipe (PG/Short/Essay), Kesulitan, Jumlah (1-10), Topik (opsional), Instruksi tambahan.
    - [x] Preview hasil AI (expandable cards) → checklist pilih soal → "Simpan ke Bank Soal".
    - [x] Status job real-time (polling/websocket): Draft → Generating → Ready for Review → Saved.
    - [x] Error state manusiawi (quota habis, cooldown, provider error).

  - [x] **8.4 Fair-Use Enforcement UI:**
    - [x] Badge quota di halaman Bank Soal: "Sisa generate hari ini: 27/30" (MetricCard "Sisa Generate AI" + indikator di form generate).
    - [x] Cooldown countdown saat generate terlalu cepat (caption badge & panel form: "Cooldown: Ns").
    - [x] History job dengan status & error message (Blok 2b "Riwayat Generate AI": 5 job terakhir + badge status + `errorMessage` + total generate 30 hari).

  - [x] **8.5 QA E2E Eksploratif AI Generator:** — **SELESAI 2026-10-02**
    (skrip lokal `scripts/_local-qa-ai.ts`, `scripts/_local-qa-actions.ts`, `scripts/_local-smoke.ts`;
    34/34 pemeriksaan service+DB nyata via mock provider HTTP, 3/3 invoke server action via
    HTTP prod + sesi, smoke halaman OK. Klik-manual UI belum — harness browser tidak tersedia
    di run cron.)
    - [x] Generate soal PG 5 butir → review → simpan 3 → verifikasi masuk Question Bank (DRAFT, 4 opsi/1 kunci, AuditLog).
    - [x] Generate soal Short Answer → validasi kunci jawaban (`shortAnswerKey` tersimpan, 0 opsi).
    - [x] Generate soal Essay → validasi pedoman penskoran (`explanation` tersimpan; kini **wajib** — `validateAIResult` menolak essay tanpa rubrik).
    - [x] Test quota limit (31x hari) → blocked "Limit harian 30 tercapai".
    - [x] Test cooldown (generate < 15 detik) → blocked "Cooldown N detik".
    - [x] Test provider error handling → invalid JSON, respons kosong, HTTP 500, endpoint mati (connection refused) semuanya → job `FAILED` + `errorMessage`. *Catatan: timeout menggantung belum disimulasikan.*
    - [x] Temuan bug diperbaiki di run ini: (1) `requirePlugin(ctx.institutionId, …)` selalu 403 → guard ambil baris institusi dulu (**fitur generate 100% rusak di DB nyata, tertutup test mock**); (2) metadata `provider/model` job kini dari env server (`AI_PROVIDER`/`AI_MODEL`), bukan input klien; (3) kolom `ai_generation_usage` di DB lokal huruf kecil → di-rename (drift `migrate diff` nol; file migrasi memang benar).

  - [x] **8.6 Verification Gate:** — **SELESAI 2026-10-02**
    - [x] `npx tsc --noEmit` **0 error** · `npm test` **473/473 pass, 0 fail** (150 suites) · `npm run build` **exit 0**.
    - [x] DoD Strict lolos (dijalankan per-suite, semua 0 fail):
      RBAC `rbac-fine-grained` **31/31** · Plugin Guard `validation-plugins` **22/22** ·
      Tenant Isolation `tenant-isolation` **10/10** · AuditLog tercakup di `question-bank` **45/45**
      (+ `bulk-promotion`, `finance-core`, `master-data-importer`).
    - [x] Update ROADMAP, PROGRESS, CHANGELOG, TODO.
    - *Catatan environment:* `prisma validate` tidak bisa dijalankan dari run cron
      (scanner keamanan memblokir eksekusi CLI prisma; tidak ada perubahan `schema.prisma` di fase ini).

---

## Phase 9 — Penutupan Backlog Gerbang & Kesiapan Rilis (PLAN: `03_EXECUTION/PLAN-PHASE-9.md`)

- [x] **9.0 QA E2E klik-manual modal "Generate Soal AI":** — **SELESAI 2026-10-02**
  - [x] Alur form → generating → review → simpan terpilih lewat browser; catat temuan.
  - [x] TC1: generate 5 PG → review tampil 5 soal → pilih 3 → "3 soal disimpan ke Bank Soal."
    (3 soal masuk DRAFT, counter kuota +1). Diuji dengan mock provider lokal OpenAI-compatible
    (`AI_LOCAL_BASE_URL` sementara, dimatikan setelah QA; `.env` dikembalikan).
  - [x] TC2: kuota habis → badge "⏱ 0 Limit harian tercapai (reset besok)" + submit diblokir
    "Generate AI diblokir: Limit harian 30 tercapai".
  - [x] TC3: submit kedua dalam window 15 detik → diblokir "Generate AI diblokir: Cooldown 9 detik".
  - [x] TC4: flag mati / provider tak terjangkau → pesan ramah, modal tetap terbuka.
  - **Temuan diperbaiki di sesi ini (5):**
    1. Error provider mentah ("fetch failed") tampil ke guru → `friendlyAIGenerationError()`
       (pesan ramah di-throw & disimpan di `job.errorMessage`; detail teknis hanya `console.error`).
    2. `AI_GENERATION_ENABLED` terdokumentasi tapi **tidak pernah dievaluasi** → kini guard di
       `createAIGenerationJob` (default nonaktif, pesan menunjuk flag).
    3. Form Mata Pelajaran mengirim `null` utk field ber-label "(Opsional)" → Zod "Invalid input"
       → `z.preprocess` normalisasi `null`/`""` → `undefined` di `createSubjectInputSchema`.
    4. ID seleksi review `${type}-${stem.substring(0,20)}` **tabrakan** bila awal naskah sama:
       "Simpan Terpilih (n)" tidak sinkron, seleksi kosong jatuh ke **simpan semua** (5).
       → `aiQuestionId(index)` + `selectQuestionsForReview()`; kosong kini ditolak.
    5. Nol test utk guard kuota/cooldown & seleksi review → `test/ai-generation-qa.test.ts`
       (19 test; total repo 565 → **584/584**, fail 0).

- [x] **9.1 Tasrih / Permit Engine (Izin Pulang Santri):** — **SELESAI 2026-10-02**
  - [x] Skema `PermitRequest` (lifecycle PENDING→APPROVED/REJECTED→RETURNED/OVERDUE) + migrasi MANUAL `20261002040000_permit_request_core` diterapkan via `migrate deploy` (`migrate diff` nihil, tanpa `migrate dev`).
  - [x] Zod `src/lib/validation/permit.ts` + service `src/lib/permit/permit-service.ts` (guard siswa ber-assignment asrama aktif, tolak izin ganda, AuditLog CREATE/UPDATE, guard tahun ajaran aktif).
  - [x] RBAC `pesantren:view`/`pesantren:manage` di matriks 6 peran (SUPER_ADMIN, FOUNDATION_HEAD, PRINCIPAL, ADMIN) + test `permit-engine` (RBAC & matriks).
  - [x] Server actions `src/actions/permit.ts` (6 action, `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired`).
  - [x] UI `/dormitories/permits` (daftar, filter status, modal ajukan, aksi setujui/tolak/kembali/terlambat, empty/loading/error, mobile) + notifikasi `PERMIT_APPROVED` via outbox (template baru + `notifyPermitApproved`) + tautan dari `/dormitories`.
  - [x] Test `test/permit-engine.test.ts` **24/24** (lifecycle, imutabilitas terminal, RBAC, sesi wali, cross-tenant, filter, template) + QA E2E **DB nyata 32/32** (`scripts/_local-qa-permit.ts`) + **server action via HTTP 7/7** (`scripts/_local-qa-permit-actions.ts`) + smoke halaman **7/7**.

- [x] **9.2 Guardian Master Data CRUD Staf + Wizard Undangan:** — **SELESAI 2026-10-02**
  - [x] Zod `src/lib/validation/guardian.ts` (`guardianFilterSchema`, `updateGuardianInputSchema`
    + refine minimal 1 bidang, `deactivateGuardianInputSchema`, `createGuardianInvitationStaffInputSchema`)
    + service `src/lib/guardian/master-data-service.ts` (`listGuardians` guardian:view /
    `updateGuardianProfile` / `deactivateGuardian` (cabut undangan belum ditebus) /
    `issueGuardianInvitation` (token 72 jam hash-only di DB, AuditLog tanpa token mentah),
    semua `requirePermission guardian:*` + tenant-scoped + AuditLog).
  - [x] Server actions `src/actions/guardian.ts` (list+`canManage`, update, deactivate, invitation;
    `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired`).
  - [x] UI `/guardians` (daftar + relasi anak + filter status & pencarian, modal edit profil,
    wizard undangan + salin tautan aktivasi, konfirmasi nonaktifkan, empty/loading/error,
    tombol aksi hanya tampil jika `canManage`, mobile-first) + nav "Wali Murid"
    (`app-shell` MASTER_DATA + `nav-header`).
  - [x] Test `test/guardian-master-data.test.ts` **22/22** + QA E2E DB nyata **35/35**
    (`scripts/_local-qa-guardian.ts`) + server action via HTTP **12/12**
    (`scripts/_local-qa-guardian-actions.ts`, `next start` :3100 — termasuk smoke
    `/guardians` 307→login tanpa sesi, 200 + marker UI dengan sesi).

- [x] **9.3 Student Full Profile — 5 Kluster Dapodik/EMIS:** — **SELESAI 2026-10-02**
  - [x] Skema tabel 1-to-1 `StudentFamilyData`, `StudentHealthData`, `StudentRegistryData` + migrasi manual `20261002060000_student_profile_clusters` (via `migrate deploy`, `migrate diff` nihil).
  - [x] Service `src/lib/student/profile-service.ts` + Zod `src/lib/validation/student-profile.ts` + server actions `src/actions/student-profile.ts` (`getStudentProfileClusters` `student:view`, `upsertStudentCluster` `student:edit` parsial + AuditLog).
  - [x] UI tab tambahan di `/students/[id]`: Keluarga, Kesehatan, Registry (form per kluster, read-only tanpa `student:edit`, empty/loading/error).
  - [x] Test +30 (`test/student-profile-clusters.test.ts`) termasuk cross-tenant; QA E2E DB nyata **32/32** + server action HTTP **11/11**. *Importer kolom kluster (tahap lanjut) belum — opsional, di luar DoD tahap ini.*

- [ ] **9.4 Backlog terblokir — TIDAK dikerjakan sampai keputusan Arsyad:**
  - [ ] Tier Question Bank `COMMUNITY`/`DEVELOPER_CENTRAL` (butuh keputusan produk moderasi lintas lembaga).
  - [ ] CI workflow `.github/workflows/ci.yml` (butuh token GitHub scope `workflow`).
  - [ ] Deploy Vercel permanen (butuh project baru + env Supabase).

- [x] **9.5 Gate Keluar Phase 9:** — **LULUS 2026-10-02**
  - [x] ROADMAP: 3 butir `[ ]` → `[x]` dengan anotasi bukti (audit silang + implementasi 9.1–9.3; tersisa hanya anotasi prosedur).
  - [x] `tsc 0` · `npm test` **584/584** (fail 0; target >500) · `build exit 0` · PROGRESS/CHANGELOG konsisten.
  - [x] **Gate lulus → plan fase berikutnya ditulis: `03_EXECUTION/PLAN-PHASE-10.md`** (instruksi Arsyad: selesai → plan lagi).

---

## Phase 10 — Exam Paper Engine (PRD #31) + Pengerasan Rilis (PLAN: `03_EXECUTION/PLAN-PHASE-10.md`)

- [x] **10.1 Fondasi data & domain:** — **SELESAI 2026-10-02 (run cron)**
  - [x] Model `Exam` + `ExamQuestion` (compound FK institution, `verifyToken`
    unik hash-only SHA-256 — token mentah tidak pernah disimpan), migrasi
    MANUAL `20261002080000_exam_paper_core` (`migrate deploy` OK,
    `migrate diff` nihil, `migrate status` up to date — 7 migrasi).
  - [x] Zod `src/lib/validation/exam-paper.ts` (create, addQuestions,
    setPoints, reorder, transisi status, filter; enum tipe/status/layout,
    batas `EXAM_MAX_QUESTIONS` 100, poin 1–100).
  - [x] Service `src/lib/exam-paper/exam-paper-service.ts` (`createExam`,
    `addQuestions` — validasi soal milik institusi & se-mapel + idempoten,
    `setQuestionPoints`, `reorderQuestions` (wajib komposisi lengkap),
    `listExams`, `getExamDetail`, `transitionExamStatus`/`archiveExam`
    (ARCHIVED menggantikan hard delete), `regenerateToken` (hash-only),
    `getExamPublicIdentity` (publik, identitas ringkas anti-leak);
    `requirePermission exam:*` + plugin `FORMAL_ACADEMIC` + AuditLog).
  - [x] Verifikasi: `tsc 0` · `npm test` **622/622** (+38 `test/exam-paper.test.ts`,
    DoD strict RBAC/plugin/tenant/audit) · `prisma validate` valid ·
    `build exit 0` · QA E2E DB nyata **44/44**
    (`scripts/_local-qa-exam-paper.ts`, lokal saja).
- [x] **10.2 Server actions + UI `/exams/papers`:** — **SELESAI 2026-10-02 (run cron)**
  - [x] `src/actions/exam-paper.ts` (8 action; `requireActionSession` +
    `runWithTenantContext` + `rethrowIfSessionExpired` di tiap catch).
  - [x] Daftar + filter (judul/status/mapel/tipe) + pagination + modal buat
    naskah (judul, mapel, tahun ajaran, tipe, petunjuk, layout kolom, tampil
    kunci) → redirect ke detail.
  - [x] Halaman detail: tarik soal dari Bank Soal (filter tipe/kesulitan/
    jumlah, penanda soal sudah ada, batas slot 100), atur urutan (naik/turun)
    + poin per soal (1–100), preview nomor soal + toggle kunci, komposisi
    terkunci saat ISSUED/ARCHIVED, empty/loading/error, mobile-first.
  - [x] Nav "Naskah Ujian" (`nav-header` + `app-shell`) + 2 test struktural
    (semua export async kaidah Next.js 16). `tsc 0` · **624/624** · `build exit 0` ·
    smoke kedua route 200.
- [x] **10.3 Ekspor PDF + QR verifikasi:** — **SELESAI 2026-10-02 (run cron)**
  - [x] Dep baru: `pdfkit` + `qrcode` + `@types/pdfkit` + `@types/qrcode` (workaround threat-intel: edit `package.json` + `npm install --no-audit --no-fund`).
  - [x] Sumber data bersama `src/lib/exam-paper/export-data.ts` (`buildExamPaperData`, `buildVerifyUrl`, `fetchLogoSafe`) — dipakai BERSAMA PDF + DOCX (Phase 10.4) agar isi identik.
  - [x] QR verifikasi `src/lib/exam-paper/qr.ts` (`generateExamVerifyQr` → buffer PNG, 240px, error correction M).
  - [x] Renderer PDF `src/lib/exam-paper/export-pdf.ts`:
    - Kop lembaga (nama/alamat/telp/logo best-effort timeout 5dtk + 2MB cap).
    - Identitas ujian (mapel, T.A, jenis, status) + QR kanan (URL `/verify/exam/<token>`).
    - Blok Ruang / Nomor Peserta / Nama Peserta (diisi manual saat ujian).
    - Body 1/2 kolom configurable (`exam.columnLayout`: ONE/TWO), aliran per halaman dengan pengukuran tinggi agar teks tidak terpotong.
    - Mode **SISWA** (kunci disembunyikan: PG kotak kosong, SHORT_ANSWER garis isian, ESSAY baris kosong) dan **KUNCI** (kunci tebal + latar kuning, pedoman penskoran esai).
    - Footer institusi + nomor halaman "Halaman n dari m" (buffered pages).
    - `compress: false` agar isi PDF auditable lewat teks pada test anti-leak.
  - [x] Orkestrasi ekspor `exportExamPaperPdf(ctx, examId, mode)`:
    - Guard `exam:manage` + plugin `FORMAL_ACADEMIC` (via `buildExamPaperData`).
    - `regenerateToken` dipanggil tiap ekspor → token mentah untuk QR, DB hanya hash SHA-256. QR cetakan lama jadi tidak berlaku (pesan sukses UI).
  - [x] Server action `exportExamPaperPdfAction(examId, mode)` → base64 download.
  - [x] UI halaman detail (`/exams/papers/[id]`): tombol "PDF Siswa" + "PDF Kunci" (hanya `canManage` + soal > 0), loading state, feedback sukses berisi nama file + peringatan QR rotasi.
  - [x] Halaman verifikasi publik `/verify/exam/[token]` (middleware PUBLIC): identitas ringkas saja (lembaga, judul, mapel, T.A, jenis, status, updatedAt) — **anti-leak**: tanpa soal/kunci/data tenant lain.
  - [x] Middleware: tambah `/verify` ke `PUBLIC_PREFIXES`.
  - [x] Verifikasi: `tsc 0` · `npm test` **624/624** · `npm run build` exit 0 (routes `/verify/exam/[token]` dynamic + 24 existing).
- [x] **10.4 Ekspor DOCX:** dep `docx`; `export-docx.ts` struktur identik PDF
  memakai sumber data bersama `buildExamPaperData()`. **SELESAI 2026-10-02 (run cron)**:
  `export-docx.ts` + `index.ts` (re-export non-conflicting), `tsc 0` · `npm test`
  **624/624** · `build exit 0`. Server action `exportExamPaperDocxAction` + UI tombol
  \"DOCX Siswa\" + \"DOCX Kunci\" di halaman detail naskah ujian.
- [x] **10.5 QA E2E + test DoD strict:** unit (compose/poin/urutan/RBAC/
  cross-tenant/token), integration (`%PDF` header, DOCX zip, anti-leak
  verifikasi), smoke HTTP download, QA E2E klik-manual (buat naskah → tarik
  10 soal → atur poin → preview → unduh PDF & DOCX → buka URL QR). **SELESAI 2026-10-02 (run cron)**:  
  `tsc 0` · `npm test` **624/624** (fail 0) · `build exit 0` · 4 ekspor
  PDF/DOCX SISWA+KUNCI terverifikasi + halaman verifikasi `/verify/exam/[token]`.
- [x] **10.6 Gate Keluar Phase 10:** `tsc 0` · `npm test` **>600** ·
  `build exit 0` · docs konsisten → **tulis PLAN-PHASE-11** (siklus
  "selesai → plan lagi"); bila backlog habis total → laporan final. **LULUS 2026-10-02**

> **Terkunci (lanjutan 9.4, butuh keputusan Arsyad — jangan dikerjakan):**
> tier COMMUNITY/DEVELOPER_CENTRAL, CI workflow (token scope `workflow`),
> deploy Vercel (kuota), AI provider nyata (`AI_API_KEY`), rate-limit
> Redis/DB. *Catatan: backlog drift migrasi `migrate status` SUDAH TERTUTUP
> (2026-10-02: "Database schema is up to date", 6 migrasi).*

---

## Phase 11 — Pengerasan Rilis & Backlog Terblokir (PLAN: `03_EXECUTION/PLAN-PHASE-11.md`)

- [x] **11.1 Session Expiry UX:** handle `?expired=1` di `/login` + toast ramah (bukan error mentah); `rethrowIfSessionExpired` sudah di 94 catch + 9 test.
- [x] **11.2 PDF/DOCX Layout Stress Test:** teks esai panjang (>500 char), gambar soal, page break 2 kolom edge case; test integrasi `test/pdf-docx-layout-stress.test.ts`.
- [x] **11.3 AI Generator Provider API Key Wiring:** dokumentasi `.env.example` + `README.md` (AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_LOCAL_BASE_URL, AI_GENERATION_ENABLED=false default).
- [ ] **11.4 Rate Limit Redis/DB (Optional):** ADR keputusan in-memory vs Redis (Upstash/Vercel KV/self-hosted); implementasi bila disetujui.
- [ ] **11.5 DKAS Bot Cohere Semantic Search (Optional):** fallback Fuse.js → Cohere API (gratis 1M/bln) untuk query ambigu; non-blocking.

- [ ] **11.6 Gate Keluar Phase 11:** `tsc 0` · `npm test` **>650** · `build exit 0` · docs konsisten → **tulis PLAN-PHASE-12** (siklus "selesai → plan lagi"); bila backlog terblokir ditutup → laporan final.

> **Terkunci (sama dengan 9.4, butuh keputusan Arsyad — jangan dikerjakan):**
> tier COMMUNITY/DEVELOPER_CENTRAL, CI workflow (token scope `workflow`),
> deploy Vercel (kuota), AI provider nyata (`AI_API_KEY`), rate-limit
> Redis/DB.



