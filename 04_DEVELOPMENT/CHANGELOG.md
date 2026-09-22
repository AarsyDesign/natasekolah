# Development Changelog - NataSekolah

## [2026-09-23] - Operational Dashboard (IMPLEMENTED / VERIFICATION PENDING)

### Added
* `src/lib/dashboard/overview-service.ts`: read-only dashboard overview service dengan tenant isolation, RBAC, ringkasan master data, dan status presensi hari ini.
* `src/lib/dashboard/index.ts`: barrel export modul dashboard.
* `src/actions/dashboard.ts`: Server Action untuk mengambil snapshot dashboard dari authenticated TenantContext.
* `src/app/dashboard/page.tsx`: Dashboard operasional mobile-first dengan fokus "apa yang harus dilakukan hari ini?", indikator perhatian, aksi cepat, dan ringkasan presensi.
* `test/dashboard-core.test.ts`: test kontrak status presensi dashboard tanpa database mutation.

### Changed
* `src/components/nav-header.tsx`: menambahkan navigasi `/dashboard`.
* `01_ARCHITECTURE/ARCHITECTURE.md`: mendokumentasikan flow, data contract, role/scope, dan prinsip Operational Dashboard.
* `03_EXECUTION/TODO.md`: menambahkan item Operational Dashboard sebagai implemented / verification pending.

### Scope Notes
* Dashboard hanya membaca entity yang sudah tersedia pada `staging`; tidak menambah tabel atau migration.
* Status penugasan `NOT_STARTED` pada hari berjalan tidak dianggap terlambat karena model saat ini belum memiliki entitas jadwal mengajar.
* Finance tidak di-hard-code ke dashboard branch ini karena Finance Core masih berada pada PR terpisah dan belum menjadi bagian dari `staging`.

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
