# Database Architecture & Principles - NataSekolah

## 1. Engine & ORM
* **Database:** PostgreSQL
* **ORM:** Prisma ORM
* **Schema Location:** `prisma/schema.prisma`

---

## 2. Prinsip Baku Basis Data

### A. Tenant Isolation by Design
* Setiap entitas inti wajib memiliki foreign key `institutionId`.
* Foreign key dikonfigurasi dengan `onDelete: Cascade` terhadap institusi induk untuk mencegah *orphan rows*.
* Indeks komposit selalu menyertakan `institutionId` untuk efisiensi filtering:
  * `@@index([institutionId, status])`
  * `@@index([institutionId, academicYearId])`
  * `@@unique([institutionId, nis])` pada model Student.

### B. Sacred History (Integritas Data Historis)
* **Kesiswaan:** `Student` **dilarang keras** menggunakan field `classroomId`.
  * Penempatan kelas wajib menggunakan entitas `Enrollment`:
    $$\text{Student} \longleftrightarrow \text{Enrollment} \longleftrightarrow \text{Classroom} + \text{AcademicYear}$$
  * Constraint: `@@unique([studentId, academicYearId])` memastikan 1 siswa hanya memiliki 1 riwayat kelas aktif per tahun ajaran.
  * Kenaikan kelas atau kelulusan dicatat sebagai status enrollment baru tanpa pernah menimpa riwayat kelas masa lalu.
* **Keuangan:** Tidak ada *hard delete* untuk transaksi keuangan. Setiap pembatalan menggunakan status `VOID` atau `REVERSAL` yang tercatat dalam `AuditLog`.
* **E-Raport:** Raport yang diterbitkan dibekukan dalam format *frozen JSON snapshot*.

### C. Cross-Tenant Relational Integrity (Compound Foreign Keys)
* Relasi antar-entitas anak (`Enrollment`, `Classroom`, `GuardianStudent`) **wajib** menggunakan compound foreign key berpasangan dengan `institutionId`:
  ```prisma
  // Enrollment compound FKs:
  student      Student      @relation(fields: [studentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId, institutionId], references: [id, institutionId], onDelete: Cascade)
  classroom    Classroom    @relation(fields: [classroomId, academicYearId, institutionId], references: [id, academicYearId, institutionId], onDelete: Cascade)
  ```
* Menjamin secara fisik di level PostgreSQL bahwa hubungan siswa, rombel, dan tahun ajaran mustahil bersilang lintas-lembaga (*zero cross-tenant relational bleeding*), serta menjamin rombel pada enrollment cocok dengan tahun ajaran terkait (*no academic year mismatch*).

---

## 3. Matriks Entitas Platform (Phase 0 s.d. Phase 1)

