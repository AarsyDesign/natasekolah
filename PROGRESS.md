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
| **Phase 3** | **Daily Operations** (Attendance, Finance 3-Tier, Buku Kas, Dashboard) | **PARTIALLY COMPLETE** | 2026-09-23 — Attendance + Finance Core implemented; verification pending |
| **Phase 4** | **Communication Engine** (WhatsApp Outbox Pattern, Notification Queue) | Belum Dimulai | - |
| **Phase 5** | **Formal Academic** (Buku Nilai, Capaian Pembelajaran, Frozen Report Card Snapshot) | Belum Dimulai | - |
| **Phase 6** | **Pesantren Living** (Diniyah, Asrama, Tasrih Perizinan, Mutaba'ah Tahfidz) | Belum Dimulai | - |
| **Phase 7** | **Parent Experience** (PWA Wali Murid, Transparansi Rekap Tagihan) | Belum Dimulai | - |
| **Phase 8** | **AI & Automation** (Bank Soal 3-Tier, AI Generator dengan Fair Use) | Belum Dimulai | - |

---

## 2. Catatan Log Aktivitas Kronologis

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
  6. **Testing & Verifikasi:**
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

## [2026-09-23] - Phase 3: Finance Core (IMPLEMENTED / VERIFICATION PENDING)\n* **Implementasi:** FeeCategory, StudentCharge, PaymentTransaction, Receipt, CashbookEntry; payment atomic transaction; idempotency; partial payment; overpayment; VOID + cashbook reversal; audit trail; finance RBAC; dashboard finance awal.\n* **Status:** PARTIALLY COMPLETE sampai Prisma validation, typecheck, test suite, build, dan database migration/verification dijalankan pada environment proyek.\n\n## 3. Langkah Selanjutnya (Next Immediate Gate)
1. **Phase 3 Gate — Daily Operations:**
   * Attendance Engine (< 60 detik) & offline cache idempotency.
   * Finance 3-Tier Layer (FeeCategory, StudentCharge, PaymentTransaction).
   * Cashbook & Unique Receipt Generator (`KW-...`).
   * Operational Dashboard berbasis aksi pengguna.


## [2026-09-23] - Finance Core VERIFY Audit
* **Audit:** Source review completed against `staging`, including Finance services/actions/validation/UI, auth/tenant guards, Prisma schema, tests, architecture/ADR/progress/changelog.
* **Fixes applied during audit:** tenant-scoped compound FKs for PaymentTransaction↔Receipt/Cashbook and Cashbook reversal; Serializable transaction + retry for concurrent payment creation/void; Serializable charge create/void; UI idempotency key preserved across retry/double-submit protection.
* **Verification limitation:** This GitHub-only session cannot execute local `npx prisma validate`, `npx prisma generate`, TypeScript, tests, or production build. No GitHub Actions checks are configured/reported for the current feature commit.
* **Migration:** No Prisma migration directory/changed migration is present in PR #1. Database migration remains BLOCKED pending project environment/database workflow verification.
* **Status:** PARTIALLY COMPLETE — NOT READY until environment verification passes and database migration is created/applied through the project's approved workflow.
