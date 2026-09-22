# Application Contract — NataSekolah

Status: DESIGN / PRE-INTEGRATION
Baseline: staging
Implementation branch: feature/finance-core

## 1. Purpose
Dokumen ini menjadi penghubung antara Frontend, Server Actions, Domain Services, dan Infrastructure. Dokumen ini tidak menggantikan MASTER PRD, Architecture, Database, Security, atau ADR.

Authority order:
PRD → Architecture → Database/Security → ADR → Domain → Application Contract → Implementation

## 2. Server Action Boundary
Semua Server Action mengikuti:
Request → authenticated TenantContext → validation → authorization/scope/plugin → domain service → result → revalidation.
Business rules tetap berada di domain service, bukan di React.

## 3. Input Contract
Semua input eksternal wajib melewati validation boundary yang sesuai. Zod menangani shape, type, dan normalization. Validation bukan authorization.

Security fields yang tidak boleh dipercaya dari client:
institutionId, userId, guardianId, role, roles, permissions, isSuperAdmin.

Resource identifier seperti studentId, classroomId, chargeId, dan sessionId boleh datang dari client, tetapi server wajib memverifikasi tenant dan resource scope.

## 4. Result Contract
Success: { success: true, data: ... }
Failure: { success: false, error: ... }
Machine handling harus menggunakan stable domain error code, bukan parsing text message.

Structured error envelope dapat diperkenalkan secara bertahap tanpa big-bang refactor:
{ success: false, error: { code, message, fieldErrors? } }

## 5. Authorization Contract
Capability memakai permission granular seperti finance:view, finance:manage, attendance:view, attendance:manage, academic:view, dan academic:manage.
Resource scope berasal dari domain. Contoh: Teacher → TeacherAssignment → Classroom/Subject; Guardian → GuardianStudent → Student.
Plugin capability menggunakan plugin guard setelah session, tenant, dan RBAC.
Hidden menu bukan security mechanism.

## 6. Finance Contract
Create FeeCategory: validate → finance:manage → tenant → unique policy → mutation + audit.
Create StudentCharge: validate → finance:manage → tenant resource validation → duplicate policy → mutation + audit.
Create Payment: validate → authorize → idempotency → transaction payment + receipt + cashbook + charge status + audit → commit.
Void Payment: authorize → tenant lookup → status check → reversal cashbook + payment VOID + charge recalculation + audit → commit.
External notification berjalan setelah commit melalui outbox/worker dan tidak menentukan keberhasilan transaksi keuangan.

## 7. Attendance Contract
Fast path: Today → TeacherAssignment → AttendanceSession → Roster → Mark → Close.
Guru dibatasi oleh TeacherAssignment. CLOSED session immutable.
Offline attendance mengikuti PRD: IndexedDB → Offline Queue → Sync Engine → Server, dengan idempotency key.

## 8. Frontend Data Contract
Frontend menerima data yang sudah tenant-filtered dan permission-safe.
Existing modules masih boleh mengembalikan Prisma-derived objects bila itu kontrak yang telah berjalan. Jangan melakukan DTO migration massal.
DTO/transformer baru diperkenalkan per domain saat stabilitas atau reuse benar-benar membutuhkan.

## 9. Pagination Contract
List response standar: data, total, page, pageSize, totalPages.
Pagination selalu dibatasi server.
Ordering harus deterministic.
Aggregate balance tidak boleh disalahartikan sebagai balance halaman.

## 10. Mutation State
IDLE → PENDING → SUCCESS atau ERROR.
Untuk retry-sensitive operation, logical operation memakai idempotency key yang sama. Key baru dibuat setelah logical operation sukses.
Financial UI tidak menggunakan optimistic success sebelum database commit.

## 11. Dynamic Terminology
Terminology adalah presentation concern. Student dapat tampil sebagai Siswa, Santri, atau Warga Belajar; Teacher sebagai Guru, Ustadz, atau Tutor; Fee sebagai SPP, Syahriah, atau Biaya Paket.
Database entity tetap konsisten.

## 12. Plugin Contract
Plugin memiliki id, metadata, routes, permissions, navigation, business rules, dashboard widgets, dan domain services.
Enabled plugin berasal dari server-side institution context.

## 13. No Big-Bang Refactor
Auth, Tenant, Student, AcademicYear, Classroom, Enrollment, Teaching, dan Attendance yang sudah berjalan tidak dipindahkan massal hanya demi konsistensi kosmetik.
Perubahan dilakukan hanya untuk bug, security issue, kontrak baru, atau kebutuhan feature baru yang jelas.

## 14. Integration Gate
PRD compatibility → architecture compatibility → schema review → migration → domain tests → integration tests → typecheck → build → security review → UI review → PR review → merge.
Finance Core belum melewati seluruh gate.

## 15. Source of Truth
MASTER_PRD.md → 01_ARCHITECTURE/* → 02_DECISIONS/ADR.md → 03_EXECUTION/* → domain implementation → UI implementation.
Jika terdapat conflict, conflict harus diidentifikasi dan keputusan perubahan harus dicatat; jangan diam-diam memilih.