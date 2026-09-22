# Domain Model & Bounded Contexts - NataSekolah

## 1. Unified Core Model

```text
                       ┌─────────────────────────┐
                       │       Institution       │
                       │ (Multi-Tenant Root PK)  │
                       └────────────┬────────────┘
                                    │ 1
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │ *                       │ *                       │ *
┌─────────▼─────────┐     ┌─────────▼─────────┐     ┌─────────▼─────────┐
│       User        │     │   AcademicYear    │     │      Student      │
│ (Staff/Teacher/TU)│     │  (Tahun Ajaran)   │     │ (Identitas Pokok) │
└───────────────────┘     └─────────┬─────────┘     └─────────┬─────────┘
                                    │ 1                       │ 1
                                    │                         │
                          ┌─────────▼─────────┐               │
                          │     Classroom     │               │
                          │ (Rombongan Belajar)│              │
                          └─────────┬─────────┘               │
                                    │ 1                       │
                                    │                         │
                                    │ *                     * │
                                  ┌─▼─────────────────────────▼─┐
                                  │         Enrollment          │
                                  │ (Histori Penempatan Kelas)  │
                                  └─────────────────────────────┘
```

---

## 2. Prinsip One Student, One Identity
* Satu peserta didik hanya memiliki 1 baris utama di tabel `Student`.
* Identitas yang sama digunakan secara terpadu oleh:
  * Pembelajaran formal (KBM, nilai, raport).
  * Pondok pesantren (halaqah kitab, izin pulang/tasrih).
  * Tahfidz (setoran juz/ayat, mutaba'ah).
  * Asrama / Living (kamar, shalat berjamaah).
  * Keuangan / Kasir (iuran syahriah, SPP, daftar ulang).
* Tidak boleh ada duplikasi identitas santri hanya karena domain kegiatannya berbeda.

---

## 3. Dual-Track Identity & Access Model
Sistem memisahkan secara tegas dua jalur identitas:
```text
                         ┌─────────────────────────┐
                         │       Institution       │
                         │ (Multi-Tenant Root PK)  │
                         └────────────┬────────────┘
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         │                                                         │
[TRACK 1: INTERNAL STAFF (RBAC)]                          [TRACK 2: GUARDIAN (ReBAC)]
         │                                                         │
┌────────▼────────┐                                       ┌────────▼────────┐
│      User       │                                       │    Guardian     │
│ (Staff/Teacher) │                                       │(Wali Mahram/Ortu│
└────────┬────────┘                                       └────────┬────────┘
         │                                                         │
┌────────▼────────┐                                       ┌────────▼────────┐
│     Session     │◄──────────────────────────────────────┤ GuardianStudent │
│(INTERNAL_USER / │                                       │(Hubungan Siswa) │
│    GUARDIAN)    │                                       └────────┬────────┘
└─────────────────┘                                                │
                                                          ┌────────▼────────┐
                                                          │     Student     │
                                                          │(Peserta Didik)  │
                                                          └─────────────────┘
```
* **Track 1 (Internal Staff):** Otorisasi berbasis peran (**RBAC**). Pengguna memiliki kapabilitas tugas sekolah dengan 6 peran resmi: `SUPER_ADMIN`, `FOUNDATION_HEAD`, `PRINCIPAL`, `ADMIN`, `TEACHER`, dan `FINANCE_STAFF`. Akses guru dibatasi lebih lanjut melalui *Teacher Assignment* pada layer domain.
* **Track 2 (Wali Murid / Guardian):** Otorisasi berbasis relasi (**ReBAC**). Wali **TIDAK** memiliki hak akses fitur staf lembaga, melainkan hanya diizinkan mengakses data siswa yang secara sah terhubung via `GuardianStudent` (`assertGuardianStudentAccess` / `requireGuardianStudentAccess`).

---

## 4. Unified Core vs Toggleable Domain Plugins (Phase 0.3)
* **Unified Core (Selalu Aktif):**
  * Multi-Tenancy & Context
  * Identitas Staf & Wali (Dual-Track)
  * Buku Induk Kesiswaan Pokok (`Student`)
  * Penempatan Kelas Historis (`Enrollment`)
  * Keuangan Dasar & Kasir SPP 3-Tier
  * Presensi Cepat (< 60s)
  * Komunikasi Outbox WhatsApp
* **Toggleable Domain Plugins (Diaktifkan per Institusi):**
  * `FORMAL_ACADEMIC`: Raport Kurikulum Merdeka, Capaian Pembelajaran, penilaian formatif/sumatif, ujian.
  * `PESANTREN_LIVING`: Pengasuhan santri, kamar asrama, izin tasrih, mutaba'ah shalat.
  * `TAHFIDZ`: Setoran halaqah, pelacak target juz, ujian mutqin.
  * `PKBM`: Fleksibilitas paket kesetaraan, ujian modul warga belajar.
* Konfigurasi disimpan pada kolom `Institution.enabledPlugins` (JSON string array) dan dijaga ketat oleh `requirePlugin()`.

---

## 5. Master Data Engine & Sacred History Enrollment (Phase 1)
* **Student Entity (Buku Induk):**
  * Mempertahankan data primer peserta didik (NIS, NISN, NIK, Nama Lengkap, Tempat & Tanggal Lahir, Jenis Kelamin, Kontak, Alamat).
  * Status transisi kesiswaan terbatas: `ACTIVE`, `INACTIVE`, `GRADUATED`, `TRANSFERRED`, `ALUMNI`.
  * **Larangan Keras:** `Student` tidak boleh memiliki atribut `classroomId` langsung.
* **Academic Year Invariant:**
  * Satu institusi hanya boleh memiliki maksimal 1 tahun ajaran dengan status `isActive: true`.
  * Pengaktifan tahun ajaran baru secara otomatis menonaktifkan tahun ajaran sebelumnya secara atomik via Prisma transaction.
* **Classroom Entity (Rombel):**
  * Selalu terikat pada satu tahun ajaran tertentu (`academicYearId`) dan institusi induk (`institutionId`).
* **Enrollment Engine (Sacred History):**
  * Penempatan kelas disimpan dalam entitas `Enrollment` dengan compound key `[studentId, academicYearId]`.
  * Menjaga sejarah akademik: Saat santri naik kelas (misal dari Kelas 7A ke 8B), rekam jejak Kelas 7A tetap tersimpan abadi sebagai dokumen sejarah.
  * Dilindungi compound foreign keys ganda yang memastikan bahwa `Student`, `AcademicYear`, `Classroom`, dan `Enrollment` selalu berada di institusi yang sama, dan rombel yang dipilih terikat pada tahun ajaran yang bersangkutan.

---

## 6. Academic Teaching Core & Teacher Assignment (Phase 2)

```text
                        ┌─────────────────────────┐
                        │       Institution       │
                        │ (Multi-Tenant Root PK)  │
                        └────────────┬────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
 ┌─────────▼─────────┐     ┌─────────▼─────────┐     ┌─────────▼─────────┐
 │   User (Teacher)  │     │      Subject      │     │   AcademicYear    │
 │ (role = TEACHER)  │     │ (Mata Pelajaran)  │     │  (Tahun Ajaran)   │
 └─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘
           │                         │                         │
           │                         │               ┌─────────▼─────────┐
           │                         │               │     Classroom     │
           │                         │               │ (Rombongan Belajar│
           │                         │               └─────────┬─────────┘
           │                         │                         │
           └───────────────────┐     │     ┌───────────────────┘
                               │     │     │
                             ┌─▼─────▼─────▼─┐
                             │TeacherAssignment│
                             │(Kuartet Ajar) │
                             └───────────────┘
```

* **Teacher Identity Rule:** Guru adalah identitas internal lembaga (model `User` dengan peran `TEACHER`), bukan akun login terpisah. Tidak ada duplikasi autentikasi (`TeacherLogin` / `TeacherSession`).
* **Subject (Katalog Mata Pelajaran):**
  * Memiliki atribut `id`, `institutionId`, `name`, `code?`, `shortName?`, `category?`, `isActive`.
  * Kode bersifat unik per tenant (`@@unique([institutionId, code])`).
  * Kategori standar: `UMUM`, `AGAMA`, `MULOK`, `PEMINATAN`.
* **TeacherAssignment (Penugasan Mengajar):**
  * Memetakan kuartet: `Teacher` (User) + `Subject` + `Classroom` + `AcademicYear`.
  * Constraint: `@@unique([teacherId, subjectId, classroomId, academicYearId])` mencegah duplikasi penugasan mengajar identik pada tahun ajaran yang sama.
* **Assignment Invariants & Integrity:**
  * Seluruh entitas wajib memiliki `institutionId` yang sama.
  * `Classroom.academicYearId == TeacherAssignment.academicYearId`: assignment lintas tahun ajaran rombel fisik ditolak secara fisik oleh compound foreign key.
* **Historical Assignment Integrity:** Penugasan terikat pada `AcademicYear`, menjaga rekam jejak guru masa lalu tetap tersimpan abadi saat tahun ajaran berganti.
* **Teacher Resource Scope:**
  * Peran `TEACHER` menentukan kapabilitas umum, sedangkan `TeacherAssignment` menentukan batasan data riil (*resource scope*).
  * Guru hanya diizinkan melihat penugasan miliknya sendiri tanpa memerlukan hak akses administratif (`academic:manage`).
  * Guru tidak otomatis memiliki akses ke seluruh rombel sekolah, melainkan hanya rombel dan mapel yang secara resmi ditugaskan kepadanya.

---

## 7. Attendance Core & Historical Derivation (Phase 3)

```text
                        ┌─────────────────────────┐
                        │    TeacherAssignment    │
                        │ (Penugasan Mengajar)    │
                        └────────────┬────────────┘
                                     │ 1
                                     │
                                     │ * (1 per date: @@unique)
                        ┌────────────▼────────────┐
                        │    AttendanceSession    │
                        │ (attendanceDate, status)│
                        └────────────┬────────────┘
                                     │ 1
                                     │
                                     │ *
                        ┌────────────▼────────────┐
                        │    AttendanceRecord     │
                        │ (status, note, markedAt)│
                        └──────┬────────────┬─────┘
                               │            │
                  studentId    │            │  enrollmentId
                               │            │
                     ┌─────────▼─┐        ┌─▼─────────┐
                     │  Student  │        │ Enrollment│
                     └───────────┘        └───────────┘
```

* **Presensi Bukan Atribut Langsung Siswa:**
  Status kehadiran santri tidak disimpan pada kolom `Student` (misal `Student.attendanceStatus`), melainkan diturunkan dari transaksi sesi absensi harian.
* **Hierarki Sumber Kebenaran (Single Source of Truth):**
  $$\text{TeacherAssignment} \longrightarrow \text{AttendanceSession} \longrightarrow \text{AttendanceRecord} \longrightarrow \text{Student / Enrollment}$$
* **AttendanceSession (Sesi Absensi Guru):**
  * Terikat pada `TeacherAssignment` dan memiliki tanggal kalender akademik `attendanceDate`.
  * Status sesi: `OPEN` (sesi dibuka, guru sedang mencatat) dan `CLOSED` (selesai, dikunci permanen).
  * Constraint: `@@unique([teacherAssignmentId, attendanceDate])` memastikan 1 penugasan guru hanya memiliki 1 sesi per hari.
* **AttendanceRecord & Dual-Pointer Integrity:**
  * Setiap rekaman kehadiran menyimpan `studentId` DAN `enrollmentId`.
  * Status kehadiran baku: `PRESENT` (HADIR), `EXCUSED` (IZIN), `SICK` (SAKIT), `ABSENT` (ALPA).
  * Keberadaan `enrollmentId` memastikan bahwa histori absensi masa lalu tetap mengikat pada tahun ajaran dan rombel yang tepat, walaupun siswa nantinya naik kelas atau mutasi rombel.
* **Immutability of Closed Sessions:**
  * Sesi dengan status `CLOSED` bersifat kekal (immutable). Modifikasi atau penambahan catatan kehadiran baru ditolak secara permanen.
  * Sesi hanya dapat ditutup jika seluruh siswa eligible dalam rombel telah memiliki catatan kehadiran lengkap.
* **Teacher Scope Enforcement:**
  * Guru hanya diizinkan melihat, membuka, mengisi, dan menutup sesi untuk `TeacherAssignment` miliknya sendiri (`teacherId == session.userId`).
  * Admin / Kepala Sekolah dengan izin `academic:manage` atau `attendance:manage` dapat mengakses seluruh sesi dalam tenant.