| Entitas | Peran | Constraints Kunci | Indeks Kunci |
| :--- | :--- | :--- | :--- |
| `Institution` | Tenant Root | `slug @unique` | `[slug]`, `[type]` |
| `User` | Staf / Guru / Admin | `@@unique([institutionId, email])` | `[institutionId, isActive]` |
| `AcademicYear` | Tahun Ajaran | `@@unique([id, institutionId])`, `@@unique([institutionId, name])` | `[institutionId, isActive]` |
| `Classroom` | Rombongan Belajar | `@@unique([id, institutionId])`, `@@unique([id, academicYearId, institutionId])`, `@@unique([institutionId, academicYearId, name])` | `[institutionId, academicYearId]` |
| `Student` | Master Buku Induk Siswa | `@@unique([id, institutionId])`, `@@unique([institutionId, nis])` | `[institutionId, status]`, `[institutionId, fullName]`, `[institutionId, nisn]` |
| `Enrollment` | Histori Penempatan Rombel | `@@unique([studentId, academicYearId])`, `@@unique([id, institutionId])` | `[institutionId, academicYearId, classroomId]`, `[institutionId, status]` |
| `Subject` | Katalog Mata Pelajaran | `@@unique([id, institutionId])`, `@@unique([institutionId, code])` | `[institutionId, isActive]` |
| `TeacherAssignment` | Matriks Penugasan Mengajar Guru | `@@unique([teacherId, subjectId, classroomId, academicYearId])`, `@@unique([id, institutionId])` | `[institutionId, academicYearId]`, `[institutionId, teacherId]`, `[institutionId, subjectId]`, `[institutionId, classroomId]` |
| `AttendanceSession` | Sesi Presensi Harian Guru | `@@unique([id, institutionId])`, `@@unique([teacherAssignmentId, attendanceDate])` | `[institutionId, attendanceDate]`, `[institutionId, status]`, `[institutionId, teacherAssignmentId]` |
| `AttendanceRecord` | Rekaman Kehadiran Siswa | `@@unique([id, institutionId])`, `@@unique([attendanceSessionId, studentId])` | `[institutionId, attendanceSessionId]`, `[institutionId, studentId]`, `[institutionId, enrollmentId]`, `[institutionId, status]` |
| `AuditLog` | Jejak Audit Keamanan | - | `[institutionId, createdAt]`, `[institutionId, entityType, entityId]` |
| `Session` | Sesi Terpadu (Staf & Wali) | `tokenHash @unique` | `[tokenHash]`, `[userId]`, `[guardianId]`, `[institutionId]`, `[expiresAt]` |
| `Guardian` | Profil Wali Murid | `@@unique([id, institutionId])` | `[institutionId, phoneWa]`, `[institutionId, status]` |
| `GuardianStudent` | Relasi Siswa-Wali (ReBAC) | `@@unique([guardianId, studentId])` | `[institutionId, studentId]`, `[institutionId, guardianId]` |
| `GuardianInvitation` | Token Aktivasi 1x Pakai | `tokenHash @unique` | `[tokenHash]`, `[guardianId, expiresAt]`, `[institutionId]` |
| `FeeCategory` | Master Katalog Jenis Biaya | `@@unique([id, institutionId])`, `@@unique([institutionId, code])` | `[institutionId, isActive]` |
| `StudentCharge` | Kewajiban Tagihan Siswa (Snapshot) | `@@unique([id, institutionId])` | `[institutionId, studentId]`, `[institutionId, status]`, `[institutionId, feeCategoryId]` |
| `PaymentTransaction` | Penerimaan Kas Riil | `@@unique([id, institutionId])`, `@@unique([institutionId, transactionNumber])` | `[institutionId, studentId]`, `[institutionId, paymentDate]` |
| `PaymentAllocation` | Alokasi Pembayaran ke Tagihan | `@@unique([id, institutionId])`, `@@unique([paymentTransactionId, studentChargeId])` | `[institutionId, paymentTransactionId]`, `[institutionId, studentChargeId]` |
| `CashbookEntry` | Buku Kas Umum (BKU) | `@@unique([id, institutionId])`, `@@unique([institutionId, entryNumber])`, `@@unique([paymentTransactionId, institutionId])` | `[institutionId, entryDate]`, `[institutionId, type]` |
| `Receipt` | Bukti Pembayaran / Kwitansi | `@@unique([id, institutionId])`, `@@unique([institutionId, receiptNumber])`, `@@unique([paymentTransactionId, institutionId])` | `[institutionId, issuedAt]` |
| `Assessment` | Penilaian Akademik Guru | `@@unique([id, institutionId])` | `[institutionId, teacherAssignmentId]`, `[institutionId, type]` |
| `AssessmentScore` | Nilai Siswa per Assessment | `@@unique([id, institutionId])`, `@@unique([assessmentId, studentId])` | `[institutionId, assessmentId]`, `[institutionId, studentId]`, `[institutionId, enrollmentId]` |
| `ReportCard` | Buku Raport Siswa (Snapshot) | `@@unique([id, institutionId])`, `@@unique([enrollmentId, semester])` | `[institutionId, studentId]`, `[institutionId, academicYearId, classroomId]`, `[institutionId, status]` |
| `ReportCardSubject` | Nilai Akhir Mapel Raport | `@@unique([id, institutionId])`, `@@unique([reportCardId, subjectId])` | `[institutionId, reportCardId]`, `[institutionId, subjectId]` |
| `TahfidzRecord` | Mutaba'ah Ziyadah & Muraja'ah | `@@unique([id, institutionId])` | `[institutionId, studentId]`, `[institutionId, enrollmentId]`, `[institutionId, date]` |
| `Dormitory` | Gedung Asrama Pesantren | `@@unique([id, institutionId])`, `@@unique([institutionId, name])` | `[institutionId, isActive]` |
| `DormitoryRoom` | Kamar Asrama & Kapasitas | `@@unique([id, institutionId])`, `@@unique([dormitoryId, name])` | `[institutionId, dormitoryId]` |
| `StudentDormitoryAssignment` | Riwayat Penempatan Kamar Santri | `@@unique([id, institutionId])` | `[institutionId, studentId]`, `[institutionId, roomId]`, `[institutionId, status]` |

---

