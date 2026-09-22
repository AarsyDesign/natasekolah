# MASTER PRODUCT REQUIREMENT DOCUMENT (PRD) v5.0

# NATASEKOLAH

## Unified Education Management Platform

### Sistem Manajemen Terpadu Sekolah, Pesantren, Rumah Tahfidz & PKBM

**Tagline:**

> **Menata Pendidikan, Merapikan Masa Depan.**

**Sub-tagline:**

> Tinggalkan Cara Manual, Saatnya Lembaga Anda Tertata Rapi.

---

# 1. PRODUCT VISION

## 1.1 Visi

NataSekolah adalah platform SaaS multi-tenant yang menjadi **pusat data dan operasional lembaga pendidikan** Indonesia.

NataSekolah dirancang untuk sekolah formal, pesantren, pesantren terpadu, rumah tahfidz, PKBM, dan lembaga pendidikan sejenis yang saat ini masih bergantung pada:

* Excel yang tersebar
* dokumen kertas
* WhatsApp manual
* pencatatan pembayaran terpisah
* data siswa yang tidak memiliki histori
* administrasi guru yang berulang
* pembuatan raport dan dokumen secara manual

NataSekolah tidak sekadar menggantikan buku dan Excel.

Tujuan utamanya adalah menciptakan:

> **Single Source of Truth untuk seluruh data dan aktivitas lembaga pendidikan.**

---

# 2. PRODUCT PRINCIPLES

NataSekolah dibangun berdasarkan prinsip berikut.

## 2.1 One Student, One Identity

Satu siswa/santri hanya memiliki satu identitas utama.

Data tersebut dapat digunakan oleh:

* sekolah formal
* pesantren
* tahfidz
* asrama
* keuangan
* wali murid

Tidak boleh ada duplikasi identitas hanya karena domainnya berbeda.

---

## 2.2 Historical Data Is Sacred

Data historis tidak boleh berubah secara tidak sengaja.

Contoh:

Ahmad:

```text
2025/2026 → Kelas 7A
2026/2027 → Kelas 8A
2027/2028 → Kelas 9A
```

Data kelas lama tetap tersimpan.

Raport lama tetap merepresentasikan kondisi pada saat diterbitkan.

---

## 2.3 Tenant Isolation by Design

Setiap lembaga memiliki lingkungan data yang terisolasi.

`institution_id` bukan sekadar field database, melainkan bagian dari security boundary sistem.

Tidak boleh ada operasi client yang dapat menentukan tenant secara bebas.

Tenant context harus berasal dari authenticated session.

---

## 2.4 Mobile First

Aktivitas lapangan harus dirancang untuk HP murah dan koneksi yang tidak selalu stabil.

Target utama:

> Presensi harian dapat diselesaikan dalam <60 detik.

---

## 2.5 WhatsApp First for Parents

Wali murid tidak diwajibkan menginstal aplikasi native.

Notifikasi utama:

* presensi
* pembayaran
* jatuh tempo
* setoran tahfidz
* informasi penting

disampaikan melalui WhatsApp.

Portal PWA digunakan sebagai lapisan kedua.

---

## 2.6 Automation Before Intelligence

Sistem harus terlebih dahulu membangun:

1. data yang benar
2. workflow yang benar
3. histori yang benar
4. otomatisasi yang benar

Barulah AI ditambahkan sebagai lapisan bantuan.

AI tidak pernah menjadi source of truth.

---

# 3. PRODUCT POSITIONING

Secara teknis NataSekolah bersifat universal.

Secara go-to-market, fokus awal diarahkan kepada:

> **Pesantren terpadu yang memiliki sekolah formal + pesantren + asrama/tahfidz.**

Alasannya karena tipe lembaga ini memiliki kompleksitas yang paling sesuai dengan keunggulan arsitektur Unified Core.

Satu peserta didik dapat memiliki:

```text
                         STUDENT
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       SEKOLAH            PONDOK           TAHFIDZ
          │                 │                 │
        Nilai             Asrama           Setoran
        Raport            Shalat           Mutaba'ah
        Presensi          Tasrih            Halaqah
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                         KEUANGAN
                            │
                         Syahriah
                         Pembayaran
```

---

# 4. PRODUCT ARCHITECTURE

## 4.1 Unified Core + Domain Plugins

NataSekolah menggunakan pendekatan:

> **Unified Core + Toggleable Domain Plugins**

### Unified Core

Selalu tersedia:

```text
Multi-Tenancy
Authentication
Authorization
Institution
User & Staff
Student
Guardian
Academic Year
Enrollment
Classroom
Attendance Core
Finance Core
Notification Engine
Document Engine
File Storage
Audit Log
Settings
```

