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
| **Phase 3** | **Daily Operations** (Presensi < 60s, Kasir SPP 3-Tier, Buku Kas, Dashboard) | **COMPLETE** | 2026-09-20 (176 Tests Pass) |
| **Phase 4** | **Communication Engine** (WhatsApp Outbox Pattern, Notification Queue) | **COMPLETE** | 2026-09-28 (183 Tests Pass) |
| **Phase 5** | **Formal Academic** (Buku Nilai, Capaian Pembelajaran, Frozen Report Card Snapshot) | **COMPLETE** | 2026-09-23 (203 Tests Pass) |
| **Phase 6** | **Pesantren Living** (Diniyah, Asrama, Tasrih Perizinan, Mutaba'ah Tahfidz) | **COMPLETE** | 2026-09-23 (229 Tests Pass) |
| **Phase 7** | **Question Bank** (3-Tier, Private Institution, AI Generator Infrastructure) | **COMPLETE** | 2026-10-01 (473 Tests Pass) |
| **Phase 8** | **AI & Automation** (Runtime Provider Adapters + Generate Modal UI + QA E2E + Verification Gate) | **COMPLETE** | 2026-10-02 (473 Tests Pass; 8.1–8.6 selesai) |

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

## 3. Langkah Selanjutnya (Next Immediate Gate)
1. ~~**Phase 8.4 — Fair-Use Enforcement UI**~~ **SELESAI 2026-10-02** (badge quota, cooldown, riwayat job + error message di Blok 2b).

2. ~~**Phase 8.5 — QA E2E Eksploratif AI Generator**~~ **SELESAI 2026-10-02**:
   * 34/34 pemeriksaan service + DB nyata (mock provider HTTP): PG 5→review→simpan 3, Short Answer (kunci), Essay (rubrik), quota 31 diblokir, cooldown 15 dtk diblokir, 4 mode error provider → job FAILED, RBAC 403, tenant isolation, plugin guard.
   * 3/3 invoke server action via HTTP (prod + sesi nyata) + smoke halaman `/login` & `/exams/question-bank`.
   * **Bug ditemukan & diperbaiki:** `requirePlugin` dapat string UUID → fitur generate selalu 403 (tertupuk mock test); metadata provider/model job diverifikasi ke env; validasi rubrik essay ditambahkan; kolom `ai_generation_usage` DB lokal di-rename (drift nol).
   * Sisa: klik-manual UI butuh harness browser (tidak tersedia di run cron) — opsional.

3. ~~**Phase 8.6 — Verification Gate**~~ **SELESAI 2026-10-02**:
   * `npx tsc --noEmit` **0** · `npm test` **473/473 pass, 0 fail** · `npm run build` **exit 0**.
   * DoD Strict (dijalankan per-suite): RBAC `rbac-fine-grained` 31/31 · Plugin Guard `validation-plugins` 22/22 · Tenant Isolation `tenant-isolation` 10/10 · AuditLog tercakup `question-bank` 45/45 (+ bulk-promotion, finance-core, master-data-importer) — semua 0 fail.
   * ROADMAP, PROGRESS, CHANGELOG, TODO diupdate.
   * *Catatan:* `prisma validate` diblokir scanner keamanan saat run cron (CLI prisma tidak bisa dieksekusi tanpa approval); tidak ada perubahan `schema.prisma` di fase ini.

4. **Status: SELURUH FASE 0–8 COMPLETE.** Tidak ada tugas fase berjalan yang tertunda. Sisa opsional/bukan blocker:
   * Klik-manual UI AI Generator (butuh harness browser — tidak tersedia di run cron).
   * Simulasi timeout provider AI menggantung (belum disimulasikan).
   * Pasang API key provider AI nyata (OpenAI/Anthropic/Gemini) di deployment — keputusan Arsyad.
   * Checkbox legacy di ROADMAP fase lama (Phase 0–6) sebagian basi/tidak ikut diperbarui — audit silang terpisah bila diperlukan; `Offline Sync & Idempotency Key` adalah item yang benar-benar belum ada.