## 4. Konfigurasi Plugin Domain di Basis Data (Phase 0.3)
* Konfigurasi domain plugin disimpan pada kolom `Institution.enabledPlugins` (`String @default("[\"FORMAL_ACADEMIC\"]")`).
* Nilai disimpan dalam format JSON string array tervalidasi (`["FORMAL_ACADEMIC", "PESANTREN_LIVING", "TAHFIDZ", "PKBM"]`).
* Mengikuti prinsip **single source of truth** tanpa membuat tabel relasi ganda prematur, dan terikat mutlak pada `institutionId`.

---

## 5. Keputusan Integritas Kesiswaan (Phase 1)
* **Student Identity is Independent from Classroom Membership:** Identitas siswa di Buku Induk berdiri sendiri tanpa menyimpan kolom `classroomId` secara langsung.
* **Enrollment as Single Source of Truth:** Seluruh data penempatan rombel, kenaikan kelas, dan mutasi kelas tersimpan dalam entitas `Enrollment`.
* **Integritas Relasi Rombel & Tahun Ajaran:** Foreign key komposit `[classroomId, academicYearId, institutionId]` mencegah pendaftaran enrollment pada rombel yang tidak terdaftar di tahun ajaran yang bersangkutan.

---

## 6. Keputusan Integritas Pengajaran Akademik (Phase 2)
* **Teacher Identity via User Model:** Guru/Ustadz tidak memiliki tabel login terpisah. Identitas guru adalah entitas `User` dengan peran `TEACHER` di dalam institusi yang sama.
* **Subject Tenant-Scoped Uniqueness:** Kode mata pelajaran bersifat unik per institusi (`@@unique([institutionId, code])`), memungkinkan lembaga berbeda menggunakan kode yang sama tanpa tabrakan.
* **Kuartet Penugasan Mengajar (TeacherAssignment):** Penugasan memetakan `Teacher` (User), `Subject`, `Classroom`, dan `AcademicYear` dengan constraint unik `@@unique([teacherId, subjectId, classroomId, academicYearId])`.
* **Compound Foreign Keys Hardening:** Seluruh foreign key `TeacherAssignment` dilindungi pasangan `institutionId`:
  - `teacher User @relation(fields: [teacherId, institutionId], references: [id, institutionId])`
  - `subject Subject @relation(fields: [subjectId, institutionId], references: [id, institutionId])`
  - `academicYear AcademicYear @relation(fields: [academicYearId, institutionId], references: [id, institutionId])`
  - `classroom Classroom @relation(fields: [classroomId, academicYearId, institutionId], references: [id, academicYearId, institutionId])`
* **Pencegahan Mismatch Fisik:** Relasi komposit ke `Classroom` secara fisik menggagalkan penugasan kelas di luar tahun ajaran rombel yang bersangkutan.

---

## 7. Keputusan Integritas Presensi & Absensi (Phase 3)
* **Absensi Bukan Kolom di Student:** Status kehadiran (`PRESENT`, `EXCUSED`, `SICK`, `ABSENT`) tidak pernah disimpan di `Student`. Sumber kebenaran absensi adalah relasi berjenjang:
  $$\text{TeacherAssignment} \longrightarrow \text{AttendanceSession} \longrightarrow \text{AttendanceRecord} \longrightarrow \text{Student / Enrollment}$$
* **Satu Sesi per Penugasan per Hari:** Constraint `@@unique([teacherAssignmentId, attendanceDate])` pada `AttendanceSession` menjamin tidak ada sesi ganda untuk penugasan yang sama pada hari kalender yang sama.
* **Dual-Key Pointer di AttendanceRecord:** `AttendanceRecord` menyimpan `studentId` DAN `enrollmentId`. Jika siswa berpindah kelas atau naik kelas di masa depan, catatan kehadiran historis tetap merujuk secara akurat pada enrollment rombel dan tahun ajaran saat absensi dicatat.
* **Compound Foreign Keys Anti Cross-Tenant:**
  ```prisma
  session    AttendanceSession @relation(fields: [attendanceSessionId, institutionId], references: [id, institutionId], onDelete: Cascade)
  student    Student           @relation(fields: [studentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  enrollment Enrollment        @relation(fields: [enrollmentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  ```

---