### Domain Plugins

Dapat diaktifkan atau dinonaktifkan:

```text
FORMAL_ACADEMIC
PESANTREN_LIVING
TAHFIDZ
PKBM
```

Plugin bukan sekadar menu.

Plugin memiliki:

```text
Manifest
Routes
Permissions
Navigation
Business Rules
Dashboard Widgets
Domain Services
```

---

# 5. INSTITUTION PRESET

Saat lembaga dibuat, sistem meminta preset.

Contoh:

```text
SEKOLAH
PESANTREN
PESANTREN_TERPADU
RUMAH_TAHFIDZ
PKBM
```

Preset menentukan plugin awal.

Contoh:

### Sekolah Formal

```text
CORE
+
FORMAL_ACADEMIC
```

### Rumah Tahfidz

```text
CORE
+
TAHFIDZ
```

### Pesantren Terpadu

```text
CORE
+
FORMAL_ACADEMIC
+
PESANTREN_LIVING
+
TAHFIDZ
```

Plugin dapat disesuaikan kembali oleh administrator lembaga.

---

# 6. DYNAMIC TERMINOLOGY

UI menggunakan dictionary berdasarkan institution profile.

| Entity     | Sekolah    | Pesantren      | Tahfidz         | PKBM          |
| ---------- | ---------- | -------------- | --------------- | ------------- |
| Student    | Siswa      | Santri         | Santri/Murid    | Warga Belajar |
| Teacher    | Guru       | Ustadz/Musyrif | Ustadz/Pengampu | Tutor         |
| Classroom  | Kelas      | Kelas/Kamar    | Halaqah         | Kelompok      |
| Fee        | SPP        | Syahriah       | Iuran/Infaq     | Biaya Paket   |
| Supervisor | Wali Kelas | Musyrif        | Musyrif Halaqah | Pamong        |
| Grade      | Jenjang    | Marhalah       | Tingkat         | Program       |

Terminologi hanya memengaruhi presentation layer.

Entity database tetap konsisten.

---

# 7. SYSTEM ARCHITECTURE

## 7.1 Architectural Style

NataSekolah menggunakan:

> **Modular Monolith**

pada tahap awal.

Tidak menggunakan microservices sebagai fondasi pertama.

Alasannya:

* deployment lebih sederhana
* transaction lebih mudah
* debugging lebih mudah
* biaya rendah
* cocok untuk tahap validasi produk
* domain tetap dapat dipisahkan secara modular

Microservices hanya dipertimbangkan ketika terdapat bottleneck nyata.

---

# 8. APPLICATION LAYERS

```text
┌──────────────────────────────────────────┐
│                UI / PWA                  │
├──────────────────────────────────────────┤
│            Application Layer             │
├──────────────────────────────────────────┤
│              Domain Layer                │
├──────────────────────────────────────────┤
│          Infrastructure Layer            │
├──────────────────────────────────────────┤
│ PostgreSQL │ R2 │ WhatsApp │ PDF │ Jobs │
└──────────────────────────────────────────┘
```

## 8.1 UI Layer

Next.js App Router.

## 8.2 Application Layer

Mengatur:

* use case
* validation
* authorization
* transaction orchestration

## 8.3 Domain Layer

Mengandung business rules.

Contoh:

```text
calculateOutstanding()
promoteEnrollment()
recordAttendance()
applyDiscount()
publishReportCard()
```

## 8.4 Infrastructure Layer

Mengatur:

* Prisma
* PostgreSQL
* Cloudflare R2
* WhatsApp provider
* PDF engine
* background jobs

---

# 9. MULTI-TENANCY

Setiap request melewati:

```text
Request
 ↓
Authentication
 ↓
Tenant Context
 ↓
Authorization
 ↓
Domain Service
 ↓
Database
```

Client tidak dipercaya untuk menentukan tenant.

Contoh yang tidak diperbolehkan:

```json
{
  "institutionId": "another-school"
}
```

sebagai sumber otorisasi.

Semua query harus mematuhi tenant context.

---

# 10. AUTHORIZATION MODEL

RBAC menggunakan:

```text
User
 ↓
Role
 ↓
Permission
 ↓
Scope
```

## Role contoh

```text
SUPER_ADMIN
INSTITUTION_ADMIN
HEADMASTER
TEACHER
SUPERVISOR
TREASURER
STAFF
PARENT
```

## Permission contoh

```text
student.read
student.create
student.update

attendance.read
attendance.write

payment.read
payment.write

grade.read
grade.write

report.publish
```

## Scope

Permission dapat dibatasi pada:

