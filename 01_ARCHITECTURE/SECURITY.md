# Security Architecture & Tenant Isolation - NataSekolah

## 1. Security Boundary: Institution Id
* `institution_id` adalah batas keamanan mutlak (*absolute perimeter*).
* Setiap akses baca dan tulis data operasional wajib menyertakan filter `institutionId = session.institutionId`.
* **Cross-Tenant Access Detection:** Upaya manipulasi `institutionId` yang berbeda dari sesi terotentikasi langsung menghasilkan `TenantAccessDeniedError` (HTTP 403) dan dicatat sebagai potensi insiden keamanan.

---

## 2. Extraction of Tenant Context
* **Zero Client Trust:** Tidak ada query atau server action yang mempercayai `institutionId` yang dikirim dari klien via request body, query params, atau headers.
* **Server Resolution:** Sesi pengguna divalidasi dari cookie `natasekolah_session` (SHA-256 hashed token di basis data) -> `User` / `Guardian` -> `Institution`.
* **AsyncLocalStorage Propagation:** `runWithTenantContext()` mengunci konteks institusi aktif untuk seluruh siklus pemrosesan request.

---

## 3. Database Layer Hardening (Cross-Tenant Integrity)
* Relasi antar-entitas anak wajib menggunakan *Compound Foreign Keys*:
  * Contoh `GuardianStudent`:
    ```sql
    FOREIGN KEY (guardianId, institutionId) REFERENCES guardians(id, institutionId)
    FOREIGN KEY (studentId, institutionId) REFERENCES students(id, institutionId)
    ```
  * Menjamin di level mesin PostgreSQL bahwa data wali dan santri dari institusi yang berbeda tidak dapat dihubungkan, bahkan jika kode aplikasi mengalami celah logika.

---

## 4. Mitigasi Risiko Tenant Leakage
1. **Query Leaks:** Dicegah dengan helper sentral `enforceTenantFilter(whereClause, context)`.
2. **Context Bleeding (Node.js concurrency):** Dicegah dengan isolasi ketat `AsyncLocalStorage` yang diuji dengan pengujian asinkron paralel.
3. **Session Hijacking:** Menggunakan HttpOnly, Secure, SameSite=Lax cookie berumur 7 hari dengan regenerasi berkala.
4. **Token Storage:** Token sesi acak 256-bit di-hash dengan SHA-256 sebelum disimpan di basis data. Basis data tidak pernah menyimpan token mentah (*plain token*).

---

## 5. Dual-Track Session Model (Phase 0.1A)
* Model `Session` terpadu mendukung dua jenis subjek identitas melalui kolom `subjectType`:
  * `INTERNAL_USER`: Wajib memiliki relasi ke entitas `User` dan `guardianId` bernilai `null`.
  * `GUARDIAN`: Wajib memiliki relasi ke entitas `Guardian` dan `userId` bernilai `null`.
* Pelanggaran invariant ini ditolak secara keras oleh `SessionInvariantError`.
* Kolom `institutionId` pada `Session` wajib identik dengan `institutionId` milik entitas subjek (`User` atau `Guardian`), mencegah sesi aktif tertaut pada institusi yang salah.

---

## 6. Guardian Access Control (ReBAC)
* Akses wali murid dikendalikan oleh hubungan perwalian yang sah (`GuardianStudent`).
* Helper `assertGuardianStudentAccess` dan `requireGuardianStudentAccess` memastikan:
  1. Hubungan perwalian terdaftar di database (`guardianId`, `studentId`).
  2. Sesi wali terikat pada lembaga yang sama (`institutionId`).
  3. Santri asuh terikat pada lembaga yang sama (`institutionId`).
* Upaya wali mengakses siswa lain di lembaga yang sama maupun lembaga yang berbeda secara mutlak menghasilkan `GuardianAccessDeniedError` (HTTP 403).

---

## 7. Fine-Grained RBAC untuk Internal Lembaga (Phase 0.2)
* **6 Peran Resmi:**
  1. `SUPER_ADMIN`: Administrasi platform global (tetap terikat `subjectType: INTERNAL_USER`).
  2. `FOUNDATION_HEAD`: Tata kelola lembaga, keuangan, staf, dan pengaturan yayasan.
  3. `PRINCIPAL`: Kepemimpinan akademik sekolah, kelas, siswa, guru, dan visibilitas keuangan (view only).
  4. `ADMIN`: Operator data siswa, kelas, presensi, akademik, dan manajemen wali murid.
  5. `TEACHER`: Pengajaran, pengisian nilai, dan presensi harian (dibatasi oleh Teacher Assignment di domain layer).
  6. `FINANCE_STAFF`: Tagihan SPP, kas, dan pembayaran (terisolasi dari akademik).
* **Isolasi Wali dari RBAC:** Sesi wali (`subjectType: GUARDIAN`) secara mutlak ditolak oleh `requirePermission()` dan `requireRole()`. Akses wali hanya dilayani melalui ReBAC (`GuardianStudent`).
* **Teacher Assignment Boundary:** Role `TEACHER` memberikan izin level peran (`academic:view`, `attendance:manage`), sedangkan hak akses santri/kelas riil dibatasi pada domain layer melalui penugasan kelas (*Teacher Assignment*).
* **Anti-Tampering:** Klien tidak dapat menyuntikkan `role`, `roles`, `permissions`, atau `isSuperAdmin` via request payload; `sanitizeClientInput()` secara aktif membuang atribut tersebut.

---

