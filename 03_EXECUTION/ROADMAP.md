# Master Roadmap & Phase Gates - NataSekolah

Sesuai urutan pembangunan resmi PRD v5.0 (Bagian 75):

```text
PHASE 0 (Foundation & Security)
   │
   ▼ [ GATE 0 ]
PHASE 1 (Master Data Engine)
   │
   ▼ [ GATE 1 ]
PHASE 2 (Daily Operations)
   │
   ▼ [ GATE 2 ]
PHASE 3 (Communication Engine)
   │
   ▼ [ GATE 3 ]
┌──┴─────────────┐
▼                ▼
PHASE 4          PHASE 5
(Academic)       (Pesantren)
└──┬─────────────┘
   ▼ [ GATE 4 & 5 ]
PHASE 6 (Parent Experience)
   │
   ▼ [ GATE 6 ]
PHASE 7 (AI & Automation)
```

---

## Gerbang Pengembangan (Phase Gates)

### Phase 0 Gate — Foundation & Security
* [x] Visi Produk & Identitas Antarmuka (PRD 1.1)
* [x] Multi-Tenancy Core & Security Boundary
* [x] Skema Relasional Prisma v5.0 (Institution, User, AcademicYear, Classroom, Student, Enrollment, AuditLog)
* [x] Automated Cross-Tenant Access Tests (10/10 PASS)
* [ ] Session Authentication & Encryption
* [ ] RBAC & Permission Enforcement
* [ ] Plugin Registry Manifest Contract
* [ ] Phase 0 Gate Audit & Approval

### Phase 1 Gate — Master Data Engine
* [ ] Student Full Profile (5 Kluster Dapodik/EMIS)
* [ ] Guardian Master Data
* [ ] Staff & Teacher Assignment
* [ ] Sacred History Enrollment Engine
* [ ] Excel Importer & Auto-Sanitizer (Phone, Dates)
* [x] Bulk Promotion Workflow (Kenaikan Kelas Massal)

### Phase 2 Gate — Daily Operations
* [ ] Attendance Engine (< 60 detik)
* [ ] Offline Sync & Idempotency Key
* [ ] Finance 3-Tier Layer (FeeCategory, StudentCharge, PaymentTransaction)
* [ ] Cashbook & Unique Receipt Generator (`KW-...`)
* [ ] Operational Dashboard (Bukan sekadar statistik, fokus aksi pengguna)

### Phase 3 Gate — Communication Engine
* [ ] WhatsApp Provider Abstraction
* [ ] Outbox Notification Engine & Queue Retry
* [ ] Parent Notification Templates

### Phase 4 Gate — Formal Academic Plugin
* [ ] Assessment Ledger (Formatif & Sumatif)
* [ ] Capaian Pembelajaran & Otomatisasi Predikat
* [ ] Frozen Report Card Snapshot Engine

### Phase 5 Gate — Pesantren Living Plugin
* [ ] Asrama & Kamar Santri
* [ ] Tasrih / Permit Engine (Izin Pulang Santri)
* [ ] Mutaba'ah Tahfidz & Shalat Berjamaah

### Phase 6 Gate — Parent Experience
* [ ] Parent PWA Portal
* [ ] Transparansi Pembayaran & Rekap Kehadiran Real-time

### Phase 7 Gate — AI & Automation
* [x] Centralized Question Bank (3-Tier) — **PRIVATE_INSTITUTION tier** selesai (backend + UI + RBAC + tenant isolation + importer/exporter + audit). `COMMUNITY` & `DEVELOPER_CENTRAL` di-backlog terpisah.
* [x] AI Question Generator Infrastructure — Models (`AiGenerationUsage`, `AiGenerationJob`), Migrations, Services (usage quota, generation flow), Validation Schemas, Plugin Registry (`AI_GENERATION`), Fair-use Guard (30/hari + cooldown 15s). **TREK C INFRASTRUCTURE SELESAI** — tinggal pasang API key provider AI (OpenAI/Anthropic/Gemini/lokal).
* [ ] AI Question Generator Runtime — Provider adapter implementation, UI generate modal, teacher review workflow.