```text
Institution
Classroom
Subject
Student
```

Contoh:

Guru dapat:

```text
grade.write
```

tetapi hanya untuk:

```text
Subject = Mathematics
Classroom = 7A
```

---

# 11. MASTER DATA ENGINE

## 11.1 Institution

```text
Institution
├── id
├── name
├── type
├── logo
├── address
├── contact
├── enabled_plugins
├── subscription_status
└── settings
```

---

# 12. STUDENT MASTER DATA

Data utama siswa:

### Identity

```text
NISN
NIS/NIPD
NIK
No KK
Nama
Jenis Kelamin
Tempat Lahir
Tanggal Lahir
Agama
```

### Address

```text
Alamat
RT/RW
Desa/Kelurahan
Kecamatan
Kabupaten/Kota
Kode Pos
```

### Guardian

```text
Ayah
Ibu
Wali
Nomor WhatsApp
Email
Pekerjaan
Penghasilan
```

### School / Institution

```text
Entry Year
Status
Scholarship
```

### Physical

```text
Height
Weight
```

---

# 13. STUDENT ENROLLMENT ENGINE

`Student` tidak menyimpan posisi kelas sebagai histori permanen.

Gunakan:

```text
Student
   ↓
Enrollment
   ↓
AcademicYear
   ↓
Classroom
```

Contoh:

```text
Enrollment #1
2025/2026
7A

Enrollment #2
2026/2027
8A

Enrollment #3
2027/2028
9A
```

Enrollment menjadi fondasi:

* kenaikan kelas
* histori
* raport
* presensi
* statistik
* alumni
* mutasi

---

# 14. ACADEMIC PERIOD

Academic Year menjadi entity inti.

```text
AcademicYear
├── 2025/2026
├── 2026/2027
└── 2027/2028
```

Di dalamnya:

```text
Semester
Term
Period
```

Domain akademik harus selalu mengetahui periode.

---

# 15. BULK PROMOTION

Kenaikan kelas dilakukan melalui workflow.

```text
Review
 ↓
Preview
 ↓
Validate
 ↓
Promote
 ↓
Audit
```

Contoh:

```text
7A → 8A
7B → 8B
8A → 9A
9A → ALUMNI
```

Tidak menghapus histori enrollment lama.

---

# 16. EXCEL IMPORT ENGINE

Import harus berbentuk pipeline:

```text
Upload
 ↓
Parse
 ↓
Sanitize
 ↓
Validate
 ↓
Preview
 ↓
User Confirmation
 ↓
Commit
 ↓
Import Report
```

## Sanitizer

Normalisasi:

```text
08123456789
+628123456789
628123456789
```

menjadi format internal yang konsisten.

Tanggal:

```text
DD/MM/YYYY
YYYY-MM-DD
text month
```

harus dinormalisasi.

Import tidak boleh langsung memasukkan data mentah ke database.

---

# 17. DATA VALIDATION

Validasi dibagi:

### Syntax Validation

Apakah format benar?

### Business Validation

Apakah data masuk akal?

### Referential Validation

Apakah classroom / teacher / subject tersedia?

### Duplicate Validation

Apakah siswa mungkin sudah ada?

Sistem harus menampilkan hasil:

```text
Valid: 237
Warning: 8
Error: 5
Duplicate: 3
```

---

# 18. ATTENDANCE ENGINE

Default:

```text
HADIR
```

Guru hanya mengubah:

```text
Sakit
Izin
Alpa
```

Target operasi:

> <60 detik.

---

# 19. OFFLINE ATTENDANCE

Gunakan:

```text
PWA
 ↓
IndexedDB
 ↓
Offline Queue
 ↓
Sync Engine
 ↓
Server
```

Bukan LocalStorage sebagai storage utama.

Setiap operasi memiliki idempotency key.

Constraint:

```text
student
+
attendance_session
+
date
```

harus unik sesuai model sesi.

---

# 20. ATTENDANCE SESSION

Attendance tidak hanya berarti hadir sekolah.

Jenis:

```text
SCHOOL
PRAYER
ASRAMA
HALAQAH
EVENT
```

Setiap session memiliki context.

Contoh:

```text
Prayer
Fajr
2026-09-19
```

---

# 21. FINANCE ENGINE

Keuangan dipisahkan menjadi tiga lapisan:

```text
FeeCategory
   ↓
StudentCharge
   ↓
PaymentTransaction
```

## FeeCategory

Contoh:

```text
SPP
SYAHRIAH
UANG MAKAN
INFAQ
UJIAN
ASRAMA
```

## StudentCharge

Tagihan aktual per siswa.

