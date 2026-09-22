# Architecture Overview - NataSekolah

## 1. Topologi Sistem

```text
               ┌───────────────────────────────┐
               │    Next.js 16 (App Router)    │
               │   Server Actions & UI Engine  │
               └───────────────┬───────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
│ Auth & RBAC │         │Tenant Guard │         │Domain Plugin│
│ (Dual-Track)│         │(AsyncContext│         │  Registry   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │   Prisma ORM (Data Layer)     │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │     PostgreSQL Database       │
               │ (Compound FKs & Constraints)  │
               └───────────────────────────────┘
```

---

## 2. Pola Multi-Tenancy (Row-Level Security Application Enforced)
* **Model:** Shared Process, Shared Database, Isolated by Row.
* **Tenant Identifier:** `institutionId` (CUID).
* **Aturan Keamanan:** Klien dilarang mengirim `institutionId` sebagai parameter otorisasi. `institutionId` selalu diekstraksi dari sesi server terautentikasi (`getAuthenticatedTenantContext()`).
* **Context Storage:** Node.js `AsyncLocalStorage` mengalirkan `TenantContext` di sepanjang *request execution tree*.

---

## 3. Asynchronous WhatsApp Outbox Pattern
Setiap mutasi bisnis penting (pembayaran SPP, absensi harian) mencatat event ke tabel `NotificationOutbox` dalam transaksi database yang sama.
* Kegagalan koneksi pihak ketiga (WhatsApp API) tidak menggagalkan transaksi finansial atau presensi.
* Worker latar belakang memproses antrean dengan mekanisme *exponential backoff retry*.

---

## 4. Lapisan Validasi Input & Domain Plugin Registry (Phase 0.3)
1. **Validation Boundary (Zod):**
   * Seluruh data masuk (HTTP request payload, Server Action form data, API parameter) wajib divalidasi dan ditransformasi oleh skema Zod di `src/lib/validation/*` sebelum masuk ke service layer.
   * Zod bertindak sebagai penjaga integritas tipe dan batas data (*data hygiene*), bukan otorisasi keamanan.
2. **Domain Plugin Architecture:**
   * **Unified Core (Selalu Aktif):** Multi-tenancy, autentikasi, Buku Induk siswa, SPP/syahriah, kasir, presensi cepat, dan audit log.
   * **Toggleable Domain Plugins:** `FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM` diaktifkan per institusi via `Institution.enabledPlugins`.
   * **Enforcement Urut:**
     $$\text{Zod Input Validation} \longrightarrow \text{Session} \longrightarrow \text{Tenant Isolation} \longrightarrow \text{RBAC} \longrightarrow \text{Plugin Guard} \longrightarrow \text{Domain Logic}$$

---

## 5. Master Data Engine & Academic Core (Phase 1)
1. **Application Pipeline:**
   $$\text{UI Component} \longrightarrow \text{Server Action} \longrightarrow \text{Zod} \longrightarrow \text{Session} \longrightarrow \text{Tenant} \longrightarrow \text{RBAC} \longrightarrow \text{Domain Service} \longrightarrow \text{Prisma}$$
2. **Sacred History Principles:**
   * Model `Student` berdiri sendiri sebagai master identitas primer tanpa foreign key `classroomId` langsung.
   * Penempatan ruang belajar siswa diproses secara eksklusif via model `Enrollment` (`@@unique([studentId, academicYearId])`).
   * Riwayat penempatan kelas masa lalu tersimpan abadi saat siswa naik kelas (*promoted*), tertahan (*retained*), atau lulus (*graduated*).
3. **Relational Invariant Protection:**
   * PostgreSQL Compound Foreign Keys pada `Enrollment` dan `Classroom` secara relasional menjamin bahwa data siswa, rombel, dan tahun ajaran berada pada institusi yang sama dan rombel terikat pada tahun ajaran yang bersangkutan.

---

## 6. Academic Teaching Core & Teaching Assignment (Phase 2)
1. **Teacher Identity & Scope:**
   * Guru menggunakan model identitas tunggal `User` internal lembaga dengan peran `TEACHER`.
   * Penugasan mengajar dikelola oleh model `TeacherAssignment` yang mengikat kuartet: `Teacher` + `Subject` + `Classroom` + `AcademicYear`.
