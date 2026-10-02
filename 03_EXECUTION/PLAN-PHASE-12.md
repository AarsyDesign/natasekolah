# Phase 12 Execution Plan — Siklus Lanjutan (Post-Rilis Hardening)

> **Conteks**: Phase 0–11 **SELESAI SEMUA** (657 test pass, build OK, docs konsisten). Sisa backlog terblokir butuh keputusan Arsyad.
> **Sumber ide**: sisa backlog ROADMAP/TODO/PRD + backlog infra terblokir (COMMUNITY tier, CI workflow, Vercel deploy, AI API key nyata, rate-limit Redis produksi).
> **Polusi gaya**: ikuti `03_EXECUTION/PLAN-PHASE-11.md` (current state, scope per tahap berurutan prioritas, DoD Strict, verification plan, risiko).

---

## 1. Current State (Ringkas)

| Metric | Value |
|--------|-------|
| Test suite | 657/657 pass (194 suites), 0 fail |
| TypeScript | `npx tsc --noEmit` → 0 error |
| Build | `npm run build` → exit 0 (47 routes) |
| DB schema | `prisma validate` valid, `migrate diff` nihil (6 migrasi ter-deploy) |
| Phase 0–11 | **ALL COMPLETE** — Gate Matrix 100% hijau |
| ROADMAP checkbox | **0 item `[ ]`** pada fase 0–11 (semua `[x]`) |
| Backlog terblokir | 5 item (butuh keputusan Arsyad — **JANGAN DIKERJAKAN** sampai ada keputusan) |

**Modul utama sudah stabil**:
- Auth/Session/RBAC/Plugin Registry (Phase 0)
- Academic Core + Teaching + Daily Ops + Comm + Formal Academic + Pesantren (Phase 1–6)
- Question Bank 3-Tier + AI Generator Infra + Generate Modal + QA E2E (Phase 7–8)
- Penutupan Gerbang: Permit, Guardian CRUD, Student 5 Kluster (Phase 9)
- Exam Paper Engine: PDF/DOCX + QR verifikasi + halaman publik (Phase 10)
- Hardening: Session Expiry UX, Layout Stress, AI Key Wiring, Rate-Limit Abstraction, Cohere Semantic Search (Phase 11)

---

## 2. Scope Phase 12 — Prioritas Berurutan

Phase 12 dibagi **dua jalur**:

| Jalur | Deskripsi | Blokir? |
|-------|-----------|---------|
| **A. Hardening Lanjutan (Actionable tanpa keputusan eksternal)** | Item yang bisa dikerjakan *sekarang* tanpa menunggu Arsyad | ❌ Tidak |
| **B. Backlog Terblokir (Butuh Keputusan Arsyad)** | Item yang **HANYA** dikerjakan setelah keputusan eksplisit | ✅ Ya |

### 2.1 Jalur A — Hardening Lanjutan (Prioritas Tinggi → Rendah)