```text
Student
Month
Year
Nominal
Discount
Status
```

## PaymentTransaction

Pembayaran aktual.

```text
Charge
Amount
Method
Receipt Number
Paid At
Receiver
```

---

# 22. PAYMENT STATE

Status:

```text
UNPAID
PARTIAL
PAID
OVERPAID
VOID
```

Contoh:

```text
Tagihan     500.000
Bayar       200.000
Sisa        300.000
```

Kemudian:

```text
Bayar       300.000
Sisa        0
Status      PAID
```

---

# 23. FINANCE AUDIT

Transaksi keuangan tidak boleh dihapus secara hard delete.

Gunakan:

```text
VOID
REVERSAL
ADJUSTMENT
```

dengan audit trail.

---

# 24. CASHBOOK

Buku kas mencatat:

```text
Kas Masuk
Kas Keluar
Saldo
```

Kategori dapat berupa:

```text
SPP
Syahriah
Donasi
Infaq
Operasional
Belanja
Gaji
```

Rekening dan kas dapat dikembangkan menjadi modul terpisah pada fase lanjutan.

---

# 25. RECEIPT ENGINE

Kwitansi dapat:

```text
Generate
Print
PDF
WhatsApp
Archive
```

Kwitansi memiliki nomor unik.

---

# 26. NOTIFICATION ENGINE

Notification tidak boleh terikat langsung pada transaksi bisnis.

Arsitektur:

```text
Business Event
 ↓
Notification Event
 ↓
Outbox
 ↓
Worker
 ↓
Provider
 ↓
Delivery Status
```

Contoh:

```text
PaymentCompleted
   ↓
GenerateReceipt
   ↓
QueueWhatsApp
   ↓
Send
```

Apabila WhatsApp gagal:

> transaksi pembayaran tetap sukses.

---

# 27. WHATSAPP PROVIDER ABSTRACTION

Provider harus diabstraksikan.

```text
WhatsAppProvider
├── DeepLink
├── Fonnte
├── WAHA
└── Future Provider
```

Template disimpan di sistem.

Contoh:

```text
PAYMENT_RECEIPT
ATTENDANCE_ALERT
DUE_DATE_REMINDER
TAHFIDZ_PROGRESS
```

---

# 28. FORMAL ACADEMIC PLUGIN

Plugin formal mencakup:

```text
Teacher Assignment
Subject
Assessment
Grade
Exam
Question Bank
Report Card
```

---

# 29. ASSESSMENT ENGINE

Nilai tidak langsung ditulis ke raport.

Struktur:

```text
Assessment
 ↓
Grade Item
 ↓
Grade
 ↓
Report Card
```

Mendukung:

```text
Tugas
UH
UTS
UAS
Project
Praktik
```

Komposisi nilai dapat dikonfigurasi.

---

# 30. QUESTION BANK

Tiga scope:

```text
DEVELOPER_CENTRAL
PRIVATE_INSTITUTION
COMMUNITY
```

Private school pool harus terisolasi dari tenant lain.

Community pool harus memiliki moderation workflow.

---

# 31. EXAM PAPER ENGINE

Sistem dapat menghasilkan:

```text
Soal Siswa
Kunci Jawaban
```

Dengan:

* kop
* identitas ujian
* ruang nama
* nomor peserta
* layout
* footer
* halaman
* QR verifikasi

Format output:

```text
PDF
DOCX
```

Layout 2 kolom bersifat configurable.

Jangan menggunakan klaim penghematan kertas tertentu sebagai janji produk tanpa hasil pengujian nyata.

---

# 32. AI QUESTION GENERATOR

AI adalah optional assistance layer.

Contoh workflow:

```text
Guru memasukkan:
Mapel
Kelas
Topik
Jumlah soal
Tipe soal
Tingkat kesulitan
        ↓
AI
        ↓
Draft Questions
        ↓
Teacher Review
        ↓
Save
```

AI tidak boleh langsung mempublikasikan soal tanpa review.

---

# 33. FAIR USE

Kuota AI diterapkan per account guru.

Contoh:

```text
30 generate / day
15 second cooldown
```

Konfigurasi harus dapat diubah oleh platform administrator.

Batasan tidak diterapkan sebagai pooled quota seluruh sekolah agar pengguna dalam satu lembaga tidak saling menghabiskan kuota.

---

# 34. REPORT CARD ENGINE

Raport adalah output dari academic data.

Pipeline:

```text
Assessment
 ↓
Calculate
 ↓
Generate
 ↓
Preview
 ↓
Publish
 ↓
Snapshot
 ↓
PDF
```

---

# 35. REPORT CARD SNAPSHOT