## 8. Keputusan Integritas Keuangan (Phase 4 — Finance Core)
* **Balance is NOT Source of Truth:** Saldo/tagihan tidak disimpan sebagai angka mutable di model `Student` atau `Institution`. Saldo selalu dihitung dinamis dari akumulasi transaksi.
* **StudentCharge Historical Snapshot:** Nominal kewajiban pembayaran (`StudentCharge.amount`) dibekukan sebagai *historical snapshot* saat tagihan dibuat. Perubahan nominal pada master `FeeCategory` tidak akan mengubah tagihan historis yang sudah terbentuk.
* **Atomic Payment Orchestration:** Pembayaran dialokasikan secara atomis dalam satu transaksi database Prisma (`$transaction`):
  $$\text{PaymentTransaction} \longrightarrow \text{PaymentAllocation} \longrightarrow \text{Charge Status Update} \longrightarrow \text{CashbookEntry} \longrightarrow \text{Receipt}$$
* **Financial Data Immutability & Reversal:** Transaksi pembayaran dan kwitansi bersifat *immutable* (tidak dapat di-edit atau dihapus). Koreksi keuangan dilakukan melalui transaksi pembatalan (`VOID` / `REVERSAL`).
* **Atomic Sequential Number Generation:** Nomor transaksi (`TRX-YYYYMM-XXXXXX`), nomor BKU (`CSH-YYYYMM-XXXXXX`), dan nomor kwitansi (`KW-YYYYMM-XXXXXX`) dihasilkan secara atomis berbasis urutan tanggal dan tenant ID, mencegah tabrakan *race condition*.

---

## 4. Konfigurasi Plugin Domain di Basis Data (Phase 0.3)
* Konfigurasi domain plugin disimpan pada kolom `Institution.enabledPlugins` (`String @default("[\"FORMAL_ACADEMIC\"]")`).
* Nilai disimpan dalam format JSON string array tervalidasi (`["FORMAL_ACADEMIC", "PESANTREN_LIVING", "TAHFIDZ", "PKBM"]`).
* Mengikuti prinsip **single source of truth** tanpa membuat tabel relasi ganda prematur, dan terikat mutlak pada `institutionId`.

---

## 5. Keputusan Integritas Kesiswaan (Phase 1)
* **Student Identity is Independent from Classroom Membership:** Identitas siswa di Buku Induk berdiri sendiri tanpa menyimpan kolom `classroomId` secara langsung.
* **Enrollment as Single Source of Truth:** Seluruh data penempatan rombel, kenaikan kelas, dan mutasi kelas tersimpan dalam entitas `Enrollment`.
* **Integritas Relasi Rombel & Tahun Ajaran:** Foreign key komposit `[classroomId, academicYearId, institutionId]` mencegah pendaftaran enrollment pada rombel yang tidak terdaftar di tahun ajaran yang bersangkutan.

---

## 6. Keputusan Integritas Pengajaran Akademik (Phase 2)
* **Teacher Identity via User Model:** Guru/Ustadz tidak memiliki tabel login terpisah. Identitas guru adalah entitas `User` dengan peran `TEACHER` di dalam institusi yang sama.
* **Subject Tenant-Scoped Uniqueness:** Kode mata pelajaran bersifat unik per institusi (`@@unique([institutionId, code])`), memungkinkan lembaga berbeda menggunakan kode yang sama tanpa tabrakan.
* **Kuartet Penugasan Mengajar (TeacherAssignment):** Penugasan memetakan `Teacher` (User), `Subject`, `Classroom`, dan `AcademicYear` dengan constraint unik `@@unique([teacherId, subjectId, classroomId, academicYearId])`.
* **Compound Foreign Keys Hardening:** Seluruh foreign key `TeacherAssignment` dilindungi pasangan `institutionId`:
  - `teacher User @relation(fields: [teacherId, institutionId], references: [id, institutionId])`
  - `subject Subject @relation(fields: [subjectId, institutionId], references: [id, institutionId])`
  - `academicYear AcademicYear @relation(fields: [academicYearId, institutionId], references: [id, institutionId])`
  - `classroom Classroom @relation(fields: [classroomId, academicYearId, institutionId], references: [id, academicYearId, institutionId])`
* **Pencegahan Mismatch Fisik:** Relasi komposit ke `Classroom` secara fisik menggagalkan penugasan kelas di luar tahun ajaran rombel yang bersangkutan.

---

## 7. Keputusan Integritas Presensi & Absensi (Phase 3)
* **Absensi Bukan Kolom di Student:** Status kehadiran (`PRESENT`, `EXCUSED`, `SICK`, `ABSENT`) tidak pernah disimpan di `Student`. Sumber kebenaran absensi adalah relasi berjenjang:
  $$\text{TeacherAssignment} \longrightarrow \text{AttendanceSession} \longrightarrow \text{AttendanceRecord} \longrightarrow \text{Student / Enrollment}$$
