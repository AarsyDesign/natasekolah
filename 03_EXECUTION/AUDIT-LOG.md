# NataSekolah — Continuous Audit Log

Satu log konsisten untuk semua siklus cron audit 30 menit.
**Aturan:** baca file ini sebelum memilih kerjaan baru; jangan ulang temuan tertutup;
catat setiap siklus (termasuk `NO CHANGE`); status akhir memakai Definition of Done di
`AUDIT-CHARTER.md` §14.

Acuan: `AUDIT-CHARTER.md` (charter) · `TODO.md` · `PROGRESS.md` · `CHANGELOG.md`.

---

## BACKLOG TEMUAN

Status: `DISCOVERED` = baru dicatat · `READY` = aman dikerjakan sendiri ·
`NEEDS_APPROVAL` = butuh keputusan Arsyad · `IN_PROGRESS` · `IMPLEMENTED` · `VERIFIED` · `CLOSED` · `BLOCKED`

| # | Temuan | Kategori | Bukti | Risiko/dampak | Status |
|---|--------|----------|-------|---------------|--------|
| B-01 | Nama fitur "DKAS" tampil di UI (nav sidebar, nav mobile, halaman, chip status, aria-label) — charter §9 mewajibkan **Nata Insight** | UI/UX | `app-shell.tsx:84`, `nav-header.tsx:77`, `app/dkas/page.tsx:17,22`, `dkas-chat.tsx:168,200` | Kebingungan antara fitur internal & proyek bot Telegram DKAS | **VERIFIED** (Siklus 1) |
| B-02 | `/api/cron/notifications` **fail-open**: bila `CRON_SECRET` kosong pemeriksaan dilewati sama sekali | SECURITY | `src/app/api/cron/notifications/route.ts:19-27`; `.env.example:15` (dikomentari) | Orang luar bisa memicu pengiriman notifikasi outbox (biaya provider, beban) | NEEDS_APPROVAL (mengubah kebijakan akses endpoint) |
| B-03 | `executeAIGeneration` & `reviewAIGenerationJob` tanpa `requirePermission` (tenant tetap aman, RBAC tidak) | SECURITY | `src/lib/ai-generation/ai-generation-service.ts:274`, `:373`; banding `:218` (`exam:manage`), `:464` (`exam:view`) | Role tanpa izin ujian bisa mengeksekusi/me-review job AI di lembaganya | NEEDS_APPROVAL (perubahan RBAC) |
| B-04 | Rate limit login masih **in-memory**; `UpstashStore` siap tapi butuh env | SECURITY | `rate-limit-store.ts:232-237`; `.env.example:37-38` | Di multi-instance, brute-force terbagi per instance (N× percobaan) | NEEDS_APPROVAL (butuh kredensial Upstash) |
| B-05 | README masih menginstruksikan `npx prisma db push`; strategi baseline migrasi produksi belum terdokumentasi | DOCUMENTATION | `README.md:58`; `prisma/migrations/` kini 7 migrasi; `migrate status` = up to date, `migrate diff` = nihil (lokal) | P500/P3005 saat baseline; risiko `migrate dev` menawarkan reset | READY (dokumentasi saja) |
| B-06 | Label UI **"Akses penuh platform"** untuk `SUPER_ADMIN` — padahal role intra-tenant | UI/UX | `src/app/settings/users/page.tsx:555` | Salah paham cakupan kuasa admin lembaga | READY (teks saja) |
| B-07 | 90 warning eslint `label-has-associated-control` (a11y) + 248 `no-unused-vars` | ACCESSIBILITY | `npm run lint` → 0 error / 368 warning | Form tidak punya label programatik; utang a11y | DISCOVERED (pecah per halaman, jangan satu siklus) |
| B-08 | Metrik observability tak terjangkau dari luar proses (`metricsSnapshot` tak dipakai; tidak ada `/api/metrics`) | MAINTAINABILITY | `src/lib/observability/metrics.ts` (grep pemakaian kosong) | Angka kumulatif hilang saat proses mati | NEEDS_APPROVAL (endpoint baru) |
| B-09 | Belum ada panel super admin lintas-tenant (daftar lembaga, impersonation, provisioning UI) | FEATURE | `find src/app -ipath "*super*"` kosong; `impersonatedByUserId` tak pernah diisi | Operasi lembaga baru hanya via seed/skrip lokal | NEEDS_APPROVAL (fitur baru, keamanan tinggi) |
| B-10 | `next-env.d.ts` drift lokal (path `.next/dev/` vs `.next/`) akibat `next dev` | MAINTAINABILITY | `git diff next-env.d.ts` | Noise di working tree; jangan di-commit selama dev server hidup | BLOCKED (artefak lokal; atasi saat dev server dimatikan) |
| B-11 | Phase 12.8 Gate + `PLAN-PHASE-13` menunggu (siklus "selesai → plan lagi") | PROCESS | `TODO.md:621` | Roadmap tidak maju | DISCOVERED (butuh rangkaian penuh typecheck/lint/test/build) |