Raport yang telah diterbitkan menjadi snapshot.

Artinya:

> perubahan data akademik setelah penerbitan tidak otomatis mengubah raport historis.

Jika revisi diperlukan:

```text
Revision
 ↓
Audit
 ↓
Regenerate
 ↓
New Version
```

---

# 36. REPORT TEMPLATES

Template awal:

### Formal

```text
Kurikulum formal
```

### Diniyah

```text
Kitab
Nahwu
Shorof
Hadits
Bahasa Arab
```

### Tahfidz

```text
Juz
Surat
Ayat
Tajwid
Makharij
Kelancaran
```

Template harus configurable.

---

# 37. PESANTREN LIVING PLUGIN

Mencakup:

```text
Asrama
Musyrif
Shalat
Tasrih
Diniyah
```

---

# 38. TAHFIDZ PLUGIN

Entitas utama:

```text
Halaqah
TahfidzSession
MemorizationRecord
Surah
Ayah
Assessment
```

Contoh:

```text
Tanggal
Santri
Surat
Ayat
Setoran
Murajaah
Tajwid
Kelancaran
Catatan
```

---

# 39. ASRAMA ENGINE

Mendukung:

```text
Dormitory
Room
Bed
Supervisor
Check-in
Check-out
Residence Status
```

---

# 40. TASRIH / PERMIT ENGINE

Status:

```text
REQUESTED
APPROVED
REJECTED
OUT
RETURNED
OVERDUE
```

Setiap izin memiliki:

```text
Student
Purpose
Destination
Start
Expected Return
Actual Return
Approver
```

---

# 41. PARENT EXPERIENCE

Wali murid menggunakan:

```text
WhatsApp
+
PWA
```

Portal menampilkan:

```text
Profil Anak
Presensi
Keuangan
Raport
Tahfidz
Tasrih
Dokumen
Notifikasi
```

Portal membaca data dari domain internal.

Tidak membuat database siswa kedua.

---

# 42. DASHBOARD DESIGN

Dashboard bukan sekadar kumpulan statistik.

Dashboard harus fokus pada:

> **Apa yang harus dilakukan hari ini?**

### Institution Admin

```text
PRESENSI
KEUANGAN
ACADEMIC
PENGADAAN
NOTIFIKASI
TASK
```

### Teacher

```text
Jadwal Hari Ini
Kelas Hari Ini
Presensi
Input Nilai
Tugas
```

### Treasurer

```text
Pemasukan
Tagihan
Tunggakan
Pembayaran
Kas
```

### Musyrif

```text
Asrama
Shalat
Izin
Halaqah
```

---

# 43. SUPER ADMIN PLATFORM

Developer dashboard memiliki:

```text
Institutions
Subscriptions
MRR
Active Students
Storage
Notifications
Errors
Usage
Support
```

---

# 44. IMPERSONATION

Support impersonation harus memiliki:

```text
Actor
Target Institution
Target User
Timestamp
Reason
Session
Audit
```

UI wajib menampilkan:

> SUPPORT MODE — Anda sedang mengakses akun lembaga ini.

---

# 45. AUDIT LOG

Audit log mencatat operasi sensitif.

Contoh:

```text
CREATE
UPDATE
DELETE_REQUEST
VOID
PUBLISH
REVISE
LOGIN
IMPERSONATE
EXPORT
```

Data:

```text
actor
tenant
entity
entity_id
action
timestamp
metadata
```

---

# 46. FILE STORAGE

Cloudflare R2 digunakan untuk:

```text
Logo
Dokumen
Raport PDF
Exam Paper
Attachment
Import Files
Export Files
```

Object path harus tenant-aware.

Contoh:

```text
institution/{institutionId}/students/...
institution/{institutionId}/reports/...
institution/{institutionId}/documents/...
```

---

# 47. SECURITY

Minimum:

```text
Password hashing
Session security
CSRF protection
Rate limiting
Input validation
Authorization checks
Tenant isolation
Audit logging
Secure file access
Signed URLs
Encryption at rest
Encryption in transit
```

Data pribadi harus diperlakukan sebagai data sensitif dan sistem harus dirancang sesuai kewajiban hukum yang berlaku.

NataSekolah tidak boleh mengklaim kepatuhan hukum penuh hanya berdasarkan arsitektur teknis.

---

# 48. DATABASE PRINCIPLES

Database menggunakan PostgreSQL + Prisma.

Prinsip:

```text
Strong relational constraints
Foreign keys
Unique constraints
Indexes
Transactions
Soft-delete where required
Audit trail
Tenant-aware queries
```

---