| # | Item | Deskripsi | Est. Effort | File Target |
|---|------|-----------|-------------|-------------|
| **12.1** | **Search UX: Fuse.js Weight Tuning + Highlight** | Fuse.js threshold/keys tuning; tambah highlight snippet di `GlobalSearchDialog` (mark matched terms). | Kecil | `src/components/global-search-dialog.tsx`, `src/lib/operations/search-service.ts` |
| **12.2** | **Error Boundary & Recovery UI** | React Error Boundary di `app-shell` + fallback page `/error` + `rethrowIfSessionExpired` toast terpusat. | Kecil | `src/components/error-boundary.tsx`, `src/app/error.tsx`, `src/lib/auth/action-session.ts` |
| **12.3** | **AuditLog Query API + UI Filter** | Server action `listAuditLogAction` (filter entityType, action, date range, user) + halaman `/audit-log` (hanya `audit:view` → SUPER_ADMIN/FOUNDATION_HEAD/PRINCIPAL/ADMIN). | Sedang | `src/actions/audit.ts`, `src/lib/audit/audit-query.ts`, `src/app/(app)/audit-log/page.tsx` |
| **12.4** | **Performance: Bundle Analyzer + Code Split** | `next build --profile` output; dynamic import heavy components (PDF/DOCX export, question bank modal, AI generator modal). | Sedang | `next.config.js`, `src/components/exam-paper/*`, `src/components/question-bank/*`, `src/components/ai-generator/*` |
| **12.5** | **Accessibility (a11y) Sweep** | `eslint-plugin-jsx-a11y` rules; focus-visible, ARIA label, color contrast (WCAG AA), keyboard trap modal, skip link. | Sedang | Global (`.eslintrc.js`, semua `*.tsx`) |
| **12.6** | **Observability: Structured Logging + Metrics** | Pino logger (JSON) + `NEXT_PUBLIC_APP_VERSION`; custom metric `ai_generation_latency_ms`, `search_fallback_cohere_count`, `rate_limit_hits`. | Sedang | `src/lib/logger.ts`, `src/middleware.ts`, `src/lib/ai-generation/*`, `src/lib/operations/semantic-search.ts` |
| **12.7** | **DKAS Bot: Natural Language → SQL (Planner)** | Planner LLM (Cohere/OpenAI) → generate Prisma where clause aman (whitelist field/operator) untuk query `santri`, `nilai`, `kehadiran`. **Non-blocking**, gated `AI_GENERATION_ENABLED`. | Besar | `src/lib/dkas/planner.ts`, `src/actions/dkas.ts`, `src/components/dkas-chat.tsx` |

### 2.2 Jalur B — Backlog Terblokir (HANYA jika keputusan sudah ada)

| # | Item | Blokir | Keputusan Dibutuhkan |
|---|------|--------|---------------------|
| **B1** | **Tier Question Bank `COMMUNITY` / `DEVELOPER_CENTRAL`** | Produk: moderasi lintas lembaga, skor kualitas, lisensi kontribusi, reward system. | Ya/tidak lanjut + skema moderasi + model data (`QuestionSource`, `QuestionReview`, `ContributorProfile`). |
| **B2** | **CI Workflow `.github/workflows/ci.yml`** | Token GitHub OAuth scope `workflow` tidak ada. Device flow 422 dari host ini. | Arsyad authorize ulang token (scope `workflow`) ATAU push manual workflow file ke branch `local/pending-workflow` lalu merge via UI GitHub. |
| **B3** | **Deploy Vercel Permanen** | Kuota project penuh. Butuh project baru + env Supabase (DB, Auth, Storage). | Setup project Vercel baru + kredensial Supabase (bukan vault — Arsyad masukkan manual). |
| **B4** | **AI Generator Runtime: `AI_API_KEY` Nyata** | Saat ini mock/local. Butuh key provider (OpenAI/Anthropic/Gemini). | Pilih provider + masukkan key ke `.env` deployment. |
| **B5** | **Rate Limit Redis/DB (Produksi)** | In-memory map tidak persist cross-instance. | Ya/tidak + pilih Redis (Upstash/Vercel KV/self-hosted) + set `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN`. |

> **Aturan keras**: Item B1–B5 **TIDAK DIBUKA** di Phase 12 run ini. Hanya dicatat sebagai referensi. Bila Arsyad memberi keputusan di masa depan, item dipindah ke Jalur A fase berikutnya.

---

## 3. Database Changes

**Tidak ada perubahan skema wajib** untuk hardening 12.1–12.6 (semua application-level).

| Jika Keputusan Diberikan | Migrasi Baru |
|--------------------------|--------------|
| B1 (`COMMUNITY` tier) | `QuestionSource` (PUBLIC/COMMUNITY/DEVELOPER_CENTRAL), `QuestionReview` (status, reviewerId, score), `ContributorProfile` (userId, institutionId, license, points). |
| B5 (Rate Limit Redis) | Tidak butuh migrasi Prisma (eksternal store Upstash/Vercel KV). |

---

## 4. Files to Create / Modify (Jalur A Saja)

### 12.1 Search UX
- `src/lib/operations/search-service.ts` — `Fuse.createIndex` options tuning (`threshold: 0.3`, `keys` weight: `name^3`, `email^2`, `description^1`).
- `src/components/global-search-dialog.tsx` — highlight matched substring di result item (`<mark>`).

