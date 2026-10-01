# NataSekolah — Sistem Informasi Pendidikan Islam Terpadu

> Platform manajemen sekolah/pondok pesantren modern dengan arsitektur multi-tenant, RBAC ketat, dan AI-powered question generator.

---

## ✨ Fitur Utama

| Modul | Deskripsi |
|-------|-----------|
| **Buku Induk & Academic Core** | Student Master, Academic Year, Classroom, Enrollment (Sacred History) |
| **Academic Teaching Core** | Subject, Teacher Identity, TeacherAssignment, Teaching Scope |
| **Daily Operations** | Presensi < 60 detik, Kasir SPP 3-Tier, Buku Kas, Dashboard |
| **Communication Engine** | WhatsApp Outbox Pattern (DeepLink/Fonnte/WAHA), Notification Queue |
| **Formal Academic** | Buku Nilai, Capaian Pembelajaran, Frozen Report Card Snapshot |
| **Pesantren Living** | Diniyah, Asrama, Tasrih Perizinan, Mutaba'ah Tahfidz |
| **Question Bank (3-Tier)** | PRIVATE_INSTITUTION, FOUNDATION_SHARED, GLOBAL_PUBLIC |
| **AI Generator** | Provider-agnostic (OpenAI/Anthropic/Gemini/Local), Fair-use enforcement (30/hari + 15s cooldown) |

---

## 🏗️ Arsitektur

```
src/
├── app/                    # Next.js App Router (RSC + Server Actions)
├── components/             # UI Components (shadcn/ui + custom)
├── lib/
│   ├── ai-generation/      # AI Generator: types, services, usage quota
│   ├── ai-providers/       # Provider adapters (OpenAI, Anthropic, Gemini, Local)
│   ├── auth/               # Session, cookie, RBAC
│   ├── plugins/            # Plugin registry (opt-in per institusi)
│   ├── validation/         # Zod schemas (domain + action level)
│   └── tenant/             # Multi-tenancy context & guards
├── actions/                # Server Actions (RBAC protected)
├── hooks/                  # React hooks
└── test/                   # Vitest suites (473+ tests)
```

**Stack:** Next.js 15 (Turbopack) · TypeScript · Prisma/PostgreSQL · Tailwind CSS · shadcn/ui · Vitest · Zod

---

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/AarsyDesign/natasekolah.git
cd natasekolah
npm install

# Environment
cp .env.example .env
# Edit .env: DATABASE_URL, NEXTAUTH_SECRET, AI_PROVIDER, AI_API_KEY, dll

# Database
npx prisma generate
npx prisma db push

# Dev server
npm run dev
```

**Akses:** `http://localhost:3000` → Login institusi → Pilih modul dari sidebar.

---

## ⚙️ Konfigurasi AI Generator

```env
# .env
AI_PROVIDER=openai          # openai | anthropic | gemini | local
AI_API_KEY=sk-...           # API key provider
AI_MODEL=gpt-4o-mini        # Model yang dipakai
AI_DAILY_QUOTA_PER_TEACHER=30
AI_COOLDOWN_MS=15000
AI_GENERATION_ENABLED=true  # Default: false
```

**Provider Local (Ollama/vLLM):**
```env
AI_PROVIDER=local
AI_API_KEY=ollama           # Dummy, tidak dipakai
AI_MODEL=llama3.1:8b
AI_LOCAL_BASE_URL=http://localhost:11434
```

---

## 🧪 Testing & Quality

```bash
# Type check
npx tsc --noEmit

# Unit/Integration tests
npm test

# Build production
npm run build

# Prisma validate
npx prisma validate
```

**Current:** `473/473 tests pass` · `tsc 0 error` · `build exit 0`

---

## 📦 Deployment

| Platform | Status |
|----------|--------|
| Vercel Preview | ❌ Kuota penuh (butuh project baru + env Supabase) |
| Cloudflare Tunnel | ✅ Active: `https://fighter-monsters-upgrades-tulsa.trycloudflare.com` |
| Local (PM2) | ✅ `npm run dev` background |

---

## 📚 Dokumentasi

- [`PROGRESS.md`](PROGRESS.md) — Progress phase-by-phase dengan metrics
- [`03_EXECUTION/TODO.md`](03_EXECUTION/TODO.md) — Backlog eksekusi detail
- [`04_DEVELOPMENT/CHANGELOG.md`](04_DEVELOPMENT/CHANGELOG.md) — Riwayat perubahan per commit
- [`03_EXECUTION/ROADMAP.md`](03_EXECUTION/ROADMAP.md) — Rencana jangka panjang
- [`DESIGN.md`](DESIGN.md) — Design tokens & UI spec

---

## 🤝 Kontribusi

1. Branch dari `feature/mizan-work`
2. Commit conventional: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
3. Push ke `origin/staging` (branch protection aktif)
4. PR → review → merge setelah hijau

---

## 📄 Lisensi

Proyek internal AarsyDesign. Tidak untuk distribusi publik.

---

## 🔗 Links

- **GitHub:** https://github.com/AarsyDesign/natasekolah
- **Preview Live:** https://fighter-monsters-upgrades-tulsa.trycloudflare.com
- **Author:** Arsyad (AarsyDesign)