# 49. CORE ENTITY BLUEPRINT

```text
Institution
User
Role
Permission

Student
Guardian
Staff

AcademicYear
Semester
Classroom
Enrollment
Subject
TeacherAssignment

AttendanceSession
Attendance

FeeCategory
StudentCharge
PaymentTransaction
CashbookEntry
Receipt

Assessment
Grade
QuestionBank
ExamPaper

ReportCard
ReportCardSnapshot

NotificationEvent
NotificationDelivery

AuditLog

Plugin
InstitutionPlugin
```

---

# 50. ENTITY RELATIONSHIP CONCEPT

```text
Institution
 ├── Users
 ├── Students
 │     └── Enrollment
 │           └── Classroom
 ├── Staff
 │     └── TeacherAssignment
 │           ├── Subject
 │           └── Classroom
 ├── Attendance
 ├── Finance
 ├── Academic
 ├── Plugins
 ├── Notifications
 └── Audit Logs
```

---

# 51. TECH STACK

## Application

```text
Next.js
React
TypeScript
App Router
Server Actions / Route Handlers
```

## UI

```text
Tailwind CSS
Shadcn UI
Lucide
```

## Database

```text
PostgreSQL
Prisma
```

## Storage

```text
Cloudflare R2
```

## Document

```text
PDF engine
DOCX generation
```

## Notification

```text
WhatsApp Provider
Webhooks
Background Jobs
```

## AI

```text
LLM Provider abstraction
```

AI provider tidak boleh hard-coded agar dapat diganti.

---

# 52. OBSERVABILITY

Platform memonitor:

```text
Error rate
Request latency
Database health
Queue health
WhatsApp delivery
Storage usage
Import failures
PDF failures
```

Observability bukan sekadar dashboard developer.

Alert harus dapat menunjukkan masalah yang harus ditindaklanjuti.

---

# 53. PRODUCT ROADMAP

## PHASE 0 — FOUNDATION

Tujuan:

> membangun fondasi yang aman dan tidak perlu dibongkar kembali.

### Scope

```text
Multi-Tenant
Authentication
Session
RBAC
Permission
Institution
Academic Year
Plugin Registry
Settings
Audit Log
File Storage
Error Handling
Observability
```

### Definition of Done

Satu institution dapat:

```text
dibuat
↓
admin dibuat
↓
login
↓
plugin dikonfigurasi
↓
tenant isolation teruji
```

---

# 54. PHASE 1 — MASTER DATA ENGINE

### Scope

```text
Student
Guardian
Staff
Classroom
Subject
Enrollment
Teacher Assignment
Academic Year
Excel Import
Sanitizer
Bulk Operations
```

### Output

> Lembaga dapat memindahkan data manual mereka ke NataSekolah.

---

# 55. PHASE 2 — DAILY OPERATIONS

### Scope

```text
Attendance
Offline Sync
Fee Category
Student Charge
Payment
Partial Payment
Receipt
Cashbook
Dashboard
```

### Output

> NataSekolah mulai dipakai setiap hari.

---

# 56. PHASE 3 — COMMUNICATION ENGINE

### Scope

```text
Notification Event
Outbox
WhatsApp
Templates
Retry
Delivery Status
Deep Link
Parent PWA
```

### Output

> aktivitas internal menghasilkan komunikasi otomatis kepada wali.

---

# 57. PHASE 4 — FORMAL ACADEMIC

### Scope

```text
Assessment
Grade
Teacher Assignment
Question Bank
Exam
Document Engine
Report Card
Snapshot
```

---

# 58. PHASE 5 — PESANTREN LIVING

### Scope

```text
Diniyah
Tahfidz
Halaqah
Shalat
Asrama
Tasrih
Musyrif
```

---

# 59. PHASE 6 — PARENT EXPERIENCE

### Scope

```text
PWA
Dashboard Wali
Presensi
Keuangan
Raport
Tahfidz
Tasrih
Documents
Notifications
```

---

# 60. PHASE 7 — AI & AUTOMATION

### Scope

```text
AI Question Generator
AI Description Assistant
AI Administrative Assistant
Data Cleaning Assistant
Automated Summaries
```

AI selalu berada di atas domain engine yang sudah stabil.

---

# 61. FEATURES DELIBERATELY DEFERRED

Fitur berikut tidak menjadi prioritas awal:

```text
Advanced Analytics
Predictive Analytics
Community Marketplace
Complex AI Assistant
Large-scale Recommendation Engine
Microservices
Native Mobile Apps
```

Fitur hanya dinaikkan prioritas ketika terdapat kebutuhan nyata dari penggunaan produk.

---

