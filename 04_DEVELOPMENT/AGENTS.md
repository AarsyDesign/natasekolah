# NataSekolah Development Rules & Agent Operating Charter

## Stack Resmi
* **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide React
* **Backend & Database:** PostgreSQL, Prisma ORM
* **Storage:** Cloudflare R2 (S3-compatible)
* **Integrasi:** WhatsApp Provider Abstraction, Outbox Pattern Worker
* **Mobile / UX:** Mobile First, target sentuh min 44px, presensi < 60 detik

---

## 4 Jenis Dokumen Proyek
1. **PRD (`00_PRODUCT/`):** Menjawab *APA* yang dibangun.
2. **Architecture (`01_ARCHITECTURE/`):** Menjawab *BAGAIMANA* sistem dibangun.
3. **Decisions (`02_DECISIONS/`):** Menjawab *KENAPA* desain tersebut dipilih (ADR).
4. **Task Prompt:** Menjawab *APA* yang dikerjakan sekarang secara spesifik.

---

## Alur Kerja 3-Tahap (Mandatori Setiap Task)

```text
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│  MODE 1: PLAN  │ ───> │MODE 2:IMPLEMENT│ ───> │ MODE 3: VERIFY │
└────────────────┘      └────────────────┘      └────────────────┘
 Audit & Rencana          Eksekusi Coding         Audit & Review
  (Jangan Coding)        (Sesuai Rencana)       (Cari Celah/Leak)
```

### MODE 1 — PLAN
Prompt task memicu perumusan:
* Current State
* Problem / Scope
* Proposed Architecture
* Database Changes
* Files to Create / Modify
* Verification Plan (Tests)
* Risks & Mitigations
*Menunggu review & persetujuan pengguna sebelum menulis kode.*

### MODE 2 — IMPLEMENT
Agen melakukan implementasi sesuai kesepakatan plan.

### MODE 3 — VERIFY
Agen bertindak sebagai **Reviewer**, bukan pembuat:
* Mencari bug, kebocoran tenant (*tenant leakage*), potensi korupsi data historis, regresi, dan pengujian yang kurang.
* Menjalankan typecheck, lint, prisma validate, dan unit tests.
* Memperbaiki temuan sebelum menandai task selesai.

---

## Aturan Baku Rekayasa Perangkat Lunak
* **Tenant Security Boundary:** Jangan pernah mempercayai `institutionId` dari klien. Wajib ekstrak dari authenticated server session.
* **Sacred History:** Jangan menggunakan `classroom_id` pada model `Student`. Wajib menggunakan `Enrollment` (`@@unique([studentId, academicYearId])`).
* **Financial Integrity:** Transaksi keuangan tidak boleh di-hard delete. Gunakan status `VOID`/`REVERSAL` dan catat di `AuditLog`.
* **Frozen Report Card:** Raport yang diterbitkan dibekukan dalam format snapshot yang tidak terpengaruh revisi nilai masa depan.
* **Anti-Slop Mode 1 (DURING):** Kepatuhan visual `DESIGN.md` (Teal `#0f766e`, Warm Stone `#fbfbfa`, tanpa gradien ungu-biru klise, bebas em dash `—`).

---

## Strict Definition of Done (DoD)
Sebuah task hanya boleh dinyatakan **DONE** jika memenuhi seluruh kriteria:
- [ ] Prisma schema & constraints
- [ ] Database migration / validate
- [ ] Domain service & business logic
- [ ] Input validation (Zod)
- [ ] Authorization & RBAC
- [ ] Tenant isolation verified
- [ ] API / Server Action
- [ ] UI / Component
- [ ] Empty state & Error state
- [ ] Mobile responsive (< 430px, no overflow, min 44px touch)
- [ ] Unit test
- [ ] Integration / cross-tenant test
- [ ] Documentation updated (`PROGRESS.md` & `CHANGELOG.md`)

*Jika salah satu belum terpenuhi, status wajib ditulis: **PARTIALLY COMPLETE**.*

---

## Phase Gate Governance
Setiap fase memiliki gerbang (*Phase Gate*) yang ketat:
$$\text{Phase 0 Gate} \longrightarrow \text{Phase 1 Gate} \longrightarrow \text{Phase 2 Gate} \longrightarrow \dots$$
Dilarang melompat ke fase berikutnya jika gerbang fase aktif belum lulus 100%.
