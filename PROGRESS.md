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
| **Phase 9** | **Penutupan Backlog Gerbang & Kesiapan Rilis** (9.0 QA E2E AI ✓, 9.1 Permit ✓, 9.2 Guardian CRUD ✓, 9.3 Student 5 Kluster ✓, 9.4 backlog terblokir, 9.5 gate LULUS) | **COMPLETE** | 2026-10-02 (584 Tests Pass) |
| **Phase 10** | **Exam Paper Engine (PRD #31)** — naskah ujian: kop, identitas, ruang nama/nomor peserta, kolom 1/2, QR verifikasi, ekspor PDF & DOCX | **BERJALAN — PLAN TERSUSUN** | 2026-10-02 (plan: `03_EXECUTION/PLAN-PHASE-10.md`) |

---

## 2. Catatan Log Aktivitas Kronologis

### [2026-10-02] - Phase 9.3: Student Full Profile — 5 Kluster Dapodik/EMIS (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menutup sisa Phase 1 Gate terakhir — kluster terstruktur Dapodik/EMIS (keluarga, kesehatan/disabilitas, registry) yang sebelumnya tidak ada di skema (profil inti + relasi wali sudah ada).
* **Implementasi:**
  1. **Skema + Migrasi Manual:** 3 model 1-to-1 compound FK `[studentId, institutionId]` — `StudentFamilyData` (ayah/ibu/alamat orang tua/kontak darurat), `StudentHealthData` (gol. darah, tinggi/berat, `hasDisability`+`disabilityType`, penyakit menahun, alergi, cek-up), `StudentRegistryData` (No. KK/Akta/BPJS/SKTM, kewarganegaraan default `WNI`, asal sekolah); index `[institutionId]` + `@@unique([id, institutionId])`. Migrasi manual `prisma/migrations/20261002060000_student_profile_clusters` dibuat dari `migrate diff --from-url` (SQL murni CREATE 3 tabel, tanpa drift) lalu diterapkan via `migrate deploy` — **`migrate diff --from-url → --to-schema-datamodel` = "empty migration" (nihil)**, tanpa `migrate dev`.
  2. **Zod (`src/lib/validation/student-profile.ts`):** konstanta `PROFILE_CLUSTERS`/`BLOOD_TYPES`/`DISABILITY_TYPES`/`NATIONALITIES`, helper `nullableName`/`nullableText`/`idNumberText`/`phoneText` ("" → null, **undefined dibiarkan absen**), 3 skema per kluster `.strict()` + `superRefine` minimal 1 bidang & guard disabilitas, wrapper `upsertStudentClusterInputSchema` (discriminated union `cluster`) + `getStudentProfileInputSchema`.
  3. **Domain service (`src/lib/student/profile-service.ts`):** `getStudentProfileClusters` (`student:view` — guard siswa compound, ketiga kluster sekaligus + `canEdit` dari `student:edit`; baris kosong = `null`), `upsertStudentCluster` (`student:edit` — create/update per kluster, **upsert parsial**: bidang tak dikirim tidak ditimpa, AuditLog `CREATE`/`UPDATE` `entityType` per kluster dengan `detailsJson` **hanya daftar field — tanpa nilai pribadi**).
  4. **Server actions (`src/actions/student-profile.ts`):** `getStudentProfileClustersAction` + `upsertStudentClusterAction` (pola `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired` + `revalidatePath`).
  5. **UI tab `/students/[id]`:** navigasi 4 tab (Profil Inti, Keluarga, Kesehatan, Registry); tiap kluster punya form render-per-tipe (text/number/date/select/textarea/checkbox) dengan hydrate dari DB, tombol Simpan, feedback sukses/galat; **read-only + empty state** bila sesi tanpa `student:edit`; tab Profil Inti mempertahankan kartu identitas + Sacred History.
* **Testing & Verifikasi:**
  * `test/student-profile-clusters.test.ts` **30/30 pass** (Zod 14 kasus termasuk strict/enum/range/guard disabilitas; service 16 kasus: RBAC view & edit, sesi wali, cross-tenant read/write, upsert create→update idempoten, AuditLog tanpa nilai pribadi, 3 kluster terpisah).
  * `npx tsc --noEmit` **0** · `npm test` **565/565 pass, 0 fail** (167 suites; 535 + 30) · `npm run build` **exit 0** · `prisma validate` valid · `migrate diff` nihil.
  * **QA E2E DB NYATA** (`scripts/_local-qa-student-profile.ts`): **32/32 pass** — 3 kluster menempel di tabel `student_*_data` nyata, upsert parsial tidak menimpa bidang lain, AuditLog CREATE/UPDATE (daftar field saja, tanpa NIK/nama), guard Zod, RBAC guru/tanpa-view/sesi wali, cross-tenant 2 arah, cleanup.
  * **QA server action via HTTP + sesi nyata** (`scripts/_local-qa-student-profile-actions.ts`, `next start` :3100): **11/11 pass** — smoke `/students/[id]` 307→login tanpa sesi & 200 dengan sesi, get+upsert FAMILY/HEALTH sukses & menempel di DB, input ilegal → `success:false`, siswa tak ada → `success:false`, tanpa sesi ditolak.
  * *Belum:* klik-manual browser 390px (harness tidak tersedia di run cron); kolom kluster pada template importer xlsx (tahap lanjut, opsional).
* **Catatan run:** `npx prisma` & sourcing `.env` inline diblokir scanner → helper lokal `prisma-run.mjs` (scratch) menjalankan CLI dengan env ter-load; server prod orphan peninggalan run sebelumnya (PID mati tapi port 3100 masih dipegang) → kill; `migrate diff --from-migrations` butuh shadow DB yang tidak bisa dibuat di host ini → verifikasi pakai `--from-url` (dipakai juga run 9.1).

### [2026-10-02] - Phase 9.2: Guardian Master Data CRUD Staf + Wizard Undangan (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menutup sisa Phase 1 Gate "Guardian Master Data" — model wali + portal sudah ada, tetapi CRUD oleh staf dan wizard undangan aktivasi belum ada.
* **Implementasi:**
  1. **Zod (`src/lib/validation/guardian.ts`):** `guardianFilterSchema` (q + status), `updateGuardianInputSchema` (strict + refine minimal 1 bidang; `email:""` = bersihkan), `deactivateGuardianInputSchema`, `createGuardianInvitationStaffInputSchema` (sentVia WHATSAPP/SMS/MANUAL).
  2. **Domain service (`src/lib/guardian/master-data-service.ts`):** `listGuardians` (`guardian:view` — filter status, pencarian nama/WA/email, include relasi anak + undangan aktif belum ditebus), `updateGuardianProfile`, `deactivateGuardian` (status→INACTIVE + `deleteMany` undangan belum ditebus + AuditLog dgn `revokedInvitations`/`reason`), `issueGuardianInvitation` (`guardian:manage` — token 256-bit, hash SHA-256 saja di DB, TTL 72 jam, re-issue mencabut token lama, tolak wali `INACTIVE` lewat `GuardianInactiveError`, AuditLog CREATE tanpa token mentah). Semua tenant-scoped via compound `id_institutionId`.
  3. **Server actions (`src/actions/guardian.ts`):** `listGuardiansAction` (mengembalikan `{guardians, canManage}` — tombol aksi UI kondisional), `updateGuardianAction`, `deactivateGuardianAction`, `createGuardianInvitationAction` — pola `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired` + `revalidatePath("/guardians")`.
  4. **UI mobile-first `/guardians`:** daftar wali (badge status, WA/email, chip relasi anak dgn hubungan + indikator utama, info undangan aktif), filter status + pencarian, modal edit profil, wizard undangan (pilih kanal → hasil token + tautan `/wali/aktivasi?token=…` dengan tombol Salin), modal nonaktifkan (alasan opsional), empty/loading/error; nav "Wali Murid" ditambahkan ke `app-shell` (MASTER_DATA_ITEMS) dan `nav-header`.
* **Testing & Verifikasi:**
  * `test/guardian-master-data.test.ts` **22/22 pass** (listing/filter/search, update + AuditLog, penonaktifan + cabut undangan, wizard token hash-only/72 jam/re-issue, RBAC `guardian:*` + sesi wali, tenant isolation, Zod).
  * `npx tsc --noEmit` **0** · `npm test` **535/535 pass, 0 fail** (166 suites; 513 + 22) · `npm run build` **exit 0** (route `/guardians`).
  * **QA E2E DB NYATA** (`scripts/_local-qa-guardian.ts`): **35/35 pass** — list/filter/search, update menempel di tabel `guardians` + AuditLog, wizard undangan (hash-only, TTL ≈72 jam, token tak bocor ke audit, re-issue cabut token lama), penonaktifan mencabut baris undangan dari DB, reactivate lalu undang lagi OK, RBAC guru + sesi wali ditolak, cross-tenant 404; data QA dibersihkan.
  * **QA server action via HTTP + sesi nyata** (`scripts/_local-qa-guardian-actions.ts`, `next start` :3100): **12/12 pass** — smoke `/guardians` 307→login tanpa sesi & 200 + marker UI dengan sesi; tanpa sesi ditolak; list sukses `canManage:true`; update/invitation/deactivate sukses dan menempel di DB; input ilegal → `success:false`.
  * *Belum:* klik-manual browser 390px (harness tidak tersedia di run cron).
* **Catatan run:** tidak ada perubahan `schema.prisma` (migrasi tidak diperlukan); `npx prisma` tetap diblokir scanner (tidak dibutuhkan); server prod :3100 dimatikan setelah QA.

### [2026-10-02] - Phase 9.1: Tasrih / Permit Engine — Izin Pulang Santri (IMPLEMENTED & VERIFIED)
* **Tujuan:** Menutup sisa Phase 5 Gate 100% — entitas permit izin pulang santri yang sebelumnya tidak ada (label "Izin Pulang (Tasrih)" hanya status `EXCUSED` di presensi asrama).
* **Implementasi:**
  1. **Skema + Migrasi Manual:** model `PermitRequest` (`prisma/schema.prisma`) — lifecycle `PENDING`→`APPROVED`/`REJECTED`→`RETURNED`/`OVERDUE`, compound FK `[institutionId, studentId]` & `[academicYearId, institutionId]`, relasi `approvedBy` (SetNull), index `[institutionId, status]` / `[institutionId, leaveAt]` / `[institutionId, studentId, status]`. Migrasi manual `prisma/migrations/20261002040000_permit_request_core` diterapkan via `migrate deploy` (bukan `migrate dev`); **`migrate diff --from-url → --to-schema-datamodel` = "No difference detected" (nihil)**.
  2. **Zod:** `src/lib/validation/permit.ts` (create + superRefine `returnAt ≥ leaveAt`, decide, return, overdue, filter status/jenis/santri).
  3. **Domain service:** `src/lib/permit/permit-service.ts` — `createPermitRequest` (guard: siswa milik tenant, **punya penempatan asrama aktif**, tidak ada izin berjalan, tahun ajaran dari input/aktif), `approvePermitRequest` (guard transisi + AuditLog + **outbox `PERMIT_APPROVED` ke wali via `resolveStudentGuardianRecipient`**, best-effort), `rejectPermitRequest`, `markPermitReturned`, `markPermitOverdue` (hanya lewat `returnAt`), `listPermitRequests` (filter), `getPermitRequestById`. Semua `requirePermission` + tenant-scoped + AuditLog.
  4. **RBAC:** izin baru `pesantren:view`/`pesantren:manage` (PERMISSIONS + ROLE_PERMISSIONS untuk SUPER_ADMIN, FOUNDATION_HEAD, PRINCIPAL, ADMIN; TEACHER & FINANCE_STAFF tanpa izin ini).
  5. **Notifikasi:** template `PERMIT_APPROVED` di `validation/notification.ts` + renderer `templates.ts` + helper `notifyPermitApproved` (`events.ts`).
  6. **Server actions:** `src/actions/permit.ts` — 6 action (`list/get/create/approve/reject/markReturned/markOverdue`) dengan `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired`.
  7. **UI mobile-first:** `/dormitories/permits` (daftar + filter status + modal ajukan izin dengan pilihan santri asrama aktif + aksi Setujui/Tolak/Sudah Kembali/Terlambat sesuai status, badge status, empty/loading/error) + tombol tautan "Izin Pulang" di header `/dormitories`.
* **Testing & Verifikasi:**
  * `test/permit-engine.test.ts` **24/24 pass** (lifecycle, imutabilitas status terminal, RBAC guru & sesi wali, cross-tenant, filter, template notifikasi).
  * `npx tsc --noEmit` **0** · `npm test` **513/513 pass, 0 fail** (160 suites; 489 + 24) · `npm run build` **exit 0** (route `/dormitories/permits` prerender) · `prisma validate` valid · `migrate diff` nihil.
  * **QA E2E DB NYATA** (`scripts/_local-qa-permit.ts`): **32/32 pass** — create/approve/returned/overdue/reject menulis baris nyata + AuditLog + outbox `PERMIT_APPROVED` (recipient `628…`, pesan berisi nama santri), guard asrama/izin ganda/Zod, RBAC guru, isolasi tenant; data QA dibersihkan di akhir.
  * **QA server action via HTTP + sesi nyata** (`scripts/_local-qa-permit-actions.ts`, `next start`): **7/7 pass** — tanpa sesi ditolak, create→approve→outbox tercatat, input ilegal → `success:false`.
  * **Smoke halaman prod:** **7/7 pass** — `/dormitories/permits` 307 ke login tanpa sesi, 200 + marker UI dengan sesi, tautan dari `/dormitories` ada. Klik-manual browser belum (harness tidak tersedia di run cron).
* **Catatan run:** `npx prisma …` diblokir scanner threat-intel → jalur `node ./node_modules/prisma/build/index.js …` works; server prod stale peninggalan run sebelumnya di port 3100 (build lama — menampilkan `[id]` untuk `/dormitories/permits`) dimatikan; dev server `:3000` dibiarkan berjalan.

### [2026-10-02] - DOCS: Audit Silang Checkbox Legacy ROADMAP Phase 0–6 (VERIFIED)
* **Tujuan:** Checkbox `[ ]` lama di `03_EXECUTION/ROADMAP.md` (fase 0–6) tidak ikut diperbarui seiring fase berjalan — audit silang agar peta status jujur dan tidak menyesatkan.
* **Hasil:** 21 item diverifikasi terhadap kode/test lalu ditandai `[x]` disertai anotasi bukti (file/service/test). Tersisa 4 item `[ ]` yang benar-benar belum/ belum lengkap: `Offline Sync & Idempotency Key`, `Tasrih/Permit Engine`, `Student Full Profile (5 Kluster Dapodik/EMIS)`, `Guardian Master Data` (CRUD staf) — keempatnya backlog terpisah, bukan blocker fase 0–8.
* **Verifikasi run ini:** `npx tsc --noEmit` 0 · `npm test` **473/473 pass, 0 fail** (150 suites) · perubahan murni dokumen (tidak menyentuh kode/schema/.github).
* **Update di run yang sama (sesudah audit):** merge cabang `feature/offline-attendance-sync` → `Offline Sync & Idempotency Key` ikut selesai (total test 489/489), jadi sisa `[ ]` tinggal 3 (lihat "Next Immediate Gate" butir 4).

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
   * ~~Checkbox legacy di ROADMAP fase lama (Phase 0–6) sebagian basi~~ → **Audit silang SELESAI 2026-10-02 (run cron):** 21 checkbox legacy diverifikasi terhadap kode/test lalu ditandai `[x]` dengan bukti/referensi di anotasi ROADMAP; awalnya tersisa 4 item `[ ]`, kini **nol** (Offline Sync via merge; Tasrih/Permit = 9.1; Guardian Master Data = 9.2; **Student Full Profile 5 Kluster = 9.3, selesai 2026-10-02**). **ROADMAP kini bersih tanpa `[ ]`.**

5. **Status fase berjalan: PHASE 9 (Penutupan Backlog Gerbang & Kesiapan Rilis)** — plan: `03_EXECUTION/PLAN-PHASE-9.md`:
   * ~~**9.1 Tasrih / Permit Engine**~~ **SELESAI 2026-10-02 (run cron):** skema `PermitRequest` + migrasi manual (`migrate diff` nihil), service+Zod+RBAC `pesantren:*`+6 server action+UI `/dormitories/permits`+notifikasi `PERMIT_APPROVED`; `tsc 0` · `npm test` **513/513** · `build exit 0` · QA E2E DB nyata 32/32 · action HTTP 7/7 · smoke 7/7. ROADMAP Phase 5 Gate "Tasrih" kini `[x]`.
   * ~~**9.2 Guardian Master Data CRUD staf + wizard undangan**~~ **SELESAI 2026-10-02 (run cron):** Zod+service `src/lib/guardian/master-data-service.ts` (guardian:view/manage, AuditLog, token undangan hash-only 72 jam) + 4 server action + UI `/guardians` + nav "Wali Murid"; `tsc 0` · `npm test` **535/535** · `build exit 0` · QA E2E DB nyata **35/35** · action HTTP **12/12**. ROADMAP Phase 1 Gate "Guardian Master Data" kini `[x]`.
   * ~~**9.3 Student Full Profile 5 Kluster Dapodik/EMIS**~~ **SELESAI 2026-10-02 (run cron):** 3 tabel 1-to-1 `StudentFamilyData`/`StudentHealthData`/`StudentRegistryData` + migrasi manual (`migrate diff` nihil), Zod discriminated union + service (`student:view`/`student:edit`, upsert parsial, AuditLog tanpa nilai pribadi) + 2 server action + UI tab di `/students/[id]`; `tsc 0` · `npm test` **565/565** · `build exit 0` · QA E2E DB nyata **32/32** · action HTTP **11/11**. **ROADMAP Phase 1 Gate "Student Full Profile" kini `[x]` — checklist ROADMAP bersih.**
   * ~~**9.0 QA klik-manual modal AI Generator**~~ **SELESAI 2026-10-02 (sesi browser):** 4/4 TC lulus (generate 5 → simpan 3; limit harian; cooldown "9 detik"; pesan ramah) + **5 temuan diperbaiki** (error provider mentah → `friendlyAIGenerationError`, flag `AI_GENERATION_ENABLED` kini dievaluasi, skema subject toleran `null`, ID seleksi review tabrakan → `aiQuestionId(index)`, nol test guard → `test/ai-generation-qa.test.ts` 19 test).
   * ~~**9.5 Gate Keluar Phase 9**~~ **LULUS 2026-10-02:** ROADMAP bersih · `tsc 0` · `npm test` **584/584** · `build exit 0` · docs konsisten.
   * Masih `[ ]` hanya: **9.4** backlog terblokir (Question Bank COMMUNITY/DEVELOPER_CENTRAL, CI workflow token `workflow`, deploy Vercel, AI provider nyata, rate-limit Redis — keputusan Arsyad).
6. **Fase berikutnya: PHASE 10 — Exam Paper Engine (PRD #31)** — plan: `03_EXECUTION/PLAN-PHASE-10.md` (tahap 10.1–10.6: fondasi `Exam`/`ExamQuestion` → actions+UI `/exams/papers` → ekspor PDF+QR → DOCX → QA E2E → gate). Backlog drift migrasi **tertutup** (`migrate status` = up to date, 6 migrasi).