* **Satu Sesi per Penugasan per Hari:** Constraint `@@unique([teacherAssignmentId, attendanceDate])` pada `AttendanceSession` menjamin tidak ada sesi ganda untuk penugasan yang sama pada hari kalender yang sama.
* **Dual-Key Pointer di AttendanceRecord:** `AttendanceRecord` menyimpan `studentId` DAN `enrollmentId`. Jika siswa berpindah kelas atau naik kelas di masa depan, catatan kehadiran historis tetap merujuk secara akurat pada enrollment rombel dan tahun ajaran saat absensi dicatat.
* **Compound Foreign Keys Anti Cross-Tenant:**
  ```prisma
  session    AttendanceSession @relation(fields: [attendanceSessionId, institutionId], references: [id, institutionId], onDelete: Cascade)
  student    Student           @relation(fields: [studentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  enrollment Enrollment        @relation(fields: [enrollmentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  ```
* **Immutability of Closed Sessions:** Sesi berstatus `CLOSED` bersifat kekal (immutable). Operasi `markAttendance` ditolak secara permanen setelah sesi ditutup.

---

## 9. Keputusan Integritas Akademik Formal & Raport (Phase 5 — Formal Academic Core)
* **Assessment & Grade Terikat pada Kuartet Penugasan:** Penilaian (`Assessment`) tidak berdiri bebas melainkan terikat pada `TeacherAssignment` yang memiliki rombel, mata pelajaran, dan tahun ajaran definitif.
* **Enrollment Scope Verification:** Setiap nilai (`AssessmentScore`) wajib mencatat `enrollmentId`. Siswa dari rombel lain atau tahun ajaran lain ditolak secara fisik dan logis.
* **Published Report Card is a Frozen Historical Snapshot:** Raport berstatus `PUBLISHED` menyimpan data lengkap dalam kolom `frozenData` (JSON snapshot). Nilai raport tidak lagi bergantung pada query live yang rentan berubah ketika guru mengedit nilai masa lalu atau ketika siswa berpindah kelas.
* **Compound Foreign Keys Hardening:**
  ```prisma
  assessment Assessment @relation(fields: [assessmentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  reportCard ReportCard @relation(fields: [reportCardId, institutionId], references: [id, institutionId], onDelete: Cascade)
  ```

---

## 10. Keputusan Integritas Pesantren & Tahfidz Living (Phase 6)
* **Tahfidz Mutaba'ah Linked to Sacred Enrollment:**
  Catatan mutaba'ah (`TahfidzRecord`) terikat langsung pada `Student` dan `Enrollment` saat rekaman disetorkan. Kenaikan kelas, perubahan tahun ajaran, maupun perpindahan guru di masa mendatang tidak mengubah riwayat hafalan historis.
  ```prisma
  student    Student    @relation(fields: [studentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  enrollment Enrollment @relation(fields: [enrollmentId, institutionId], references: [id, institutionId], onDelete: Cascade)
  recorder   User       @relation(fields: [recordedBy, institutionId], references: [id, institutionId], onDelete: Cascade)
  ```
* **Dormitory Sacred History via Assignment Model:**
  Penempatan asrama santri dilarang keras disimpan di kolom statis `Student.roomId`. Sistem menggunakan model historis `StudentDormitoryAssignment`:
  $$\text{Student} \longleftrightarrow \text{StudentDormitoryAssignment} \longleftrightarrow \text{DormitoryRoom} \longleftrightarrow \text{Dormitory}$$
  Santri hanya boleh memiliki satu penempatan dengan status `ACTIVE` pada satu waktu. Saat santri berpindah kamar atau lulus, status berubah menjadi `ENDED` dengan `endDate`, menjaga seluruh riwayat kamar lampau tetap utuh.
* **Living Attendance Reusing Existing Attendance Core:**
  Sistem absensi asrama tidak menduplikasi mesin absensi kedua. `AttendanceSession` diperluas dengan diskriminator `context` (`ACADEMIC` atau `LIVING`) dan relasi opsional `dormitoryRoomId` berpasangan dengan `institutionId`:
  ```prisma
  dormitoryRoomId String?
  context         String         @default("ACADEMIC")
  dormitoryRoom   DormitoryRoom? @relation(fields: [dormitoryRoomId, institutionId], references: [id, institutionId], onDelete: Cascade)
  @@unique([dormitoryRoomId, attendanceDate])
  ```
  Roster absensi asrama secara otomatis ditarik dari penghuni kamar aktif (`StudentDormitoryAssignment.status == "ACTIVE"`), dan catatan kehadiran tersimpan di `AttendanceRecord` yang sama dengan dukungan integritas compound foreign keys.


