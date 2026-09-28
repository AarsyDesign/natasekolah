# Immediate Execution Backlog (TODO) - NataSekolah

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



