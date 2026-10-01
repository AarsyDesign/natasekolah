-- PHASE 7 TREK C — AI QUESTION GENERATOR INFRASTRUCTURE
-- Created: 2026-10-01

-- AiGenerationUsage (Kuota Fair-Use per Guru per Hari)
CREATE TABLE "ai_generation_usage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generation_usage_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one record per institution/user/date
CREATE UNIQUE INDEX "ai_generation_usage_institutionId_userId_date_key"
    ON "ai_generation_usage" ("institutionId", "userId", "date");

-- Index for daily queries
CREATE INDEX "ai_generation_usage_institutionId_date_idx"
    ON "ai_generation_usage" ("institutionId", "date");

-- Foreign keys
ALTER TABLE "ai_generation_usage"
    ADD CONSTRAINT "ai_generation_usage_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_generation_usage"
    ADD CONSTRAINT "ai_generation_usage_userId_institutionId_fkey"
    FOREIGN KEY ("userId", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AiGenerationJob (Pekerjaan Generate: Draft → Review Guru → Save)
CREATE TABLE "ai_generation_jobs" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "resultJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),

    CONSTRAINT "ai_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on id + institutionId
CREATE UNIQUE INDEX "ai_generation_jobs_id_institutionId_key"
    ON "ai_generation_jobs" ("id", "institutionId");

-- Indexes
CREATE INDEX "ai_generation_jobs_institutionId_userId_status_idx"
    ON "ai_generation_jobs" ("institutionId", "userId", "status");

CREATE INDEX "ai_generation_jobs_institutionId_createdAt_idx"
    ON "ai_generation_jobs" ("institutionId", "createdAt");

-- Foreign keys
ALTER TABLE "ai_generation_jobs"
    ADD CONSTRAINT "ai_generation_jobs_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_generation_jobs"
    ADD CONSTRAINT "ai_generation_jobs_userId_institutionId_fkey"
    FOREIGN KEY ("userId", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_generation_jobs"
    ADD CONSTRAINT "ai_generation_jobs_subjectId_institutionId_fkey"
    FOREIGN KEY ("subjectId", "institutionId") REFERENCES "Subject"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
