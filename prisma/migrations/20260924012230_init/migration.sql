-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SEKOLAH',
    "enabledPlugins" TEXT NOT NULL DEFAULT '["FORMAL_ACADEMIC"]',
    "address" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "settingsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneWa" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '["STAFF"]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "nis" TEXT NOT NULL,
    "nisn" TEXT,
    "nik" TEXT,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'L',
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "religion" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parentWaPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detailsJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'INTERNAL_USER',
    "userId" TEXT,
    "guardianId" TEXT,
    "institutionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneWa" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_students" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_invitations" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "sentVia" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT,
    "dormitoryRoomId" TEXT,
    "context" TEXT NOT NULL DEFAULT 'ACADEMIC',
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "attendanceSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "recipient" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "providerId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_categories" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_charges" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "period" TEXT,
    "dueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "studentChargeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashbook_entries" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentTransactionId" TEXT,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_scores" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_cards" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "notes" TEXT,
    "frozenData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_card_subjects" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "letterGrade" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_card_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahfidz_records" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "surah" INTEGER NOT NULL,
    "surahName" TEXT,
    "startAyah" INTEGER NOT NULL,
    "endAyah" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tahfidz_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dormitories" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dormitories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dormitory_rooms" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "dormitoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dormitory_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_dormitory_assignments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_dormitory_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE INDEX "Institution_slug_idx" ON "Institution"("slug");

-- CreateIndex
CREATE INDEX "Institution_type_idx" ON "Institution"("type");

-- CreateIndex
CREATE INDEX "User_institutionId_isActive_idx" ON "User"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_institutionId_key" ON "User"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_institutionId_email_key" ON "User"("institutionId", "email");

-- CreateIndex
CREATE INDEX "AcademicYear_institutionId_isActive_idx" ON "AcademicYear"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_id_institutionId_key" ON "AcademicYear"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_institutionId_name_key" ON "AcademicYear"("institutionId", "name");