2. **Compound Constraint Boundary:**
   * Database compound foreign keys menjamin integritas relasional: guru, mapel, kelas, dan tahun ajaran berasal dari institusi yang sama, dan kelas terikat pada tahun ajaran yang sah.
3. **Resource Scope Enforcement:**
   * Guru hanya diizinkan melihat penugasan mengajar miliknya sendiri (`teacherId = session.userId`).
   * Guru dilarang memanipulasi penugasan guru lain atau membuat penugasan baru tanpa hak akses administratif (`academic:manage`).

---

## 7. Attendance Core & Immutability Architecture (Phase 3)
1. **Attendance Derivation Flow:**
   $$\text{TeacherAssignment} \longrightarrow \text{AttendanceSession} \longrightarrow \text{AttendanceRecord} \longrightarrow \text{Student / Enrollment}$$
   * Menjamin status kehadiran tidak disimpan langsung di entitas `Student`.
   * Presensi selalu bersumber dari penugasan mengajar guru dan daftar siswa aktif pada `Enrollment`.
2. **Dual-Key Pointer di AttendanceRecord:**
   * Setiap rekaman kehadiran menyimpan `studentId` dan `enrollmentId`, menjamin histori kehadiran tetap terikat pada tahun ajaran dan rombel yang tepat saat itu.
3. **Session Immutability (CLOSED is Sacred):**
   * Sesi dibuka (`OPEN`) oleh guru pemilik penugasan, kemudian ditutup (`CLOSED`) saat presensi selesai.
   * Sesi berstatus `CLOSED` bersifat kekal (immutable): modifikasi catatan kehadiran ditolak permanen.
   * Penutupan sesi mensyaratkan seluruh siswa terdaftar dalam rombel telah memiliki catatan kehadiran.
4. **Teacher Resource-Scope Authorization:**
   * Guru hanya diizinkan melihat, membuka, mengisi, dan menutup sesi untuk `TeacherAssignment` miliknya sendiri. Akses ke penugasan guru lain ditolak instan (403 Forbidden).
   * Admin dan Kepala Sekolah dengan hak administratif dapat mengelola sesi lintas guru dalam institusi yang sama.



## 8. Finance Core & Immutable Financial Ledger (Phase 3)

1. **Finance 3-Tier Flow:**
   Finance follows FeeCategory -> StudentCharge -> PaymentTransaction.
   * FeeCategory is the tenant-scoped catalog.
   * StudentCharge stores gross amount, discount, period, due date, and payment status.
   * PaymentTransaction stores actual payments and is never hard-deleted.
2. **Atomic Payment Workflow:**
   Validate -> Authorize -> Idempotency Check -> Payment + Receipt + Cashbook + Audit -> Commit.
   All payment components are created in one database transaction.
3. **Immutable Correction Model:**
   * POSTED payments are not edited or deleted.
   * Cancellation uses VOID and creates a reversal entry in CashbookEntry.
   * Receipts remain historical evidence; corrections never erase the original proof.
4. **Charge Lifecycle:**
   * UNPAID -> no active payment.
   * PARTIAL -> active payment is below net charge value.
   * PAID -> active payment exactly equals net charge value.
   * OVERPAID -> active payment exceeds net charge value.
   * VOID -> charge is cancelled without deleting history.
5. **Tenant Boundary:**
   All domain services receive TenantContext, derive institutionId from the authenticated server session, and use tenant-scoped lookups before mutation.

## 9. Backend & Frontend Implementation Blueprints
Untuk menjaga konsistensi antara PRD, architecture, domain service, Server Actions, dan UI, detail kontrak implementasi dipisahkan menjadi:

- [Backend Architecture Blueprint](./BACKEND-ARCHITECTURE.md)
- [Frontend Architecture Blueprint](./FRONTEND-ARCHITECTURE.md)

Dokumen tersebut bersifat **pre-integration design**. Tidak memindahkan struktur existing secara massal dan tidak mengubah source of truth yang sudah berjalan.

- [Application Contract](./APPLICATION-CONTRACT.md) — kontrak antar Frontend, Server Actions, Domain, validation, authorization, error, pagination, mutation state, dan integration gate.
