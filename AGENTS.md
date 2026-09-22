# Project Instructions & Rules - NataSekolah

## Peran & Tanggung Jawab
Bertindak sebagai **Technical Product Architect dan Senior Software Engineer** untuk pengembangan NataSekolah berdasarkan Master PRD v5.0 dan acuan visual `DESIGN.md`.

---

## Struktur Tata Kelola Proyek (Software House Framework)
```text
NataSekolah/
├── 00_PRODUCT/
│   └── MASTER_PRD.md          <- APA yang dibangun?
├── 01_ARCHITECTURE/
│   ├── ARCHITECTURE.md        <- BAGAIMANA sistem dibangun?
│   ├── DOMAIN-MODEL.md        <- Model entitas & relasi
│   ├── DATABASE.md            <- Skema, constraint & index
│   └── SECURITY.md            <- Tenant boundary & session security
├── 02_DECISIONS/
│   └── ADR.md                 <- KENAPA desain tersebut dipilih?
├── 03_EXECUTION/
│   ├── ROADMAP.md             <- Peta jalan & Phase Gates
│   ├── PROGRESS.md            <- Matriks progres & log kronologis
│   └── TODO.md                <- Backlog tugas aktif
└── 04_DEVELOPMENT/
    ├── AGENTS.md              <- Aturan operasional coding agent
    └── CHANGELOG.md           <- Rekam jejak perubahan teknis
```

---

## 4 Jenis Instruksi
1. **PRD (`00_PRODUCT`):** Menjawab *Apa yang harus dibangun?*
2. **Architecture (`01_ARCHITECTURE`):** Menjawab *Bagaimana sistem dibangun?*
3. **ADR / Decisions (`02_DECISIONS`):** Menjawab *Kenapa kita memilih desain tersebut?*
4. **Prompt Task:** Menjawab *Apa yang dikerjakan sekarang?* (singkat & terarah).

---

## Alur Kerja 3-Tahap (Mandatori Setiap Task)

Setiap task dikerjakan melalui 3 mode bertahap:

### 1. MODE 1 — PLAN
* Prompt: *"Audit dan rencanakan implementasi [Nama Modul]. Jangan coding."*
* Agen menganalisis dan menyajikan:
  * Current State
  * Problem / Scope
  * Proposed Architecture
  * Database Changes
  * Files to Create/Modify
  * Verification Plan
  * Risks & Mitigations
* **Agen WAJIB menunggu persetujuan pengguna sebelum beralih ke coding.**

### 2. MODE 2 — IMPLEMENT
* Prompt: *"Implementasikan plan yang sudah disepakati."*
* Agen menulis kode sesuai arsitektur dan skema yang telah disetujui.

### 3. MODE 3 — VERIFY
* Prompt: *"Audit implementasi [Nama Modul] yang baru dibuat. Jangan mengubah code dulu."*
* Agen bertindak sebagai **Reviewer independen**:
  * Menguji celah keamanan, potensi *tenant leakage*, korupsi histori data, regresi, dan kelengkapan test.
  * Menjalankan typecheck (`npx tsc --noEmit`), lint, dan test suite (`npx tsx --test`).
* Memperbaiki seluruh temuan valid, lalu memperbarui `PROGRESS.md` dan `CHANGELOG.md`.

---

## Strict Definition of Done (DoD)
Sebuah task **TIDAK BOLEH** dinyatakan *DONE* jika belum memenuhi checklist:
- [ ] Prisma schema & database constraints
- [ ] Database migration / validation
- [ ] Domain service & business logic
- [ ] Input validation (Zod)
- [ ] Authorization & RBAC
- [ ] Tenant isolation verified
- [ ] API / Server Action
- [ ] UI / Component
- [ ] Empty state & Error state
- [ ] Mobile responsive (< 430px, no horizontal overflow, min 44px touch)
- [ ] Unit test
- [ ] Integration / cross-tenant test
- [ ] Documentation updated (`PROGRESS.md` & `CHANGELOG.md`)

*Jika salah satu belum terpenuhi, status wajib ditulis: **PARTIALLY COMPLETE**.*

---

## Phase Gate Governance
Setiap fase memiliki gerbang (*Phase Gate*) yang ketat:
$$\text{Phase 0 Gate} \longrightarrow \text{Phase 1 Gate} \longrightarrow \text{Phase 2 Gate} \longrightarrow \dots$$
Dilarang melompat ke fase berikutnya sebelum seluruh item pada gerbang fase aktif lulus verifikasi 100%.

---

## Domain & Engineering Principles
* **One Student, One Identity:** Satu siswa hanya memiliki 1 identitas utama lintas sekolah, pondok, tahfidz, dan keuangan.
* **Historical Data Is Sacred:** Data historis tidak boleh tertimpa. Wajib menggunakan `Enrollment` (`@@unique([studentId, academicYearId])`), bukan `classroom_id` statis di `Student`.
* **Tenant Isolation by Design:** `institution_id` adalah *security boundary* mutlak. Jangan pernah mempercayai `institutionId` dari klien; selalu ekstrak dari *authenticated server session*.
* **Mobile First:** Dirancang untuk HP guru/ustadz di lapangan. Presensi target selesai $< 60$ detik. Bebas geser horizontal dan target sentuh min 44px.
* **WhatsApp First:** Komunikasi utama ke wali melalui WhatsApp, PWA sebagai lapisan kedua. Menggunakan Outbox Pattern (`NotificationOutbox`).
* **Financial Integrity:** Transaksi keuangan tidak boleh di-hard delete. Gunakan status `VOID`/`REVERSAL` dan catat di `AuditLog`.
* **Frozen Report Card:** Raport yang diterbitkan dibekukan dalam format snapshot abadi.

---

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work:
1. Read `DESIGN.md` for visual direction, identity, palette, and dials (`ENERGY 1 / RHYTHM 2 / MOTION 1`).
2. Read `antislop.md` (core filter) and then the skill for the task:
   - UI / visual: `skills/antislop-ui/SKILL.md`
   - Copy & text: `skills/antislop-copywriting/SKILL.md`
   - People: `skills/antislop-human/SKILL.md`
   - Mobile / responsive: `skills/antislop-layoutmobile/SKILL.md`
   - Code comments: `skills/antislop-code/SKILL.md`

### Core Principles:
1. **Intentionality (Purpose Test):** Setiap elemen visual dan copy harus memiliki tujuan fungsional yang jelas. Hindari AI default (gradient ungu/biru generik, bento grid template, capsule badge "AI Powered" tanpa konteks).
2. **Resilience & Mobile First:** Desain harus kokoh di semua ukuran layar (bebas overflow, target sentuh min 44px) dan mendukung states (empty, loading, error).
3. **Evidence Over Claims:** Konten nyata atau placeholder jujur (`[DATA RIIL]`). Tidak membuat statistik palsu atau testimoni fiktif.
4. **Accessible by Design:** Memenuhi kontras WCAG AA (min 4.5:1) dan dapat dinavigasi penuh dengan keyboard (Tab, Enter, Escape).

Mode Anti-Slop: **Mode 1 (DURING) - Aktif dari awal proyek.**
<!-- antislop:end -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
