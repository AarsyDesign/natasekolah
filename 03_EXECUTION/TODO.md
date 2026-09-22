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
  - [x] Prisma validation PASS (`prisma validate`).

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