**Catatan lama yang sudah tertutup (jangan diulang):** N+1 `/teachers` (8041→145ms), badge variant,
`subjectId` hilang, `AIGenerationQuotaResult`, `PageNumberElement` 0-arg di DOCX, `require()` di ESM,
kebocoran markdown mentah `**...**` di halaman depan, tombol aplikasi internal di header landing page.

---

## SIKLUS 1 — 2026-10-03 06:0x UTC

- **Waktu:** 2026-10-03 (siklus pertama charter)
- **Repository:** `/opt/data/work/natasekolah` · **Branch:** `feature/mizan-work` ✓ (verifikasi: `git rev-parse --abbrev-ref HEAD`)
- **Commit awal:** `4733725` · **Status working tree:** bersih kecuali `.project-monitor-state.json` (state monitor) dan `next-env.d.ts` (artefak `next dev`) — keduanya tidak disentuh.

**Audit yang dilakukan**
- Area: Inspect (repo/branch/status) · Security (temuan audit sebelumnya dimasukkan ke backlog) · UI/UX (referensi nama fitur) · Functional completeness (TODO terbuka).
- File/modul: `app-shell.tsx`, `nav-header.tsx`, `app/dkas/page.tsx`, `dkas-chat.tsx`, `test/dkas-planner.test.ts`, `03_EXECUTION/TODO.md`.
- Temuan baru: B-01 (nama DKAS di UI), B-10 (drift `next-env.d.ts`), B-11 (12.8 tertunda).
- Temuan lama terbuka: B-02 … B-09.

**Pekerjaan terpilih**
- Nama: **Rename tampilan UI "Asisten Data (DKAS)" → "Nata Insight"** (B-01).
- Kategori: UI/UX.
- Alasan: diminta eksplisit dalam charter §9; murni teks tampilan, business logic/permission/validasi tidak disentuh; temuan dengan nilai langsung bagi pengguna.
- Dampak: pengguna tidak lagi melihat nama proyek lain ("DKAS") di dalam NataSekolah.
- Risiko rendah: hanya 5 string UI; path `/dkas`, import `dkasQueryAction`, nama fungsi/berkas **tidak diubah** (kompatibilitas & test struktural aman).

**Implementasi**
- Status: **COMPLETED (IMPLEMENTED)** — menunggu siklus verify/verifikasi ulang sebelum `VERIFIED`? Tidak: verifikasi sudah dijalankan (lihat bawah) → **VERIFIED**.
- File berubah: `src/components/app-shell.tsx` (label nav sidebar), `src/components/nav-header.tsx` (label nav mobile/cari),
  `src/app/dkas/page.tsx` (subtitle NavHeader + H1), `src/components/dkas-chat.tsx` (chip status + `aria-label`).
- Ringkasan: 4 file, 7 baris. Sisa "DKAS" di UI = **0**; yang tersisa hanya komentar internal (`dkas-chat.tsx:4`, `app/dkas/page.tsx:4`) yang sengaja dibiarkan agar jejak Phase 12.7 tetap terbaca.
- Dokumentasi: charter dibuat di `03_EXECUTION/AUDIT-CHARTER.md`; log ini `03_EXECUTION/AUDIT-LOG.md`.

**Verifikasi**
- Test: `npm test` → **770/770 pass, 0 fail** (termasuk test struktural `test/dkas-planner.test.ts` yang memeriksa `href: "/dkas"` — tidak terpengaruh).
- Typecheck: `npx tsc --noEmit` → **0 error**.
- Lint: `npx eslint <4 file>` → **0 error**.
- Pemeriksaan tambahan: `git diff --stat src/` = 4 file / 7 baris; scan `git diff` untuk `api_key|password|secret|token` = **nol**; grep sisa "DKAS" UI-facing = nol (hanya komentar).
- Hasil: lulus. Kegagalan: tidak ada.

**Temuan yang menunggu persetujuan**
- B-02 (cron fail-open), B-03 (RBAC AI), B-04 (rate limit Redis), B-08 (endpoint metrik), B-09 (panel lintas-tenant) — lihat tabel backlog untuk alasan & rekomendasi.

**Rekomendasi siklus berikutnya (maks 3)**
1. B-06 — perbaiki label "Akses penuh platform" → "Akses penuh lembaga" (teks saja, sangat aman).
2. B-05 — dokumentasi baseline migrasi produksi di README + jalur `migrate resolve` (dokumentasi saja, tidak menjalankan migrasi).
3. Audit fungsional halaman `/finance` + `/attendance` (empty state, tombol mati) — inspeksi statis bila browser tidak dipakai.

**Catatan proses:** belum ada commit/push pada siklus ini (sesuai aturan baru).
