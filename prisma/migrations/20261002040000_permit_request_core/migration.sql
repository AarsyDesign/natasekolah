-- PHASE 9 — TASRIH / PERMIT ENGINE (Izin Pulang Santri)
-- Created: 2026-10-02 (migrasi manual, tanpa `migrate dev`)

-- PermitRequest (Permohonan Izin Pulang Santri)
CREATE TABLE "permit_requests" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "leaveAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3),
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_requests_pkey" PRIMARY KEY ("id")
);

-- Unique compound id + institutionId
CREATE UNIQUE INDEX "permit_requests_id_institutionId_key" ON "permit_requests"("id", "institutionId");

-- Indexes
CREATE INDEX "permit_requests_institutionId_status_idx" ON "permit_requests"("institutionId", "status");
CREATE INDEX "permit_requests_institutionId_leaveAt_idx" ON "permit_requests"("institutionId", "leaveAt");
CREATE INDEX "permit_requests_institutionId_studentId_status_idx" ON "permit_requests"("institutionId", "studentId", "status");

-- Foreign keys
ALTER TABLE "permit_requests"
    ADD CONSTRAINT "permit_requests_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permit_requests"
    ADD CONSTRAINT "permit_requests_studentId_institutionId_fkey"
    FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permit_requests"
    ADD CONSTRAINT "permit_requests_academicYearId_institutionId_fkey"
    FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permit_requests"
    ADD CONSTRAINT "permit_requests_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
