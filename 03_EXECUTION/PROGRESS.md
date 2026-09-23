# Progress & Development Log - NataSekolah

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
| **Phase 8** | **AI & Automation** (Bank Soal 3-Tier, AI Generator dengan Fair Use) | Belum Dimulai | - |

---

## 2. Catatan Log Aktivitas Kronologis

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