# 62. MVP DEFINITION

MVP NataSekolah bukan:

> “sebanyak mungkin halaman selesai.”

MVP adalah:

```text
Institution
+
User
+
Student
+
Enrollment
+
Classroom
+
Academic Year
+
Attendance
+
Finance
+
Payment
+
Receipt
+
Basic WhatsApp
+
Dashboard
```

Dengan tiga workflow utama:

### Workflow 1

```text
Import siswa
↓
Buat kelas
↓
Enrollment
```

### Workflow 2

```text
Guru
↓
Presensi
↓
Save
↓
Sync
```

### Workflow 3

```text
Admin
↓
Tagihan
↓
Pembayaran
↓
Kwitansi
↓
WhatsApp
```

Jika tiga workflow ini stabil, Nata sudah memiliki produk yang dapat digunakan.

---

# 63. NON-FUNCTIONAL REQUIREMENTS

## Performance

Target:

```text
Fast initial load
Low JavaScript footprint where possible
Mobile responsive
Optimistic interaction
```

## Reliability

Workflow kritis harus transaction-safe.

## Security

Tidak boleh ada cross-tenant access.

## Auditability

Transaksi penting harus dapat dilacak.

## Recoverability

Backup dan restore harus diuji, bukan hanya dikonfigurasi.

---

# 64. TESTING STRATEGY

Setiap feature harus melewati:

```text
Unit Test
Integration Test
Authorization Test
Tenant Isolation Test
Database Constraint Test
UI Test
```

Workflow kritis tambahan:

```text
Concurrency Test
Idempotency Test
Rollback Test
Offline Sync Test
Import Test
```

---

# 65. RED-ZONE TESTS

Lima kelompok kesalahan dianggap kritis.

## Tenant Leakage

```text
School A
≠
School B
```

## Financial Corruption

Saldo, pembayaran, dan tagihan harus konsisten.

## Duplicate Attendance

Satu sesi tidak boleh memiliki duplikasi record yang tidak valid.

## Historical Corruption

Perubahan enrollment saat ini tidak boleh mengubah histori masa lalu.

## Offline Duplication

Retry sync tidak boleh membuat transaksi ganda.

---

# 66. PRODUCT METRICS

NataSekolah tidak hanya mengukur:

```text
jumlah user
```

tetapi:

### Activation

Apakah lembaga berhasil:

```text
import siswa
+
buat kelas
+
melakukan presensi pertama
```

### Daily Usage

```text
Attendance sessions / institution
Payment transactions / institution
Active teachers
```

### Retention

```text
Institutions retained
Monthly active institutions
```

### Communication

```text
Messages sent
Delivery rate
Failure rate
```

### Financial

```text
MRR
ARPU
Active students
Churn
```

---

# 67. BUSINESS MODEL

Harga dasar:

> **Rp1.000 / siswa / bulan**

Namun pricing engine harus dibuat configurable.

Jangan hard-code harga dalam business logic.

Contoh:

```text
Plan
PricingRule
BillingCycle
Subscription
```

---

# 68. IMPORTANT BUSINESS ASSUMPTION

Target:

```text
60 institutions
×
250 students
=
15.000 students
```

Pada harga Rp1.000:

```text
MRR = Rp15.000.000
```

Namun klaim gross margin tertentu tidak boleh dianggap sebagai fakta sebelum seluruh biaya nyata terukur.

Perlu dihitung:

```text
Database
Storage
Bandwidth
WhatsApp
PDF
Email
AI
Monitoring
Backup
Support
Payment Gateway
Domain
Infrastructure
```

---

# 69. PRODUCT NORTH STAR

North Star Metric:

> **Jumlah siswa aktif yang datanya benar-benar dikelola melalui workflow NataSekolah setiap bulan.**

Alasannya:

Nata menghasilkan nilai ketika data siswa bukan hanya disimpan, tetapi digunakan untuk:

```text
Presensi
Keuangan
Akademik
Tahfidz
Komunikasi
```

---

# 70. UX PRINCIPLE

Setiap halaman harus menjawab:

### Siapa pengguna?

```text
Admin
Guru
Kasir
Musyrif
Wali
Developer
```

### Apa tugasnya?

### Seberapa sering dilakukan?

### Apakah bisa selesai melalui HP?

### Apa kesalahan yang mungkin terjadi?

---

# 71. UI PRIORITY

Prioritas tindakan:

```text
Primary Action
Secondary Action
Advanced Action
```

Contoh presensi:

```text
[ SIMPAN PRESENSI ]
```

harus lebih dominan daripada:

```text
Export
Print
Settings
```

---

# 72. PRODUCT RULE

