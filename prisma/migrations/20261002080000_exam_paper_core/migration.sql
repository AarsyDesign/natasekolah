-- PHASE 10 — EXAM PAPER ENGINE (PRD #31)
-- Created: 2026-10-02 (migrasi manual, tanpa `migrate dev`; SQL dihasilkan migrate diff --from-url)
-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'DAILY',
    "instructions" TEXT,
    "showAnswers" BOOLEAN NOT NULL DEFAULT false,
    "columnLayout" TEXT NOT NULL DEFAULT 'ONE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "verifyToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_verifyToken_key" ON "exams"("verifyToken");

-- CreateIndex
CREATE INDEX "exams_institutionId_status_idx" ON "exams"("institutionId", "status");

-- CreateIndex
CREATE INDEX "exams_institutionId_subjectId_idx" ON "exams"("institutionId", "subjectId");

-- CreateIndex
CREATE INDEX "exams_institutionId_academicYearId_idx" ON "exams"("institutionId", "academicYearId");

-- CreateIndex
CREATE INDEX "exams_institutionId_createdAt_idx" ON "exams"("institutionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "exams_id_institutionId_key" ON "exams"("id", "institutionId");

-- CreateIndex
CREATE INDEX "exam_questions_institutionId_examId_idx" ON "exam_questions"("institutionId", "examId");

-- CreateIndex
CREATE INDEX "exam_questions_institutionId_questionId_idx" ON "exam_questions"("institutionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_id_institutionId_key" ON "exam_questions"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_examId_questionId_key" ON "exam_questions"("examId", "questionId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_subjectId_institutionId_fkey" FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdById_institutionId_fkey" FOREIGN KEY ("createdById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_institutionId_fkey" FOREIGN KEY ("examId", "institutionId") REFERENCES "exams"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionId_institutionId_fkey" FOREIGN KEY ("questionId", "institutionId") REFERENCES "questions"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
