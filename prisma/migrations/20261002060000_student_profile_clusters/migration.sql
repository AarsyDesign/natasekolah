-- CreateTable
CREATE TABLE "student_family_data" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fatherName" TEXT,
    "fatherNik" TEXT,
    "fatherPhone" TEXT,
    "fatherOccupation" TEXT,
    "motherName" TEXT,
    "motherNik" TEXT,
    "motherPhone" TEXT,
    "motherOccupation" TEXT,
    "parentAddress" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_family_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_health_data" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bloodType" TEXT,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "disabilityType" TEXT,
    "disabilityNotes" TEXT,
    "chronicIllness" TEXT,
    "allergies" TEXT,
    "lastCheckupAt" TIMESTAMP(3),
    "healthNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_health_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_registry_data" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "familyCardNo" TEXT,
    "birthCertificateNo" TEXT,
    "bpjsNumber" TEXT,
    "bpjsProvider" TEXT,
    "sktmNumber" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'WNI',
    "previousSchool" TEXT,
    "registryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_registry_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_family_data_institutionId_idx" ON "student_family_data"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_family_data_id_institutionId_key" ON "student_family_data"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_family_data_studentId_institutionId_key" ON "student_family_data"("studentId", "institutionId");

-- CreateIndex
CREATE INDEX "student_health_data_institutionId_idx" ON "student_health_data"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_health_data_id_institutionId_key" ON "student_health_data"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_health_data_studentId_institutionId_key" ON "student_health_data"("studentId", "institutionId");

-- CreateIndex
CREATE INDEX "student_registry_data_institutionId_idx" ON "student_registry_data"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_registry_data_id_institutionId_key" ON "student_registry_data"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_registry_data_studentId_institutionId_key" ON "student_registry_data"("studentId", "institutionId");

-- AddForeignKey
ALTER TABLE "student_family_data" ADD CONSTRAINT "student_family_data_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_family_data" ADD CONSTRAINT "student_family_data_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_health_data" ADD CONSTRAINT "student_health_data_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_health_data" ADD CONSTRAINT "student_health_data_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registry_data" ADD CONSTRAINT "student_registry_data_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registry_data" ADD CONSTRAINT "student_registry_data_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

