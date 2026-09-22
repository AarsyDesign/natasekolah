# Backend Architecture Blueprint — NataSekolah

Status: DESIGN / PRE-INTEGRATION
Baseline: `staging`
Implementation branch: `feature/finance-core`

## 1. Architectural Contract

NataSekolah tetap menggunakan **Modular Monolith** sesuai MASTER PRD v5.0.

Request pipeline:

```
Request
  ↓
Authentication
  ↓
Tenant Context
  ↓
Zod Validation
  ↓
RBAC / Scope / Plugin Guard
  ↓
Application Use Case / Server Action
  ↓
Domain Service
  ↓
Infrastructure (Prisma / PostgreSQL / external providers)
```

Tidak ada client-side tenant authority.

`institutionId` berasal dari authenticated server session melalui `TenantContext`, bukan dari payload client.

## 2. Layer Ownership

### Authentication
Lokasi saat ini:
`src/lib/auth/**`

Tanggung jawab:
- session validation
- identity
- login/logout
- build `TenantContext`

### Tenant
Lokasi:
`src/lib/tenant/**`

Tanggung jawab:
- tenant context
- tenant boundary
- sanitasi field keamanan
- tenant-aware access checks

### Validation
Lokasi:
`src/lib/validation/**`

Tanggung jawab:
- syntax/type validation
- normalization
- boundary validation

Validation tidak memberikan authorization.

### Domain
Lokasi:
`src/lib/<domain>/**`

Setiap domain memiliki:
- `types.ts`
- domain services
- domain-specific errors
- public exports melalui `index.ts`

Domain service tidak boleh mempercayai data security dari client.

### Application / Server Actions
Lokasi:
`src/actions/**`

Server Action bertugas sebagai application boundary:
1. ambil authenticated context
2. panggil use case/domain service
3. revalidate cache/path bila diperlukan
4. kembalikan response serializable

Business rule tidak diletakkan di UI.

### Infrastructure
Saat ini:
- Prisma: `src/lib/prisma.ts`
- PostgreSQL
- external providers akan diabstraksikan saat domain terkait mulai diimplementasikan

## 3. Domain Boundaries

Unified Core:
- Institution
- Authentication / Session
- User / Staff
- Student
- Guardian
- AcademicYear
- Classroom
- Enrollment
- Attendance Core
- Finance Core
- Notification Engine
- Document Engine
- File Storage
- Audit Log
- Settings

Toggleable plugins:
- `FORMAL_ACADEMIC`
- `PESANTREN_LIVING`
- `TAHFIDZ`
- `PKBM`

Plugin bukan sekadar route/menu. Plugin nantinya dapat membawa manifest, routes, permissions, navigation, business rules, dashboard widgets, dan domain services.

## 4. Resource Ownership Rules

### Student
`Student` adalah identity master.

Kelas tidak disimpan langsung pada Student.

Gunakan:
`Student → Enrollment → AcademicYear → Classroom`

### Teacher
Guru menggunakan `User` dengan role `TEACHER`.

Resource scope guru ditentukan oleh `TeacherAssignment`, bukan hanya role.

### Attendance
Gunakan:
`TeacherAssignment → AttendanceSession → AttendanceRecord → Student / Enrollment`

Closed session immutable.

### Finance
Gunakan:
`FeeCategory → StudentCharge → PaymentTransaction`

Payment posted immutable secara bisnis.

Correction:
`VOID / REVERSAL / ADJUSTMENT`

## 5. Database Integrity

Tenant boundary harus dipertahankan pada dua level:

1. Application/service query:
   `institutionId` wajib berasal dari context.
2. Relational database:
   compound foreign key yang membawa `institutionId` digunakan ketika model membutuhkan perlindungan lintas-tenant.

Historical data menggunakan restrict/immutable lifecycle ketika deletion dapat merusak histori.

## 6. Transaction Policy

Gunakan transaction untuk operation yang menghasilkan beberapa state yang harus konsisten.

Contoh Finance Payment:

```
Validate
→ Authorize
→ Idempotency Check
→ Create Payment
→ Create Receipt
→ Create Cashbook
→ Update Charge
→ Audit
→ Commit
```

Kegagalan salah satu komponen harus menggagalkan seluruh transaction.

Operation sensitif yang rentan concurrent write boleh menggunakan isolation level yang lebih kuat + retry terbatas sesuai kebutuhan.

## 7. Error Contract

Domain errors harus memiliki:
- stable error code
- human-readable message
- HTTP-equivalent status

Contoh Finance:
- `FINANCE_RESOURCE_NOT_FOUND`
- `FINANCE_CONFLICT`
- `CHARGE_HAS_PAYMENTS`
- `PAYMENT_ALREADY_VOID`

UI tidak boleh bergantung pada parsing string message sebagai machine contract.

## 8. Query Rules

Read:
- selalu tenant-scoped
- pagination dibatasi
- order deterministic

Mutation:
- authorize sebelum mutation
- sanitize security fields
- validate foreign resources dalam tenant yang sama
- audit untuk operasi sensitif

Jangan menambahkan generic repository abstraction hanya untuk mengurangi duplikasi sebelum terbukti diperlukan.

## 9. External Provider Boundary

Provider eksternal tidak boleh menjadi bagian langsung dari domain transaction.

Pola:

```
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

Contoh payment:
payment sukses tidak boleh bergantung pada sukses/gagal WhatsApp.

## 10. Proposed Incremental Folder Contract

Struktur target, tanpa memindahkan file existing secara prematur:

```
src/
├── actions/
│   ├── academic.ts
│   ├── attendance.ts
│   ├── finance.ts
│   └── ...
├── app/
│   ├── students/
│   ├── attendance/
│   ├── finance/
│   └── ...
├── components/
├── lib/
│   ├── auth/
│   ├── tenant/
│   ├── validation/
│   ├── academic/
│   ├── attendance/
│   ├── finance/
│   ├── plugins/
│   ├── notifications/
│   ├── documents/
│   └── prisma.ts
└── ...
```

Folder baru hanya ditambahkan saat domain mulai diimplementasikan.

## 11. Backend Rules for Future Development

- PRD tetap product authority.
- Architecture docs tetap architecture authority.
- ADR menjelaskan keputusan yang menyimpang/bertrade-off.
- `staging` adalah baseline implementasi.
- Existing working domain tidak direfactor tanpa kebutuhan.
- Domain logic tidak boleh bocor ke React component.
- Client input tidak pernah menjadi tenant authority.
- AI bukan source of truth.
- Historical data tidak boleh di-overwrite secara destruktif.

## 12. Integration Strategy

Arsitektur ini sengaja **tidak meminta migration sekarang**.

Saat integration window tiba:

```
Design
→ Schema
→ Migration
→ Domain Service
→ Server Action
→ UI
→ Unit Test
→ Integration Test
→ Build
→ Review
→ Merge
```

Finance runtime verification yang tertunda tetap merupakan gate tersendiri dan tidak dianggap selesai hanya karena blueprint ini telah dibuat.
