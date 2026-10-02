# PLAN — Phase 9: Penutupan Backlog Gerbang & Kesiapan Rilis (NataSekolah)

> Mode 1 (PLAN). Disusun 2026-10-02 setelah Phase 0–8 dinyatakan COMPLETE.
> **HASIL (2026-10-02):** 9.0 ✅ (4/4 TC lulus; 5 temuan diperbaiki — lihat TODO), 9.1 ✅, 9.2 ✅,
> 9.3 ✅, 9.4 ⏸ menunggu keputusan Arsyad, 9.5 ✅ gate LULUS → lanjut `PLAN-PHASE-10.md`.
> Sumber: audit silang `03_EXECUTION/ROADMAP.md` (commit `d0e861e`) — sisa `[ ]` = 3 butir backlog
> + temuan QA E2E + blocker infra.

## 1. Current State

- Phase 0–8 **COMPLETE**. Test **489/489** (setelah merge offline-attendance-sync), `tsc 0`, `build exit 0`.
- Sisa checkbox ROADMAP (3 butir, semua terverifikasi "belum ada / sebagian"):
  1. **Tasrih / Permit Engine** (Phase 5 Gate) — belum ada entitas permit sama sekali.
  2. **Guardian Master Data CRUD staf** (Phase 1 Gate) — model+aktivasi wali ada; CRUD & wizard undangan untuk staf belum ada.
  3. **Student Full Profile 5 Kluster Dapodik/EMIS** (Phase 1 Gate) — profil inti ada; kluster terstruktur (keluarga, kesehatan/disabilitas, registry) belum ada di skema.
- Backlog lain yang diketahui: UI-click manual AI Generator (menunggu harness browser), tier
  Question Bank `COMMUNITY`/`DEVELOPER_CENTRAL`, CI workflow (token OAuth tanpa scope `workflow`),
  deploy Vercel (kuota penuh — BLOCKED oleh user).

## 2. Scope & Urutan Pekerjaan

### 9.0 Verification Sisa Phase 8 (kecil)
- QA E2E eksploratif klik-manual modal "Generate Soal AI" via browser harness (form → review → simpan).
- Keluaran: temuan bug (bila ada) → fix → test tetap hijau.

### 9.1 Tasrih / Permit Engine (Izin Pulang Santri) — prioritas 1
*Kenapa pertama: paling kecil, self-contained, menutup Phase 5 Gate 100%.*

- **Skema** (`prisma/schema.prisma`, migrasi MANUAL — `migrate diff` nihil, tanpa `migrate dev`):
  - `PermitRequest`: id UUID, compound FK `[institutionId, studentId]`, `academicYearId`,
    `requestedAt`, `type` (`HOME_LEAVE` | `SICK_LEAVE` | `EXCUSED`), `leaveAt`/`returnAt`,
    `reason`, `status` (`PENDING` → `APPROVED`/`REJECTED` → `RETURNED`/`OVERDUE`),
    `approvedById`, `notes`, `createdAt`/`updatedAt`.
  - Index `[institutionId, status]`, `[institutionId, leaveAt]`.
- **Validation** (Zod) di `src/lib/validation/permit.ts`.
- **Service** `src/lib/permit/permit-service.ts`: create (hanya siswa dengan assignment asrama aktif),
  approve/reject (guard status lifecycle), markReturned, list+filter; semua baca-tulis
  `TenantContext` + `AuditLog`.
- **RBAC**: izin baru `pesantren:view` / `pesantren:manage` di matriks `ROLE_PERMISSIONS`
  (SUPER_ADMIN, FOUNDATION_HEAD, PRINCIPAL, ADMIN; wali via ReBAC portal sendiri).
- **Server actions** `src/actions/permit.ts` (+ `rethrowIfSessionExpired`).
- **UI**: `/dormitories/permits` (daftar + filter status + modal ajukan/ approve);
  portal wali `/wali/asrama` → daftar permit milik anak + tombol "Ajukan izin" (opsional, tahap lanjut).
