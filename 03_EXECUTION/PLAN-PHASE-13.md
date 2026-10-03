# Phase 13 Execution Plan — Kesiapan Produksi & Bayar Utang Kualitas

> **Ditulis**: 2026-10-03, saat **Gate 12.8 LULUS** (`tsc 0` · `npm test` **773/773** · `build exit 0` · `lint 0 error` · docs konsisten).
> **Sumber ide**: hasil **Production Readiness Audit Phase 12.6** (H1–H3, M1–M5, L1), backlog `AUDIT-LOG.md` (B-02…B-14), utang a11y 368 warning, sisa PRD.
> **Pola**: sama dengan `PLAN-PHASE-11.md` / `PLAN-PHASE-12.md` — current state, scope per jalur, DoD Strict, verification plan, risiko.
> **Aturan keras tetap berlaku**: audit dulu sebelum ubah kode · **tanpa commit/push/deploy/migrasi tanpa izin Arsyad** · jangan rusak fitur yang berjalan · kalau tidak ada yang layak, jangan memaksakan perubahan.

---

## 1. Current State (Ringkas)

| Metric | Value |
|--------|-------|
| Test suite | **773/773** pass (227 suites), 0 fail |
| TypeScript | `tsc --noEmit` → 0 error |
| Lint | 0 error · **368 warning** (≈90 `label-has-associated-control`) |
| Build | `npm run build` → exit 0 · bundle 478 kB gz, chunk terbesar 71,6 kB |
| DB schema | `migrate diff` nihil · strategi baseline sudah didokumentasi di README |
| Produksi | `natasekolah.vercel.app` — Git integration **auto-deploy dari push `staging`** (terverifikasi 2026-10-03: landing page + fix `/login` tayang sendiri) |
| Phase 0–12 | **ALL COMPLETE** (Roadmap 12.1–12.8 `[x]` semua) |
| Backlog terblokir | 9 item tetap **TUNGGU KEPUTUSAN Arsyad** — jangan dikerjakan |

---

## 2. Scope Phase 13 — Dua Jalur (sama seperti Phase 12)

### 2.1 Jalur A — Bisa dikerjakan sekarang (tanpa keputusan eksternal)

| # | Item | Deskripsi | Est. Effort | File Target |
|---|------|-----------|-------------|-------------|
| **13.1** | **B-13: Dokumentasi kanal rilis** | Fakta terverifikasi: push `origin/staging` → Vercel Git integration membangun & merilis otomatis. Perbarui tabel *Deployment* di README (klaim basi soal kuota/permintaan manual) + cara rollback (revert + push). | Kecil | `README.md` |
| **13.2** | **B-07a: Utang a11y tahap 1** | Perbaiki `label-has-associated-control` pada **1–2 halaman formulir utama** dulu (mis. tambah/edit data santri & finance), bukan seluruh repo — per file, review manual setelah tiap file. Turunkan warning bertahap. | Sedang | `src/app/**` form pages |
| **13.3** | **Audit fungsional statis `/finance` & `/attendance`** | Read-only: empty state, loading, error state, tombol yang bisa mati, alur aksi destruktif (konfirmasi), kerapian pesan. Temuan valid → perbaikan kecil menyusul. | Sedang | `src/app/finance/**`, `src/app/attendance/**` |
| **13.4** | **M2: kurangi `as any` berisiko** | Audit menemukan `as any` pada jalur data audit — ganti dengan tipe eksplisit di file inti saja (jangan sweeping besar-besaran). | Kecil | sesuai temuan audit |
| **13.5** | **QA E2E eksploratif lintas halaman** | Jelajahi alur utama sebagai pengguna nyata (HP 390px + desktop): login → dashboard → presensi → wali. Bukti screenshot; **tandai hasil inspeksi apa adanya** (jangan klaim hal yang tidak dilihat). | Sedang | — (bukti di laporan) |
| **13.6** | **Gate Keluar Phase 13** | `tsc 0` · `npm test` ≥773 · `build exit 0` · `lint 0 error` (warning turun) · docs konsisten → **tulis PLAN-PHASE-14**. | Kecil | docs |

### 2.2 Jalur B — BUTUH KEPUTUSAN ARSYAD (dilarang dikerjakan dulu)

| ID | Item | Keputusan yang diminta |
|----|------|------------------------|
| **B-02** | Cron `notifications` **fail-open** (`route.ts:19-27`) | Setuju jadi **fail-closed** (cron dihentikan bila `CRON_SECRET` tak ter-set) — risiko: notifikasi malam berhenti sampai env diset |
| **B-03** | `executeAIGeneration` / `reviewAIGenerationJob` tanpa `requirePermission` | Setuju tambah guard `ai:generate` dsb. |
| **B-04** | Rate limit **in-memory** (`rate-limit-store.ts:232-237`) | Pilih backend: Redis (butuh `RATE_LIMIT_REDIS_URL`) / DB / tetap in-memory + caveat dokumentasi |
| **B-08** | Endpoint `/metrics` belum ada | Setuju buka (dengan auth) atau cukup snapshot internal |
| **B-09** | Panel **lintas-tenant** belum ada (super admin = admin lembaga) | Apa bentuk panel super admin sebenarnya? |
| **B-14** | `ci.yml` tak bisa di-commit (token OAuth tanpa scope `workflow`) | **Authorize ulang GitHub** (Arsyad sendiri) agar CI berjalan |
| 9.4 | Tier `COMMUNITY`/`DEVELOPER_CENTRAL`, `AI_API_KEY` nyata, deploy permanen | Keputusan produk/infra lama |

---

## 3. DoD Strict (setiap item Jalur A)

- [ ] Audit/inspeksi didahulukan; temuan ditulis di `AUDIT-LOG.md` sebelum kode diubah.
- [ ] Tidak merusak fitur yang berjalan (test suite tetap hijau).
- [ ] `tsc --noEmit` 0 · `npm test` ≥773 · `npm run lint` 0 error · `npm run build` exit 0.
- [ ] Empty state / error state / responsif 390px tidak memburuk (perubahan UI wajib dilihat via browser, bukan cuma kode).
- [ ] Docs (`CHANGELOG`, `TODO`, `AUDIT-LOG`) diperbarui.
- [ ] **Commit/push/deploy hanya setelah izin eksplisit Arsyad**; stage file terkait saja, cek diff tanpa kredensial/data pribadi/file asing.

## 4. Verification Plan

1. Per item: bukti perintah (`tsc`, test, lint, build) dicatat apa adanya di laporan.
2. Item UI: QA E2E eksploratif browser (desktop + 390px), screenshot disimpan sebagai bukti.
3. Gate 13: rangkaian penuh + cek konsistensi docs (Roadmap 13.x `[x]` semua).

## 5. Risiko & Mitigasi

- **Perubahan a11y menyentuh banyak form** → batasi 1–2 file per siklus; review manual.
- **Utang "menyusul-sana" membesar** → hanya perbaikan yang punya dampak pengguna nyata; kalau tidak ada, siklus NO CHANGE.
- **Konflik dengan cron audit 30 menit** → maks 1 kerjaan mandiri per siklus, baca `AUDIT-CHARTER.md` + `AUDIT-LOG.md` dulu.
- **Backlog Jalur B tergoda dikerjakan sendiri** → aturan keras: butuh jawaban "ya" dari Arsyad per item.
