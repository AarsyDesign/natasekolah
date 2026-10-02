# PLAN Phase 11 — Pengerasan Rilis & Backlog Terblokir (Setelah Gate Phase 10 Lulus)

**Status:** Gate Phase 10 **LULUS 2026-10-02** → siklus "selesai → plan lagi" aktif
**PRD Referensi:** v5.0 (Bagian 75 urutan fase), MASTER_PRD.md butir tersisa
**Checkpoint Verifikasi Sebelumnya:** `tsc 0` · `npm test 624/624` · `build exit 0` · Phase 10 COMPLETE

---

## 1. Current State (Ringkas)

**Phase 0–10 COMPLETE.** NataSekolah memiliki:
- Multi-tenancy core + Sacred History Enrollment (Phase 0–1)
- Daily Operations (Presensi <60dtk, Offline Sync, Finance 3-Tier, Dashboard) (Phase 2)
- Communication Engine (WA Abstraction, Outbox, Template Wali) (Phase 3)
- Formal Academic Plugin (Assessment, Grade, Frozen Report Card) (Phase 4)
- Pesantren Living Plugin (Asrama, Permit Engine/Tasrih, Tahfidz/Shalat) (Phase 5)
- Parent Experience (PWA Portal, Transparansi Real-time) (Phase 6)
- AI & Automation (Question Bank 3-Tier PRIVATE, AI Generator Infra + Runtime + QA E2E) (Phase 7–8)
- Master Data Extended (Permit 9.1, Guardian CRUD 9.2, Student 5 Kluster 9.3) (Phase 9)
- **Exam Paper Engine (PRD #31): Fondasi data, UI `/exams/papers`, PDF/DOCX export, QR verifikasi anti-leak, QA E2E + Gate** (Phase 10)

**Test Suite:** 624/624 pass (182 suites) — unit, integration, cross-tenant, RBAC, plugin, AuditLog coverage.
**Build:** 26 routes (24 existing + `/verify/exam/[token]` dynamic).
**DB:** 7 migrasi applied, `migrate status` up to date, `migrate diff` nihil.

---

## 2. Scope Phase 11

Fokus: **Pengerasan rilis** (hardening) + **Backlog terblokir** yang butuh keputusan Arsyad.

### 2.1 Hardening & Polish (Actionable tanpa keputusan eksternal)

| Item | Deskripsi | Est. Effort |
|------|-----------|-------------|
| **11.1 Session Expiry UX** | `rethrowIfSessionExpired` sudah di 94 catch server action + 9 test. Butuh: UI toast/redirect halus saat session expired di tengah aksi (bukan 404/500 mentah). Halaman `/login?expired=1` + pesan ramah. | Kecil |
| **11.2 PDF/DOCX Layout Stress Test** | Teks panjang (esai > 500 char), gambar soal, layout 2 kolom edge case (page break di tengah soal). Tambah test integrasi visual (snapshot teks). | Sedang |
| **11.3 AI Generator: Provider API Key Wiring** | Infra siap (4 adapter). Butuh: dokumentasi setup `AI_PROVIDER` + `AI_API_KEY` + `AI_MODEL` di `.env.example` + `README.md`. Default `AI_GENERATION_ENABLED=false`. | Kecil |
| **11.4 Rate Limit Redis/DB (Optional)** | Saat ini in-memory (map). Produksi butuh Redis/DB supaya persist & multi-instance. Opsional — catat di ADR bila dibutuhkan. | Sedang |
| **11.5 DKAS Bot: Cohere Semantic Search (Optional)** | Fuse.js jalan 32k item. Cohere API gratis 1M/bln untuk semantic fallback bila query ambigu. Tidak blocking. | Kecil | ✅ **SELESAI 2026-10-02** — `CohereProvider` + `SemanticSearchService` + 15 test + env vars. |

### 2.2 Backlog Terblokir (Butuh Keputusan Arsyad — **JANGAN DIKERJAKAN** sampai ada keputusan)

| Item | Blokir | Keputusan Dibutuhkan |
|------|--------|---------------------|
| **Tier Question Bank `COMMUNITY` / `DEVELOPER_CENTRAL`** | Produk: moderasi lintas lembaga, skor kualitas, lisensi kontribusi, reward system. | Ya/ tidak lanjut + skema moderasi. |
| **CI Workflow `.github/workflows/ci.yml`** | Token GitHub OAuth scope `workflow` tidak ada. Device flow 422 dari host ini. | Arsyad authorize ulang atau push manual. |
| **Deploy Vercel Permanen** | Kuota project penuh. Butuh project baru + env Supabase (DB, Auth, Storage). | Setup project Vercel baru + kredensial Supabase. |
| **AI Generator Runtime: `AI_API_KEY` Nyata** | Saat ini mock/local. Butuh key provider (OpenAI/Anthropic/Gemini). | Pilih provider + masukkan key ke `.env` (bukan vault). |
| **Rate Limit Redis/DB (Produksi)** | In-memory map tidak persist cross-instance. | Ya/tidak + pilih Redis (Upstash/Vercel KV/self-hosted). |

---

## 3. Database Changes

**Tidak ada perubahan skema wajib** untuk hardening 11.1–11.4.
- Jika `COMMUNITY` tier diputuskan lanjut: migrasi baru untuk `QuestionSource`, `QuestionReview`, `ContributorProfile`.
- Jika rate-limit Redis: tidak butuh migrasi Prisma (eksternal store).

---

## 4. Files to Create / Modify

### Hardening (11.1–11.4)
- `src/app/login/page.tsx` — handle `?expired=1` query param (pesan toast).
- `src/lib/auth/action-session.ts` — pastikan `rethrowIfSessionExpired` melempar error yang bisa ditangkap UI.
- `src/components/toast-provider.tsx` / `use-toast.ts` — tambah variant `expired` bila belum ada.
- `README.md` — section "AI Generator Setup" (env vars, provider list, `AI_GENERATION_ENABLED`).
- `.env.example` — tambah `AI_PROVIDER=openai|anthropic|gemini|local`, `AI_API_KEY=`, `AI_MODEL=`, `AI_LOCAL_BASE_URL=`.
- `test/pdf-docx-layout-stress.test.ts` — integrasi teks panjang, gambar, page break.
- `02_DECISIONS/ADR-011-rate-limit-store.md` — keputusan in-memory vs Redis (opsional).

### Backlog Terblokir (HANYA jika keputusan sudah ada)
- `.github/workflows/ci.yml` — CI pipeline (lint, typecheck, test, build, prisma validate).
- `vercel.json` / project settings — deploy config.
- `prisma/migrations/*_community_tier.sql` — bila tier COMMUNITY disetujui.

---

## 5. Verification Plan

```bash
# Hardening gate
npx prisma migrate diff          # nihil (no schema change for 11.1-11.4)
npx tsc --noEmit                 # 0 error
npm test                         # >624 pass (tambah test stress layout)
npm run build                    # exit 0 (26 routes)

# QA E2E manual checklist
- [ ] Session expired di tengah aksi → toast + redirect /login?expired=1 (bukan error halaman)
- [ ] PDF esai 600+ char → tidak terpotong, page break rapi
- [ ] DOCX 2 kolom + gambar soal → render benar
- [ ] AI Generator: set AI_PROVIDER + AI_API_KEY → generate soal nyata jalan
- [ ] QR verifikasi token lama → not-found (rotasi QR tiap ekspor)
```

---

## 6. Risks & Mitigations

| Risiko | Mitigasi |
|--------|----------|
| **Session expiry UX melebar jadi refactor auth** | Scope ketat: hanya handle `SESSION_EXPIRED` di catch server action + UI toast. Jangan sentuh `session.ts`/`cookie.ts` inti. |
| **PDF/DOCX layout regression di edge case** | Tambah test integrasi `test/pdf-docx-layout-stress.test.ts` yang assert `%PDF` header, zip valid, teks kunci ada/tidak ada per mode. Jalankan di CI bila nanti aktif. |
| **Backlog terblokir "nge-drag" rencana** | Pisah jelas di TODO: section "Terkunci (butuh keputusan Arsyad)". Cron dev loop diinstruksikan **LEWATI** item ini. |
| **Deploy Vercel gagal kuota** | Documentasikan langkah setup project baru di `DEPLOYMENT.md` (referensi masa depan). |

---

## 7. Gate Keluar Phase 11

```text
tsc 0
npm test >624 (target >650 dengan test stress layout)
build exit 0
docs konsisten (TODO, PROGRESS, CHANGELOG, ROADMAP)
PLAN-PHASE-12 tertulis (atau laporan final jika backlog terblokir disetujui ditutup)
```

**Catatan:** Jika semua backlog terblokir mendapat keputusan "tidak lanjut" / "ditutup", Phase 11 bisa menjadi fase terakhir → **Laporan Final** dikirim, cron dihentikan.

---

## 8. Instruksi Cron (Otomatis)

Prompt cron `c728f53be2ee` (every 30m) sudah memuat:
> "Jika checklist fase aktif habis, cron wajib tulis `PLAN-PHASE-<N>.md` + update TODO/PROGRESS/CHANGELOG, commit & push, lalu lapor."

Setelah Phase 11 Gate lulus → **cron akan otomatis menulis `PLAN-PHASE-12.md`** (atau laporan final).