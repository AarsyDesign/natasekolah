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