## 8. Input Validation Boundary & Hierarchical Authorization (Phase 0.3)
* **Pemisahan Validasi vs Otorisasi:** Skema Zod (`src/lib/validation/*`) hanya bertugas memvalidasi sintaksis dan bentuk data input (panjang string, format email, nomor HP, enum domain). Lulus validasi Zod **TIDAK** berarti klien memiliki hak akses.
* **Pembersihan Parameter Keamanan:** `sanitizeClientInput()` memastikan atribut keamanan sensitif (`institutionId`, `userId`, `guardianId`, `role`, `roles`, `permissions`, `isSuperAdmin`) dibuang dari payload klien dan diikatkan mutlak ke server session.
* **Rantai Otorisasi 5 Tingkat (Hierarchical Authorization Chain):**
  $$\text{Zod Input Validation} \longrightarrow \text{Validated Session} \longrightarrow \text{Tenant Isolation} \longrightarrow \text{RBAC Role / Permission} \longrightarrow \text{Plugin Guard} \longrightarrow \text{Domain Resource}$$
* **Plugin Security:** Server membaca `enabledPlugins` dari basis data institusi terotentikasi. Klien tidak dapat menyisipkan `enabled=true` pada query/request.

---

## 9. Keamanan Kesiswaan & Enrollment Engine (Phase 1)
* **Pertahanan Cross-Tenant Enrollment:**
  Upaya mendaftarkan siswa dari Lembaga A ke rombel atau tahun ajaran Lembaga B secara otomatis digagalkan di layer domain service (`ResourceNotFoundError` 404) dan dijaga secara fisik oleh database compound foreign keys `[studentId, institutionId]`, `[academicYearId, institutionId]`, dan `[classroomId, academicYearId, institutionId]`.
* **Integritas Tahun Ajaran (Academic Year Invariant):**
  Rombel dan enrollment wajib memiliki tahun ajaran yang identik. Upaya memasukkan rombel tahun 2025 ke dalam enrollment tahun 2026 dicegah dengan `AcademicYearMismatchError` (HTTP 400).
* **Anti-Collusion NIS:**
  NIS unik dijamin per institusi (`@@unique([institutionId, nis])`). Dua siswa dalam institusi yang sama dilarang memiliki NIS identik, namun siswa di institusi berbeda bebas memiliki NIS serupa tanpa tabrakan data.

---

## 10. Keamanan Pengajaran & Resource Scope Penugasan Guru (Phase 2)
* **Pertahanan Cross-Tenant TeacherAssignment:**
  Upaya membuat penugasan mengajar dengan menyilangkan Guru, Mata Pelajaran, Rombel, atau Tahun Ajaran milik lembaga lain ditolak di domain service (`ResourceNotFoundError` 404) dan dijaga ketat di tingkat PostgreSQL oleh compound foreign keys:
  - `[teacherId, institutionId]`
  - `[subjectId, institutionId]`
  - `[academicYearId, institutionId]`
  - `[classroomId, academicYearId, institutionId]`
* **Tenant-Scoped Subject Code:**
  Keunikan kode mata pelajaran diisolasi per lembaga (`@@unique([institutionId, code])`). Lembaga A dan Lembaga B dapat sama-sama memiliki kode `MTK` tanpa benturan data.
* **Teacher Resource Scope Enforcement:**
  Pengguna dengan peran `TEACHER` murni secara otomatis hanya dapat melihat dan mengakses penugasan mengajar miliknya sendiri (`teacherId = session.userId`). Mencoba mengueri penugasan guru lain secara sepihak menghasilkan `TeacherAssignmentAccessDeniedError` (HTTP 403).
* **Strict Administrative Permission for Mutations:**
  Seluruh aksi pembuatan, pembaruan, dan pembatalan penugasan mengajar wajib memiliki izin administratif `academic:manage`. Guru biasa dilarang memanipulasi penugasan ajar tanpa izin.

---

## 11. Keamanan Presensi, Batasan Guru & Immutability Sesi (Phase 3)
* **Teacher Scope on Attendance:**
  Guru hanya diizinkan melihat, membuka sesi, mencatat kehadiran, dan menutup sesi untuk penugasan mengajar miliknya sendiri (`teacherId = session.userId`). Upaya mengakses atau mengotak-atik sesi guru lain menghasilkan `AttendanceAccessDeniedError` (HTTP 403).
* **Pertahanan Cross-Tenant pada Absensi:**
  Sesi absensi tidak dapat dibuat menggunakan `TeacherAssignment` milik lembaga lain (`ResourceNotFoundError` 404). Pencatatan kehadiran siswa milik lembaga lain secara mutlak ditolak (`InvalidAttendanceContextError` 400). Integritas dijaga secara fisik di level database oleh compound foreign keys:
  ```prisma
  session    AttendanceSession @relation(fields: [attendanceSessionId, institutionId], references: [id, institutionId], onDelete: Cascade)
  student    Student           @relation(fields: [studentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  enrollment Enrollment        @relation(fields: [enrollmentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  ```
* **Perlindungan Cross-Classroom & Cross-Year:**
  Siswa yang dicatat kehadirannya WAJIB memiliki `Enrollment` aktif (`status = "ENROLLED"`, `Student.status = "ACTIVE"`) pada rombel dan tahun ajaran yang persis sama dengan penugasan mengajar. Siswa rombel lain atau tahun ajaran lain ditolak dengan `InvalidAttendanceContextError` (HTTP 400).
* **Immutability of Closed Sessions (Perlindungan Retroaktif):**
  Setelah sesi diubah statusnya menjadi `CLOSED`, seluruh pembaruan atau penambahan kehadiran ditolak secara permanen (`AttendanceSessionClosedError` HTTP 400). Sesi hanya dapat ditutup jika seluruh siswa eligible dalam rombel telah memiliki catatan kehadiran (`AttendanceIncompleteError` HTTP 400). Rekaman kehadiran pada sesi yang ditutup tetap dapat dibaca untuk kebutuhan audit dan pelaporan.