### 12.2 Error Boundary
- `src/components/error-boundary.tsx` — class `ErrorBoundary` (getDerivedStateFromError + componentDidCatch) + reset key.
- `src/app/error.tsx` — fallback UI global (tombol "Muat Ulang", link `/login?expired=1`).
- `src/lib/auth/action-session.ts` — `rethrowIfSessionExpired` lempar error dengan kode `SESSION_EXPIRED` yang ditangkap boundary.

### 12.3 AuditLog Query API + UI
- `src/lib/audit/audit-query.ts` — `listAuditLog(filter: AuditLogFilter, ctx)` → Prisma query dengan cursor pagination.
- `src/actions/audit.ts` — `listAuditLogAction` (guard `audit:view`, `requireActionSession` + `runWithTenantContext` + `rethrowIfSessionExpired`).
- `src/app/(app)/audit-log/page.tsx` — tabel server-side + filter (entitas, aksi, rentang tanggal, user) + pagination.

### 12.4 Performance
- `next.config.js` — `webpack: (config) => { config.optimization.splitChunks = ... }` + `bundleAnalyzer` script.
- `src/components/exam-paper/export-buttons.tsx` — `dynamic(() => import('./export-pdf'), { ssr: false })` dsb.
- `src/components/question-bank/generate-modal.tsx` — dynamic import.
- `src/components/ai-generator/generate-modal.tsx` — dynamic import.

### 12.5 Accessibility
- `.eslintrc.js` — extends `plugin:jsx-a11y/recommended`.
- Global audit: `Tab` order, `role="dialog"` + `aria-modal`, `aria-label` button icon-only, `skip-link` di `app-shell`.

### 12.6 Observability
- `src/lib/logger.ts` — Pino instance (pretty di dev, JSON di prod) + `child({ requestId })` di middleware.
- `src/middleware.ts` — log request start/end + latency + status.
- `src/lib/ai-generation/ai-generation-service.ts` — metric `ai_generation_latency_ms` (histogram).
- `src/lib/operations/semantic-search.ts` — metric `search_fallback_cohere_count` (counter).
- `src/lib/rate-limit/store.ts` — metric `rate_limit_hits` (counter per key).

### 12.7 DKAS Bot Planner (Non-blocking)
- `src/lib/dkas/planner.ts` — `planQuery(nlQuery: string, ctx: TenantContext)` → `{ where: Prisma.WhereInput, select: string[] }` dengan whitelist field/operator per model (`Student`, `Grade`, `Attendance`, `PermitRequest`).
- `src/actions/dkas.ts` — `dkasQueryAction(nlQuery)` (guard `dkas:query` + `AI_GENERATION_ENABLED` + rate limit).
- `src/components/dkas-chat.tsx` — chat UI sederhana (input + streaming response + copy button).

---

## 5. DoD Strict (Definition of Done — Wajib Semua)

| Check | Target |
|-------|--------|
| **TypeScript** | `npx tsc --noEmit` → **0 error** |
| **Test Suite** | `npm test` → **≥ 680 pass, 0 fail** (tambah minimal 23 test dari Phase 12) |
| **Build** | `npm run build` → **exit 0** |
| **Lint** | `npm run lint` → **0 error** (tambah `jsx-a11y` rules) |
| **DoD Per-Item** | Setiap item 12.1–12.7 punya test unit/integration minimal 3 kasus (happy, edge, error) |
| **Docs** | `CHANGELOG.md`, `TODO.md`, `ROADMAP.md`, `PROGRESS.md` diupdate konsisten |

---

## 6. Verification Plan