-- CreateIndex
CREATE INDEX "Classroom_institutionId_academicYearId_idx" ON "Classroom"("institutionId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_id_institutionId_key" ON "Classroom"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_id_academicYearId_institutionId_key" ON "Classroom"("id", "academicYearId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_institutionId_academicYearId_name_key" ON "Classroom"("institutionId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "Student_institutionId_status_idx" ON "Student"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Student_institutionId_fullName_idx" ON "Student"("institutionId", "fullName");

-- CreateIndex
CREATE INDEX "Student_institutionId_nisn_idx" ON "Student"("institutionId", "nisn");

-- CreateIndex
CREATE UNIQUE INDEX "Student_id_institutionId_key" ON "Student"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_institutionId_nis_key" ON "Student"("institutionId", "nis");

-- CreateIndex
CREATE INDEX "Enrollment_institutionId_academicYearId_classroomId_idx" ON "Enrollment"("institutionId", "academicYearId", "classroomId");

-- CreateIndex
CREATE INDEX "Enrollment_institutionId_status_idx" ON "Enrollment"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key" ON "Enrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_id_institutionId_key" ON "Enrollment"("id", "institutionId");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_createdAt_idx" ON "AuditLog"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_entityType_entityId_idx" ON "AuditLog"("institutionId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_tokenHash_idx" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_guardianId_idx" ON "sessions"("guardianId");

-- CreateIndex
CREATE INDEX "sessions_institutionId_idx" ON "sessions"("institutionId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "guardians_institutionId_phoneWa_idx" ON "guardians"("institutionId", "phoneWa");

-- CreateIndex
CREATE INDEX "guardians_institutionId_status_idx" ON "guardians"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_id_institutionId_key" ON "guardians"("id", "institutionId");

-- CreateIndex
CREATE INDEX "guardian_students_institutionId_studentId_idx" ON "guardian_students"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "guardian_students_institutionId_guardianId_idx" ON "guardian_students"("institutionId", "guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_students_guardianId_studentId_key" ON "guardian_students"("guardianId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_invitations_tokenHash_key" ON "guardian_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "guardian_invitations_tokenHash_idx" ON "guardian_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "guardian_invitations_guardianId_expiresAt_idx" ON "guardian_invitations"("guardianId", "expiresAt");

-- CreateIndex
CREATE INDEX "guardian_invitations_institutionId_idx" ON "guardian_invitations"("institutionId");

-- CreateIndex
CREATE INDEX "subjects_institutionId_isActive_idx" ON "subjects"("institutionId", "isActive");

-- CreateIndex
CREATE INDEX "subjects_institutionId_name_idx" ON "subjects"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_id_institutionId_key" ON "subjects"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_institutionId_code_key" ON "subjects"("institutionId", "code");

-- CreateIndex
CREATE INDEX "teacher_assignments_institutionId_academicYearId_classroomI_idx" ON "teacher_assignments"("institutionId", "academicYearId", "classroomId");

-- CreateIndex
CREATE INDEX "teacher_assignments_institutionId_teacherId_idx" ON "teacher_assignments"("institutionId", "teacherId");

-- CreateIndex
CREATE INDEX "teacher_assignments_institutionId_subjectId_idx" ON "teacher_assignments"("institutionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignments_id_institutionId_key" ON "teacher_assignments"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignments_teacherId_subjectId_classroomId_academi_key" ON "teacher_assignments"("teacherId", "subjectId", "classroomId", "academicYearId");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_attendanceDate_idx" ON "attendance_sessions"("institutionId", "attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_status_idx" ON "attendance_sessions"("institutionId", "status");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_context_idx" ON "attendance_sessions"("institutionId", "context");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_teacherAssignmentId_idx" ON "attendance_sessions"("institutionId", "teacherAssignmentId");

-- CreateIndex
CREATE INDEX "attendance_sessions_institutionId_dormitoryRoomId_idx" ON "attendance_sessions"("institutionId", "dormitoryRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_id_institutionId_key" ON "attendance_sessions"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_teacherAssignmentId_attendanceDate_key" ON "attendance_sessions"("teacherAssignmentId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_dormitoryRoomId_attendanceDate_key" ON "attendance_sessions"("dormitoryRoomId", "attendanceDate");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_attendanceSessionId_idx" ON "attendance_records"("institutionId", "attendanceSessionId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_studentId_idx" ON "attendance_records"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_enrollmentId_idx" ON "attendance_records"("institutionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "attendance_records_institutionId_status_idx" ON "attendance_records"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_id_institutionId_key" ON "attendance_records"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_attendanceSessionId_studentId_key" ON "attendance_records"("attendanceSessionId", "studentId");

-- CreateIndex
CREATE INDEX "notification_outbox_institutionId_status_idx" ON "notification_outbox"("institutionId", "status");

-- CreateIndex
CREATE INDEX "notification_outbox_institutionId_nextRetryAt_idx" ON "notification_outbox"("institutionId", "nextRetryAt");

-- CreateIndex
CREATE INDEX "notification_outbox_institutionId_recipient_idx" ON "notification_outbox"("institutionId", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_id_institutionId_key" ON "notification_outbox"("id", "institutionId");

-- CreateIndex
CREATE INDEX "fee_categories_institutionId_isActive_idx" ON "fee_categories"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fee_categories_id_institutionId_key" ON "fee_categories"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "fee_categories_institutionId_code_key" ON "fee_categories"("institutionId", "code");

-- CreateIndex
CREATE INDEX "student_charges_institutionId_studentId_idx" ON "student_charges"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "student_charges_institutionId_status_idx" ON "student_charges"("institutionId", "status");

-- CreateIndex
CREATE INDEX "student_charges_institutionId_period_idx" ON "student_charges"("institutionId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "student_charges_id_institutionId_key" ON "student_charges"("id", "institutionId");

-- CreateIndex
CREATE INDEX "payment_transactions_institutionId_studentId_idx" ON "payment_transactions"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "payment_transactions_institutionId_paymentDate_idx" ON "payment_transactions"("institutionId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_id_institutionId_key" ON "payment_transactions"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_institutionId_transactionNumber_key" ON "payment_transactions"("institutionId", "transactionNumber");

-- CreateIndex
CREATE INDEX "payment_allocations_institutionId_paymentTransactionId_idx" ON "payment_allocations"("institutionId", "paymentTransactionId");

-- CreateIndex
CREATE INDEX "payment_allocations_institutionId_studentChargeId_idx" ON "payment_allocations"("institutionId", "studentChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_id_institutionId_key" ON "payment_allocations"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_paymentTransactionId_key" ON "cashbook_entries"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "cashbook_entries_institutionId_entryDate_idx" ON "cashbook_entries"("institutionId", "entryDate");

-- CreateIndex
CREATE INDEX "cashbook_entries_institutionId_type_idx" ON "cashbook_entries"("institutionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_id_institutionId_key" ON "cashbook_entries"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_institutionId_entryNumber_key" ON "cashbook_entries"("institutionId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entries_paymentTransactionId_institutionId_key" ON "cashbook_entries"("paymentTransactionId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentTransactionId_key" ON "receipts"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "receipts_institutionId_issuedAt_idx" ON "receipts"("institutionId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_id_institutionId_key" ON "receipts"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_institutionId_receiptNumber_key" ON "receipts"("institutionId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentTransactionId_institutionId_key" ON "receipts"("paymentTransactionId", "institutionId");

-- CreateIndex
CREATE INDEX "assessments_institutionId_teacherAssignmentId_idx" ON "assessments"("institutionId", "teacherAssignmentId");

-- CreateIndex
CREATE INDEX "assessments_institutionId_type_idx" ON "assessments"("institutionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_id_institutionId_key" ON "assessments"("id", "institutionId");

-- CreateIndex
CREATE INDEX "assessment_scores_institutionId_assessmentId_idx" ON "assessment_scores"("institutionId", "assessmentId");

-- CreateIndex
CREATE INDEX "assessment_scores_institutionId_studentId_idx" ON "assessment_scores"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "assessment_scores_institutionId_enrollmentId_idx" ON "assessment_scores"("institutionId", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_scores_id_institutionId_key" ON "assessment_scores"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_scores_assessmentId_studentId_key" ON "assessment_scores"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "report_cards_institutionId_studentId_idx" ON "report_cards"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "report_cards_institutionId_academicYearId_classroomId_idx" ON "report_cards"("institutionId", "academicYearId", "classroomId");

-- CreateIndex
CREATE INDEX "report_cards_institutionId_status_idx" ON "report_cards"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "report_cards_id_institutionId_key" ON "report_cards"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "report_cards_enrollmentId_semester_key" ON "report_cards"("enrollmentId", "semester");

-- CreateIndex
CREATE INDEX "report_card_subjects_institutionId_reportCardId_idx" ON "report_card_subjects"("institutionId", "reportCardId");

-- CreateIndex
CREATE INDEX "report_card_subjects_institutionId_subjectId_idx" ON "report_card_subjects"("institutionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "report_card_subjects_id_institutionId_key" ON "report_card_subjects"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "report_card_subjects_reportCardId_subjectId_key" ON "report_card_subjects"("reportCardId", "subjectId");

-- CreateIndex
CREATE INDEX "tahfidz_records_institutionId_studentId_idx" ON "tahfidz_records"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "tahfidz_records_institutionId_enrollmentId_idx" ON "tahfidz_records"("institutionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "tahfidz_records_institutionId_date_idx" ON "tahfidz_records"("institutionId", "date");

-- CreateIndex
CREATE INDEX "tahfidz_records_institutionId_type_idx" ON "tahfidz_records"("institutionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "tahfidz_records_id_institutionId_key" ON "tahfidz_records"("id", "institutionId");

-- CreateIndex
CREATE INDEX "dormitories_institutionId_isActive_idx" ON "dormitories"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "dormitories_id_institutionId_key" ON "dormitories"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "dormitories_institutionId_name_key" ON "dormitories"("institutionId", "name");

-- CreateIndex
CREATE INDEX "dormitory_rooms_institutionId_dormitoryId_idx" ON "dormitory_rooms"("institutionId", "dormitoryId");

-- CreateIndex
CREATE INDEX "dormitory_rooms_institutionId_isActive_idx" ON "dormitory_rooms"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "dormitory_rooms_id_institutionId_key" ON "dormitory_rooms"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "dormitory_rooms_dormitoryId_name_key" ON "dormitory_rooms"("dormitoryId", "name");

-- CreateIndex
CREATE INDEX "student_dormitory_assignments_institutionId_studentId_statu_idx" ON "student_dormitory_assignments"("institutionId", "studentId", "status");

-- CreateIndex
CREATE INDEX "student_dormitory_assignments_institutionId_roomId_status_idx" ON "student_dormitory_assignments"("institutionId", "roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_dormitory_assignments_id_institutionId_key" ON "student_dormitory_assignments"("id", "institutionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classroomId_academicYearId_institutionId_fkey" FOREIGN KEY ("classroomId", "academicYearId", "institutionId") REFERENCES "Classroom"("id", "academicYearId", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_guardianId_institutionId_fkey" FOREIGN KEY ("guardianId", "institutionId") REFERENCES "guardians"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_invitations" ADD CONSTRAINT "guardian_invitations_guardianId_institutionId_fkey" FOREIGN KEY ("guardianId", "institutionId") REFERENCES "guardians"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_invitations" ADD CONSTRAINT "guardian_invitations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacherId_institutionId_fkey" FOREIGN KEY ("teacherId", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_subjectId_institutionId_fkey" FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_classroomId_academicYearId_institution_fkey" FOREIGN KEY ("classroomId", "academicYearId", "institutionId") REFERENCES "Classroom"("id", "academicYearId", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_teacherAssignmentId_institutionId_fkey" FOREIGN KEY ("teacherAssignmentId", "institutionId") REFERENCES "teacher_assignments"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_dormitoryRoomId_institutionId_fkey" FOREIGN KEY ("dormitoryRoomId", "institutionId") REFERENCES "dormitory_rooms"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendanceSessionId_institutionId_fkey" FOREIGN KEY ("attendanceSessionId", "institutionId") REFERENCES "attendance_sessions"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_enrollmentId_institutionId_fkey" FOREIGN KEY ("enrollmentId", "institutionId") REFERENCES "Enrollment"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_categories" ADD CONSTRAINT "fee_categories_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_feeCategoryId_institutionId_fkey" FOREIGN KEY ("feeCategoryId", "institutionId") REFERENCES "fee_categories"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_receivedById_institutionId_fkey" FOREIGN KEY ("receivedById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentTransactionId_institutionId_fkey" FOREIGN KEY ("paymentTransactionId", "institutionId") REFERENCES "payment_transactions"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_studentChargeId_institutionId_fkey" FOREIGN KEY ("studentChargeId", "institutionId") REFERENCES "student_charges"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_paymentTransactionId_institutionId_fkey" FOREIGN KEY ("paymentTransactionId", "institutionId") REFERENCES "payment_transactions"("id", "institutionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_createdById_institutionId_fkey" FOREIGN KEY ("createdById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentTransactionId_institutionId_fkey" FOREIGN KEY ("paymentTransactionId", "institutionId") REFERENCES "payment_transactions"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issuedById_institutionId_fkey" FOREIGN KEY ("issuedById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_teacherAssignmentId_institutionId_fkey" FOREIGN KEY ("teacherAssignmentId", "institutionId") REFERENCES "teacher_assignments"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessmentId_institutionId_fkey" FOREIGN KEY ("assessmentId", "institutionId") REFERENCES "assessments"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_enrollmentId_institutionId_fkey" FOREIGN KEY ("enrollmentId", "institutionId") REFERENCES "Enrollment"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_enrollmentId_institutionId_fkey" FOREIGN KEY ("enrollmentId", "institutionId") REFERENCES "Enrollment"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_classroomId_academicYearId_institutionId_fkey" FOREIGN KEY ("classroomId", "academicYearId", "institutionId") REFERENCES "Classroom"("id", "academicYearId", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_publishedById_institutionId_fkey" FOREIGN KEY ("publishedById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_subjects" ADD CONSTRAINT "report_card_subjects_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_subjects" ADD CONSTRAINT "report_card_subjects_reportCardId_institutionId_fkey" FOREIGN KEY ("reportCardId", "institutionId") REFERENCES "report_cards"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card_subjects" ADD CONSTRAINT "report_card_subjects_subjectId_institutionId_fkey" FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tahfidz_records" ADD CONSTRAINT "tahfidz_records_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tahfidz_records" ADD CONSTRAINT "tahfidz_records_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tahfidz_records" ADD CONSTRAINT "tahfidz_records_enrollmentId_institutionId_fkey" FOREIGN KEY ("enrollmentId", "institutionId") REFERENCES "Enrollment"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tahfidz_records" ADD CONSTRAINT "tahfidz_records_recordedBy_institutionId_fkey" FOREIGN KEY ("recordedBy", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dormitories" ADD CONSTRAINT "dormitories_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dormitory_rooms" ADD CONSTRAINT "dormitory_rooms_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dormitory_rooms" ADD CONSTRAINT "dormitory_rooms_dormitoryId_institutionId_fkey" FOREIGN KEY ("dormitoryId", "institutionId") REFERENCES "dormitories"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "Student"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_dormitory_assignments" ADD CONSTRAINT "student_dormitory_assignments_roomId_institutionId_fkey" FOREIGN KEY ("roomId", "institutionId") REFERENCES "dormitory_rooms"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;
