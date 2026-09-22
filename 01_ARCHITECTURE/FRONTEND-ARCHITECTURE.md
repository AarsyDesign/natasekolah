# Frontend Architecture Blueprint — NataSekolah

Status: DESIGN / PRE-INTEGRATION
Baseline: `staging`
Implementation branch: `feature/finance-core`

## 1. Frontend Contract

Frontend menggunakan **Next.js App Router + React**.

Frontend adalah presentation/application boundary.

Frontend:
- menampilkan state
- menerima input
- memanggil Server Actions
- mengelola loading/error/empty states
- tidak menjadi sumber authorization
- tidak menentukan tenant

Server tetap menjadi source of truth.

## 2. Route Philosophy

Route mengikuti domain, bukan tabel database.

Contoh:

```
/students
/students/[id]

/academic-years
/classrooms

/subjects
/teachers
/teacher-assignments

/attendance
/attendance/history

/finance
```

Domain navigation dapat berkembang berdasarkan plugin yang aktif.

## 3. Page Responsibilities

### List Page
Menangani:
- filter
- search
- pagination
- loading
- empty state
- error state
- primary action

### Detail Page
Menangani:
- identity/context
- historical information
- domain actions
- related records

### Workflow Page
Untuk operasi cepat seperti attendance:
- minimal navigation
- large touch targets
- fast feedback
- optimistic interaction hanya jika aman terhadap rollback
- server remains authoritative

## 4. Component Layers

```
src/components/
├── ui/
├── forms/
├── feedback/
├── navigation/
├── tables/
└── domain/
```

Catatan:
folder belum perlu dibuat semuanya sekarang.

Komponen domain tidak boleh mengakses Prisma.

## 5. Data Flow

Pola standar:

```
React UI
  ↓
Server Action
  ↓
getAuthenticatedTenantContext()
  ↓
Zod / Domain Validation
  ↓
Domain Service
  ↓
Prisma
```

UI hanya mengetahui contract response.

## 6. State Model

Setiap mutation minimal memiliki:

```
IDLE
→ PENDING
→ SUCCESS
or
→ ERROR
```

Untuk operasi yang dapat diulang:
- gunakan idempotency key bila domain membutuhkan
- jangan membuat key baru untuk retry request yang sama

Contoh Finance Payment:
- satu logical submit = satu idempotency key
- key diganti setelah transaksi benar-benar sukses

## 7. Form Rules

Semua form:
- client feedback untuk usability
- server validation untuk authority
- server authorization untuk security

Client validation tidak menggantikan Zod/service validation.

Security fields seperti:
- `institutionId`
- `userId`
- `guardianId`
- `roles`
- `permissions`
- `isSuperAdmin`

tidak boleh menjadi editable business fields.

## 8. Tenant-Aware UX

UI tidak perlu meminta user memilih institution.

Institution sudah ditentukan oleh authenticated session.

Selector hanya menampilkan resource yang dikembalikan server untuk tenant aktif.

Contoh Finance:

```
Student selector
→ hanya student tenant aktif

Academic Year selector
→ hanya academic year tenant aktif

Fee Category selector
→ hanya category tenant aktif
```

Manual ID input boleh digunakan sebagai temporary development UI, tetapi bukan final operator UX.

## 9. Dynamic Terminology

Menurut PRD, UI menggunakan dictionary terminology berdasarkan profile institution.

Database entity tetap:

```
Student
Teacher/User
Classroom
FeeCategory
```

Presentation dapat berubah menjadi:
- Siswa
- Santri
- Warga Belajar
- Guru
- Ustadz
- Tutor
- Kelas
- Halaqah
- Syahriah
- SPP

Terminology transformation hanya berada pada presentation layer.

## 10. Plugin-Aware Navigation

Navigation harus berasal dari:
- core modules
- enabled plugins
- permission visibility

Jangan mengandalkan "hidden menu = security".

Server Action tetap melakukan authorization.

Target model:

```
Plugin Manifest
  ↓
Navigation Resolver
  ↓
Permission Filter
  ↓
Navigation UI
```

