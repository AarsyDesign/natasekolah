-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "topic" TEXT,
    "stem" TEXT NOT NULL,
    "explanation" TEXT,
    "shortAnswerKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_institutionId_subjectId_idx" ON "questions"("institutionId", "subjectId");

-- CreateIndex
CREATE INDEX "questions_institutionId_status_idx" ON "questions"("institutionId", "status");

-- CreateIndex
CREATE INDEX "questions_institutionId_type_idx" ON "questions"("institutionId", "type");

-- CreateIndex
CREATE INDEX "questions_institutionId_createdById_idx" ON "questions"("institutionId", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "questions_id_institutionId_key" ON "questions"("id", "institutionId");

-- CreateIndex
CREATE INDEX "question_options_institutionId_questionId_idx" ON "question_options"("institutionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_id_institutionId_key" ON "question_options"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_label_key" ON "question_options"("questionId", "label");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_institutionId_fkey" FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_institutionId_fkey" FOREIGN KEY ("createdById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_institutionId_fkey" FOREIGN KEY ("questionId", "institutionId") REFERENCES "questions"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