- **Notification helper**: `notifyGuardian...` saat APPROVED (pakai outbox eksisting, template baru `PERMIT_APPROVED`).
- **Tests**: `test/permit-engine.test.ts` — lifecycle, cross-tenant 403, siswa tanpa asrama ditolak,
  immutability status selesai, AuditLog tertulis. Target: +15–20 test.

### 9.2 Guardian Master Data CRUD Staf + Wizard Undangan — prioritas 2
- **Server actions** `src/actions/guardian.ts`: listGuardians (filter/cari), updateGuardian,
  deactivateGuardian, createInvitation (72 jam single-use — pakai service `src/lib/auth/guardian.ts` eksisting).
- **UI** `/guardians`: tabel wali + relasi anak, modal edit, modal undangan (generate link/token → salin),
  empty state & error state; mobile ResourceList.
- **Tests**: guard RBAC (`staff:manage`/`student:manage`), tenant isolation, token sekali pakai.
  Target: +10–15 test.

### 9.3 Student Full Profile — 5 Kluster Dapodik/EMIS — prioritas 3 (terbesar)
- **Skema**: tabel terpisah (bukan kolom lebar) — `StudentFamilyData`, `StudentHealthData`,
  `StudentRegistryData` (BPJS/no. SKTM/dll), compound FK `[institutionId, studentId]`, 1-to-1.
- **Migrasi manual** (jalur sama seperti 9.1), `prisma validate` + `migrate diff` nihil.
- **Service + Zod + server actions** (`getStudentProfileDetail`, `upsertStudentCluster`).
- **UI** `/students/[id]` → tab tambahan: Keluarga, Kesehatan, Registry (form + tampil, izin `student:manage`).
- **Importer**: kolom opsional pada template xlsx (klaster keluarga minimal) — tahap lanjut bila waktu cukup.
- **Tests**: +20 target, termasuk cross-tenant.

### 9.4 Backlog Opsional / Terblokir (TIDAK dikerjakan sampai user buka blokir)
- Tier Question Bank `COMMUNITY`/`DEVELOPER_CENTRAL` → butuh keputusan produk (moderasi lintas lembaga).
- CI workflow `.github/workflows/ci.yml` → butuh token GitHub dengan scope `workflow` (pilihan Arsyad).
- Deploy Vercel permanen → butuh project baru + env Supabase (pilihan Arsyad).

## 3. Definition of Done (per tahap, mengikuti DoD Strict AGENTS.md)
Prisma & constraint · migrasi · domain service · Zod · RBAC · tenant isolation teruji ·
server action · UI · empty/error state · mobile < 430px tanpa overflow · unit+integration test ·
`PROGRESS.md` + `CHANGELOG.md` updated · `tsc 0` · `npm test` hijau · `build exit 0`.

## 4. Verification Plan
1. Per tahap: `npx tsc --noEmit` → `npm test` → (bila menyentuh skema) `prisma validate` + `migrate diff`.
2. QA E2E eksploratif halaman baru (login → alur utama → 390px).
3. Gate akhir Phase 9: `npm run build` exit 0 + audit silang ROADMAP `[ ]` → `[x]`.

## 5. Risks & Mitigations
- **Migrasi skema** → selalu manual + `migrate diff` nihil (larangan `migrate dev`).
- **Test mock lolos tapi bug nyata** (pelajaran Phase 7) → setiap write path wajib dibuktikan QA E2E.
- **Scope melebar** → 9.1–9.3 dikerjakan berurutan, satu tahap = satu commit hijau.
- **Vercel/CI tetap terblokir** → dideklarasikan eksplisit, tidak dijanjikan di gate.

## 6. Gate Keluar Phase 9
- ROADMAP: ketiga butir `[ ]` menjadi `[x]` dengan anotasi bukti.
- `tsc 0` · `npm test` (target > 500 test) · `build exit 0` · dokumentasi konsisten.
- **Sesuai instruksi Arsyad (2026-10-02): begitu gate ini lulus, langsung susun
  PLAN fase berikutnya** (`03_EXECUTION/PLAN-PHASE-<N>.md` + checklist TODO +
  update PROGRESS/CHANGELOG, commit & push) — jangan berhenti tanpa plan baru,
  dan jangan mengarang pekerjaan di luar backlog.