## 11. Responsive Contract

Mobile-first adalah baseline.

Target:
- tidak horizontal overflow pada viewport < 430px
- touch target minimum sekitar 44px
- table berubah menjadi scroll/stack yang disengaja
- form fields nyaman disentuh
- destructive action tidak terlalu mudah terpencet
- feedback tidak hilang sebelum terbaca

## 12. Feedback Contract

Setiap workflow harus memiliki:

### Loading
User tahu operasi sedang berjalan.

### Empty
User tahu tidak ada data dan apa tindakan berikutnya.

### Error
User mendapat pesan yang dapat dipahami tanpa membocorkan detail internal.

### Success
User mendapat konfirmasi yang jelas.

Untuk financial mutation, success response harus berasal dari server transaction completion.

## 13. Financial UI Contract

Finance dashboard bukan accounting engine.

UI menampilkan:
- Kas Masuk
- Kas Keluar
- Saldo
- Tagihan
- Pembayaran
- Kuitansi

Status charge:
- UNPAID
- PARTIAL
- PAID
- OVERPAID
- VOID

Nominal menggunakan format IDR di presentation.

Perhitungan nominal tetap berasal dari server/domain contract.

## 14. Attendance UI Contract

Attendance diprioritaskan untuk speed:

```
Today
→ Assignment
→ Session
→ Roster
→ Quick mark
→ Close
```

Primary interaction:
- default PRESENT
- perubahan exception
- mark all
- close session

Closed session harus tampil berbeda dan tidak menyediakan mutation controls.

## 15. Dashboard Contract

Dashboard harus menjawab:
> Apa yang harus dilakukan hari ini?

Bukan hanya menampilkan angka.

Role-oriented dashboard:
- Admin: operational tasks
- Teacher: today's schedule, classes, attendance, grades
- Finance staff: invoices, payments, arrears, cash
- Musyrif: residence, prayer, permits, halaqah

Role data tetap berasal dari server-side permissions.

## 16. Cache / Refresh Strategy

Untuk mutation:
- gunakan `revalidatePath()` atau mekanisme Next.js yang sudah dipakai repo
- refresh data setelah server mutation selesai
- jangan mempertahankan optimistic state financial yang bisa terlihat sukses sebelum commit database

## 17. Frontend Anti-Coupling Rules

UI tidak boleh:
- import Prisma
- import database types lalu menganggapnya sebagai UI contract tanpa transformasi bila bentuknya tidak stabil
- menghitung authorization
- mengubah tenant
- mengasumsikan status business hanya dari button visibility
- menulis ke localStorage sebagai source of truth untuk server data

Offline attendance secara PRD menggunakan IndexedDB + queue + sync engine; itu akan menjadi subsystem khusus, bukan pola generic untuk semua domain.

## 18. Incremental Component Strategy

Jangan membangun design system besar sebelum kebutuhan nyata muncul.

Gunakan reusable component hanya saat:
- pattern benar-benar berulang
- behavior perlu konsisten
- accessibility membutuhkan abstraction

Existing `NavHeader` tetap dipertahankan sampai kebutuhan plugin-aware navigation nyata membutuhkan perubahan.

## 19. Integration Sequence

Saat integration window dibuka:

```
Backend contract
→ Server Action contract
→ Page
→ Form
→ States
→ Responsive check
→ Accessibility check
→ Domain integration
→ Tests
```

Tidak ada redesign besar hanya untuk menyamakan semua halaman.

## 20. Definition of Done Frontend

Sebuah screen dianggap selesai apabila:
- route benar
- authorization server-side tersedia
- tenant data benar
- validation benar
- loading/empty/error/success tersedia
- mutation feedback benar
- mobile responsive
- touch target memadai
- tidak menjadi source of truth untuk business rule
- test yang relevan tersedia

Finance screen yang saat ini masih menggunakan manual Student ID / Academic Year ID diperlakukan sebagai **development UI sementara**, bukan kontrak UX final.
