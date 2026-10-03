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
| B-06 | Label UI **"Akses penuh platform"** untuk `SUPER_ADMIN` — padahal role intra-tenant | UI/UX | `src/app/settings/users/page.tsx:555` | Salah paham cakupan kuasa admin lembaga | **VERIFIED** (Siklus 2) |
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
→ Dilaporkan: siklus 1 **di-commit oleh Arsyad** sebagai `33bb2a1` (bukan oleh cron).

---

## SIKLUS 2 — 2026-10-03 (interval +30 mnt)

- **Waktu:** 2026-10-03 · **Repository:** `/opt/data/work/natasekolah`
- **Branch:** `feature/mizan-work` ✓ · **Commit awal:** `33bb2a1` (siklus 1 sudah di-commit Arsyad)
- **Status working tree awal:** bersih kecuali `.project-monitor-state.json` + `next-env.d.ts` (artefak dev — tidak disentuh).

**Audit yang dilakukan**
- Area: Inspect (repo/branch/status) · UI/UX (label role di modal kelola peran) · verifikasi bukti SUPER_ADMIN bersifat intra-tenant.
- File/modul: `src/app/settings/users/page.tsx`, `prisma/schema.prisma:81`, `test/user-management.test.ts`, `test/seed-bootstrap.test.ts`.
- Temuan baru: tidak ada.
- Temuan lama terbuka: B-02 … B-05, B-07 … B-11 (B-06 dikerjakan siklus ini).

**Pekerjaan terpilih**
- Nama: **Ganti label UI "Akses penuh platform" → "Akses penuh lembaga"** (B-06).
- Kategori: UI/UX (teks saja).
- Alasan: sisa satu-satunya temuan `READY` yang bernilai langsung; bukti SUPER_ADMIN adalah role per-lembaga (seed bootstrap membuat 1 SUPER_ADMIN per lembaga; `user-management.test.ts` membatasi akses pada `ctx.instA`) sehingga kata "platform" menyesatkan.
- Dampak: admin memahami kuasanya terbatas pada lembaganya sendiri.
- Risiko: sangat rendah — 1 string literal, tidak ada test/logic yang memakai string itu (grep `test/` = 0).

**Implementasi**
- Status: **COMPLETED → VERIFIED**
- File berubah: `src/app/settings/users/page.tsx:555` (1 baris).
- Ringkasan: `{role === "SUPER_ADMIN" && "Akses penuh platform"}` → `"Akses penuh lembaga"`. Grep UI-wide `Akses penuh|penuh platform` tinggal 1 kecocokan (baris ini sudah diganti); `src/lib/plugins/registry.ts:31` memakai kata "platform" dalam komentar internal — dibiarkan.

**Verifikasi**
- Test: `npm test` → **770/770 pass, 0 fail**.
- Typecheck: `npm run typecheck` (`tsc --noEmit`) → **0 error**.
- Lint: `node node_modules/eslint/bin/eslint.js src/app/settings/users/page.tsx` → **0 error, 6 warning** (4× `no-unused-vars`, 2× `label-has-associated-control` — semuanya pre-existing, tercakup backlog B-07).
- Pemeriksaan tambahan: `git diff` hanya 1 baris untuk file ini; scan `git diff` untuk `api_key|password|secret|token` = **nol**; catatan: `npx eslint`/`npx tsc` **diblokir gateway** (scan ancaman paket tidak bisa selesai di cron) → verifikasi dijalankan via `npm run typecheck` & bin lokal `node_modules/eslint/bin/eslint.js` (hasil sah, tanpa fetching remote).
- Hasil: lulus. Kegagalan: tidak ada.

**Temuan yang menunggu persetujuan**
- B-02 (cron fail-open), B-03 (RBAC AI generation), B-04 (rate limit Redis), B-08 (endpoint metrik), B-09 (panel lintas-tenant) — tetap NEEDS_APPROVAL.

**Rekomendasi siklus berikutnya (maks 3)**
1. B-05 — dokumentasi strategi baseline migrasi produksi di README (tulisan saja; jangan menjalankan migrasi).
2. Audit fungsional statis halaman `/finance` & `/attendance`: empty state, tombol mati, alur error.
3. B-07 bertahap: perbaiki `label-has-associated-control` pada 1–2 halaman formulir (per file, jangan seluruh repo dalam satu siklus).

---

## SIKLUS 3 — 2026-10-03 ~06:25 UTC — BUG PRODUKSI /login (laporan manual oleh Mizan, di luar urutan cron)

**Temuan baru**
- **B-12 · BUG FIX**: halaman `/login` produksi menampilkan error boundary "Terjadi gangguan tak terduga".
  Akar: `useToast()` di `src/app/login/page.tsx:27` tapi `ToastProvider` hanya ada di
  `src/components/app-shell.tsx:117` — dan `AppShellWrapper` mengecualikan `/login`, `/`, `/wali` dari
  shell. Diperkenalkan bersamaan session-expiry UX (commit `8fd1f22`, Phase 11.1). Terbukti di produksi
  via CDP: `Error: useToast must be used within a ToastProvider`; terreproduksi juga lokal (dev).

**Implementasi**
- Status: **COMPLETED → VERIFIED**
- `src/app/layout.tsx` — `ToastProvider` kini membungkus `AppShellWrapper` di root layout (tersedia semua route).
- `src/components/app-shell.tsx` — import + pembungkus `<ToastProvider>` dihapus (hindari provider ganda).
- `test/toast-provider.test.ts` — 3 test regresi struktural (provider di layout, pengecualian shell tetap, shell tanpa provider ganda).

**Verifikasi**
- Test: **773/773 pass** (770 + 3 baru) · Typecheck `tsc --noEmit` → **0 error** · Lint 3 file → **0 error** · `npm run build` → **exit 0**.
- Pemeriksaan tambahan: browser QA E2E eksploratif `localhost:3000/login` → form login tampil penuh, **tanpa** boundary; grep `useToast must be used` di HTML = **0** (sebelum fix: ada).
- Risiko tersisa: ~~perbaikan BELUM aktif di produksi~~ → **DEPLOYED 2026-10-03 ~06:40 UTC**: commit `d003a2d` (fix) + `c8f5141` (docs/label) di-push ke `feature/mizan-work` **dan** `staging` → Vercel Git integration membangun otomatis. Verifikasi produksi via browser+CDP: `natasekolah.vercel.app/login` menampilkan form penuh, **0 console error**, boundary hilang; `/` dan `/wali/aktivasi` juga OK.