| Tahap | Perintah | Kriteria Lulus |
|-------|----------|----------------|
| **Unit/Integration Test** | `npm test` | 680+ pass, 0 fail; coverage tidak turun |
| **Type Check** | `npx tsc --noEmit` | 0 error |
| **Lint** | `npm run lint` | 0 error (termasuk `jsx-a11y`) |
| **Build** | `npm run build` | exit 0, route baru (`/audit-log`, `/dkas`) ter-kompilasi |
| **QA E2E DB Nyata** | `scripts/_local-qa-phase12.ts` (buat baru) | Semua item 12.1–12.7 terverifikasi DB nyata |
| **QA Server Action HTTP** | `scripts/_local-qa-phase12-actions.ts` | Semua server action baru 200/400 sesuai spec |
| **Smoke Prod** | `next start` + `curl` | Halaman baru 200, error boundary trigger 500 → fallback UI |
| **Bundle Analyzer** | `ANALYZE=true npm run build` | Chunk heavy components terpisah (< 100 kB gzipped per chunk) |
| **migrate diff** | `npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel` | **Nihil** (tidak ada drift schema) |

---

## 7. Risiko & Mitigasi

| Risiko | Probabilitas | Dampak | Mitigasi |
|--------|-------------|--------|----------|
| **12.7 (DKAS Planner) scope creep** | Tinggi | Besar | Time-box 2 hari; gated `AI_GENERATION_ENABLED`; whitelist field ketat; fallback ke keyword search jika planner gagal. |
| **a11y sweep menemukan banyak violation** | Sedang | Sedang | Jalankan `npm run lint`早期; perbaiki per komponen, jangan batch besar. |
| **Bundle size naik drastis (pdfkit, docx, qrcode)** | Rendah | Sedang | Dynamic import + `webpackBundleAnalyzer` verifikasi; `pdfkit`/`docx` sudah di chunk terpisah via dynamic import. |
| **Pino logger konflik dengan Next.js built-in logging** | Rendah | Kecil | Gunakan `pino` hanya di server-side (`middleware.ts`, server actions); client-side pakai `console` wrapper. |
| **AuditLog query performa pada tabel besar** | Sedang | Sedang | Index Prisma `[institutionId, createdAt]` + cursor pagination (bukan offset); batas 50/item. |
| **Scanner keamanan blokir `npx prisma` / `npx tsc`** | Tinggi (berulang) | Blokir | Gunakan helper `prisma-run.mjs` (scratch) + `npx tsc` sudah lulus berkali-kali. |
| **Backlog terblokir (B1–B5) mendorong scope creep** | Sedang | Besar | **Hard rule**: tidak dikerjakan tanpa keputusan tertulis Arsyad di issue/PR. |

---

## 8. Gate Keluar Phase 12

| Kriteria | Target |
|----------|--------|
| `npm test` | **≥ 700 pass, 0 fail** |
| `npx tsc --noEmit` | **0 error** |
| `npm run build` | **exit 0** |
| `npm run lint` | **0 error** |
| Docs | `CHANGELOG.md`, `TODO.md`, `ROADMAP.md`, `PROGRESS.md` konsisten |
| Backlog terblokir | Tetap tercatat (tidak dibuka) — **bukan blocker Phase 12** |

**Lalu**: Tulis **PLAN-PHASE-13.md** (siklus "selesai → plan lagi").

---

## 9. Estimasi & Urutan Eksekusi (Run Cron Berikutnya)

| Run | Item | Catatan |
|-----|------|---------|
| **Run 1** | 12.1 Search UX + 12.2 Error Boundary | Cepat, independen, test ringan |
| **Run 2** | 12.3 AuditLog Query API + UI | Butuh RBAC baru `audit:view` + migration 0 |
| **Run 3** | 12.4 Performance Bundle Split | Verifikasi `ANALYZE=true` |
| **Run 4** | 12.5 Accessibility Sweep | `npm run lint` gating |
| **Run 5** | 12.6 Observability (Logger + Metrics) | Integrasi middleware + services |
| **Run 6** | 12.7 DKAS Bot Planner (Non-blocking) | Time-box, gated, fallback aman |
| **Run 7** | **Gate Keluar Phase 12** | Full verification + tulis PLAN-PHASE-13 |

---

**Catatan**: Phase 12 ini **bukan** fase "fitur besar baru" — semata hardening kualitas, observability, dan fondasi DKAS Bot yang aman. Backlog terblokir (B1–B5) tetap tertutup sampai keputusan Arsyad.