Jangan membangun UI sebelum business rule jelas.

Urutan:

```text
Domain Rule
↓
Data Model
↓
Use Case
↓
Authorization
↓
Validation
↓
UI
```

Bukan:

```text
UI
↓
Database
↓
Tambal Logic
```

---

# 73. DEVELOPMENT RULE

Setiap fase harus memiliki:

```text
Schema
Domain Logic
Server Logic
UI
Tests
Migration
Documentation
```

Fase tidak dianggap selesai hanya karena UI dapat diklik.

---

# 74. DEFINITION OF DONE

Sebuah feature dianggap selesai jika:

```text
✓ UI
✓ Validation
✓ Authorization
✓ Tenant Isolation
✓ Database Constraint
✓ Error Handling
✓ Loading State
✓ Empty State
✓ Mobile UX
✓ Audit
✓ Tests
✓ Documentation
```

Untuk feature kritis:

```text
✓ Concurrency
✓ Idempotency
✓ Rollback
✓ Import/Export
✓ Recovery
```

---

# 75. DEVELOPMENT ORDER

Urutan pembangunan resmi:

```text
                    NATASEKOLAH

                        PHASE 0
                FOUNDATION / SECURITY
                         │
                         ▼
                        PHASE 1
                  MASTER DATA ENGINE
                         │
                         ▼
                        PHASE 2
                  DAILY OPERATIONS
                         │
                         ▼
                        PHASE 3
                COMMUNICATION ENGINE
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
          PHASE 4                 PHASE 5
     FORMAL ACADEMIC         PESANTREN LIVING
             │                       │
             └───────────┬───────────┘
                         ▼
                        PHASE 6
                  PARENT EXPERIENCE
                         │
                         ▼
                        PHASE 7
                   AI & AUTOMATION
```

---

# 76. FINAL PRODUCT FORM

Pada kondisi matang, NataSekolah menjadi:

```text
                         NATASEKOLAH
                              │
                    SINGLE SOURCE OF TRUTH
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
       DATA                OPERATIONS             DOMAIN
        │                     │                     │
   Student               Attendance             Academic
   Guardian              Finance                Pesantren
   Teacher               Communication          Tahfidz
   Enrollment             Documents              Asrama
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                         AUTOMATION
                              │
                       WhatsApp / Jobs
                              │
                              ▼
                             AI
```

---

# 77. STRATEGIC CONCLUSION

NataSekolah **bukan aplikasi raport**.

Bukan pula:

* aplikasi absensi
* aplikasi SPP
* aplikasi tahfidz
* aplikasi bank soal
* aplikasi WhatsApp

Semua itu adalah modul.

Produk utamanya adalah:

> **Platform yang menata seluruh data dan aktivitas lembaga pendidikan ke dalam satu sistem yang konsisten, memiliki histori, aman antar-tenant, dapat digunakan di lapangan, dan dapat mengotomatisasi pekerjaan administratif.**

Keunggulan strategis NataSekolah berada pada:

```text
ONE STUDENT
      ↓
ONE IDENTITY
      ↓
ONE HISTORY
      ↓
MULTIPLE DOMAINS
      ↓
ONE INSTITUTION
      ↓
ONE PLATFORM
```

Itulah fondasi yang memungkinkan NataSekolah berkembang dari produk sederhana menjadi platform pendidikan terpadu.

---

# 78. NEXT DEVELOPMENT GATE

Sebelum coding feature pertama pada Phase 0, artefak teknis yang harus diturunkan dari PRD ini adalah:

```text
01. Architecture Decision Record
02. Domain Model
03. Prisma Schema Blueprint
04. Permission Matrix
05. Multi-Tenant Security Model
06. Plugin Manifest Contract
07. Academic Period Model
08. Enrollment Model
09. Audit Model
10. Notification / Outbox Model
11. Phase 0 Task Breakdown
12. Testing Strategy
```

**Tidak boleh melompat ke pembuatan seluruh UI sebelum 01–08 memiliki bentuk yang cukup jelas.**

---

# STATUS DOKUMEN

**Product:** NataSekolah
**Document:** Master Product Requirement Document
**Version:** 5.0
**Architecture:** Unified Core + Toggleable Domain Plugins
**Architecture Style:** Modular Monolith
**Database:** PostgreSQL + Prisma
**Frontend:** Next.js + React + TypeScript
**Primary UX:** Mobile First + WhatsApp First
**Product Strategy:** Unified Education Management Platform
**Initial Focus:** Pesantren Terpadu + Sekolah Formal
**Development Priority:** Foundation → Master Data → Operations → Communication → Domains → Parent → AI
