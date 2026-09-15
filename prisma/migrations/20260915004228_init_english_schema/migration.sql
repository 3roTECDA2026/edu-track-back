-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'SCHOOL_MANAGEMENT', 'EOE_DIRECTIVE', 'TEACHER', 'STUDENT', 'FAMILY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFER_OUT', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'EXTRA_TIME');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('ORIENTED', 'TECHNICAL', 'AGRICULTURAL', 'ARTS');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('FIRST_TIME', 'REPEAT');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('IN_PROGRESS', 'APPROVED_ACCREDITED', 'PENDING_1ST_TERM', 'PENDING_2ND_TERM', 'IN_INTENSIFICATION', 'CONTINUES_INTENSIFYING', 'MPAA');

-- CreateEnum
CREATE TYPE "PreliminaryAssessment" AS ENUM ('TEA', 'TEP', 'TED');

-- CreateEnum
CREATE TYPE "Term" AS ENUM ('FIRST', 'SECOND');

-- CreateEnum
CREATE TYPE "IntensificationPeriod" AS ENUM ('DECEMBER', 'FEBRUARY_MARCH', 'AUGUST');

-- CreateEnum
CREATE TYPE "IntensificationModel" AS ENUM ('MODEL_1', 'MODEL_2', 'MODEL_3', 'MODEL_4');

-- CreateEnum
CREATE TYPE "IntensificationResultCode" AS ENUM ('AA', 'CCA', 'CSA');

-- CreateEnum
CREATE TYPE "RiteStatus" AS ENUM ('DRAFT', 'CLOSED', 'SIGNED');

-- CreateEnum
CREATE TYPE "InterventionEventType" AS ENUM ('PEDAGOGICAL', 'HEALTH', 'CONDUCT');

-- CreateEnum
CREATE TYPE "PateStatus" AS ENUM ('ACTIVE', 'UNDER_FOLLOW_UP', 'FINISHED');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "EquivalencyVerdict" AS ENUM ('FULL', 'PARTIAL', 'NOT_RECOGNIZED');

-- CreateEnum
CREATE TYPE "OrganizationalModel" AS ENUM ('OPTION_A', 'OPTION_B', 'OPTION_C', 'OPTION_D');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SENSITIVE_VIEW', 'SIGN', 'CLOSE', 'REOPEN');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ABSENCES', 'PENDING_SUBJECTS', 'TED_ASSESSMENT', 'DROPOUT_RISK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "term1StartDate" TIMESTAMP(3),
    "term1EndDate" TIMESTAMP(3),
    "term2StartDate" TIMESTAMP(3),
    "term2EndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarMilestone" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "CalendarMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSection" (
    "id" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "orientation" "Orientation",
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orientation" "Orientation" NOT NULL,
    "validFrom" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumSubject" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classSectionId" TEXT,
    "gradeLevel" INTEGER NOT NULL,

    CONSTRAINT "CurriculumSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "area" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubjectCourse" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSubjectCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "placeOfBirth" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "recordNumber" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasPPI" BOOLEAN NOT NULL DEFAULT false,
    "conditionalUntil" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "relationship" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "leaveReason" TEXT,

    CONSTRAINT "EnrollmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "courseType" "CourseType" NOT NULL DEFAULT 'FIRST_TIME',
    "academicYearId" TEXT NOT NULL,
    "subjectStatus" "SubjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "originalGradeLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "absenceValue" DOUBLE PRECISION NOT NULL,
    "shift" "Shift" NOT NULL,
    "excused" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectAttendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "classDate" DATE NOT NULL,
    "present" BOOLEAN NOT NULL,
    "excused" BOOLEAN NOT NULL DEFAULT false,
    "isIntensification" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubjectAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "preliminaryAssessment1" "PreliminaryAssessment",
    "rationale1" TEXT,
    "term1Score" INTEGER,
    "preliminaryAssessment2" "PreliminaryAssessment",
    "rationale2" TEXT,
    "term2Score" INTEGER,
    "recoveryIn2ndTerm" BOOLEAN,
    "finalScore" INTEGER,
    "subjectStatus" "SubjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "term1Closed" BOOLEAN NOT NULL DEFAULT false,
    "term2Closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intensification" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "period" "IntensificationPeriod" NOT NULL,
    "model" "IntensificationModel" NOT NULL,
    "targetClassSection" TEXT,
    "resultCode" "IntensificationResultCode",
    "score" INTEGER,
    "pendingKnowledge" TEXT NOT NULL,
    "knowledgeAtClose" TEXT,
    "responsibleTeacherId" TEXT,
    "evidenceUrl" TEXT,
    "evaluationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intensification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rite" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "isPostIntensification" BOOLEAN NOT NULL DEFAULT false,
    "generalNotes" TEXT,
    "status" "RiteStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signingAuthorityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdteMeeting" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "period" "IntensificationPeriod" NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "considerations" TEXT,
    "minutesUrl" TEXT,
    "minutesSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdteMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdteMember" (
    "id" TEXT NOT NULL,
    "edteMeetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInMeeting" TEXT,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "signatureHash" TEXT,

    CONSTRAINT "EdteMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "edteMeetingId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "supportStrategies" TEXT NOT NULL,
    "schedule" TEXT,
    "status" "PateStatus" NOT NULL DEFAULT 'ACTIVE',
    "notificationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateSubjectIntensify" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "model" "IntensificationModel" NOT NULL,
    "location" TEXT,

    CONSTRAINT "PateSubjectIntensify_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateSubjectRepeat" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "PateSubjectRepeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PateFollowUp" (
    "id" TEXT NOT NULL,
    "pateId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" TEXT NOT NULL,
    "evaluation" TEXT,

    CONSTRAINT "PateFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "eventType" "InterventionEventType" NOT NULL,
    "involvedActors" TEXT,
    "description" TEXT NOT NULL,
    "interventionProposal" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceUrl" TEXT,
    "digitalSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortePlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pedagogicalGoals" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FortePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FortePlanReport" (
    "id" TEXT NOT NULL,
    "fortePlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" TEXT NOT NULL,

    CONSTRAINT "FortePlanReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConflict" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "conflictCode" TEXT NOT NULL,
    "detailedReport" TEXT NOT NULL,
    "editLocked" BOOLEAN NOT NULL DEFAULT true,
    "digitalSignHash" TEXT NOT NULL,
    "documentUuid" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceDate" TIMESTAMP(3),

    CONSTRAINT "LegalConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConflictAttachment" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digitalSignHash" TEXT NOT NULL,

    CONSTRAINT "LegalConflictAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditActionType" NOT NULL,
    "affectedEntity" TEXT NOT NULL,
    "entityId" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readByFamily" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionReceipt" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "riteId" TEXT,
    "communicationType" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "reason" TEXT NOT NULL,
    "documentationUrl" TEXT,
    "familySignatureUrl" TEXT,
    "originDestinationSchool" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equivalency" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "originSubject" TEXT NOT NULL,
    "originSchool" TEXT NOT NULL,
    "originJurisdiction" TEXT,
    "originProgramUrl" TEXT,
    "certificationUrl" TEXT,
    "verdict" "EquivalencyVerdict",
    "internalResolutionUrl" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equivalency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diploma" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcriptUrl" TEXT,
    "diplomaUrl" TEXT,
    "digitalSignHash" TEXT,

    CONSTRAINT "Diploma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCommittee" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "members" TEXT NOT NULL,
    "minutesUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationCommittee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeSubject" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "topicsEvaluated" TEXT,
    "score" INTEGER,

    CONSTRAINT "CommitteeSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConductAgreement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUp" TEXT,

    CONSTRAINT "ConductAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalConfig" (
    "id" TEXT NOT NULL,
    "organizationalModel" "OrganizationalModel" NOT NULL,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minimumExpiryDate" TIMESTAMP(3) NOT NULL,
    "absenceLimitInstitutional" INTEGER NOT NULL DEFAULT 28,
    "subjectAttendancePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_year_key" ON "AcademicYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSection_grade_division_shift_academicYearId_key" ON "ClassSection"("grade", "division", "shift", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSubject_curriculumId_subjectId_key" ON "CurriculumSubject"("curriculumId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubjectCourse_teacherId_subjectId_classSectionId_key" ON "TeacherSubjectCourse"("teacherId", "subjectId", "classSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_dni_key" ON "Student"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Student_recordNumber_key" ON "Student"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- CreateIndex
CREATE INDEX "EnrollmentHistory_studentId_idx" ON "EnrollmentHistory"("studentId");

-- CreateIndex
CREATE INDEX "Enrollment_academicYearId_subjectStatus_idx" ON "Enrollment"("academicYearId", "subjectStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_subjectId_academicYearId_courseType_key" ON "Enrollment"("studentId", "subjectId", "academicYearId", "courseType");

-- CreateIndex
CREATE INDEX "DailyAttendance_studentId_date_idx" ON "DailyAttendance"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_studentId_date_shift_key" ON "DailyAttendance"("studentId", "date", "shift");

-- CreateIndex
CREATE INDEX "SubjectAttendance_studentId_subjectId_classDate_idx" ON "SubjectAttendance"("studentId", "subjectId", "classDate");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_enrollmentId_key" ON "Grade"("enrollmentId");

-- CreateIndex
CREATE INDEX "Grade_subjectStatus_idx" ON "Grade"("subjectStatus");

-- CreateIndex
CREATE INDEX "Intensification_enrollmentId_period_idx" ON "Intensification"("enrollmentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Rite_studentId_academicYearId_term_isPostIntensification_key" ON "Rite"("studentId", "academicYearId", "term", "isPostIntensification");

-- CreateIndex
CREATE UNIQUE INDEX "EdteMember_edteMeetingId_userId_key" ON "EdteMember"("edteMeetingId", "userId");

-- CreateIndex
CREATE INDEX "Pate_studentId_idx" ON "Pate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PateSubjectIntensify_pateId_enrollmentId_key" ON "PateSubjectIntensify"("pateId", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PateSubjectRepeat_pateId_enrollmentId_key" ON "PateSubjectRepeat"("pateId", "enrollmentId");

-- CreateIndex
CREATE INDEX "PateFollowUp_pateId_idx" ON "PateFollowUp"("pateId");

-- CreateIndex
CREATE INDEX "Intervention_studentId_date_idx" ON "Intervention"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FortePlan_studentId_key" ON "FortePlan"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalConflict_documentUuid_key" ON "LegalConflict"("documentUuid");

-- CreateIndex
CREATE INDEX "LegalConflict_studentId_idx" ON "LegalConflict"("studentId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_affectedEntity_entityId_idx" ON "AuditLog"("affectedEntity", "entityId");

-- CreateIndex
CREATE INDEX "Notification_studentId_read_idx" ON "Notification"("studentId", "read");

-- CreateIndex
CREATE INDEX "Message_studentId_createdAt_idx" ON "Message"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ReceptionReceipt_guardianId_idx" ON "ReceptionReceipt"("guardianId");

-- CreateIndex
CREATE INDEX "RecordDocument_studentId_type_idx" ON "RecordDocument"("studentId", "type");

-- CreateIndex
CREATE INDEX "InstitutionalTransfer_studentId_idx" ON "InstitutionalTransfer"("studentId");

-- CreateIndex
CREATE INDEX "Equivalency_studentId_idx" ON "Equivalency"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Diploma_studentId_key" ON "Diploma"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Diploma_registrationNumber_key" ON "Diploma"("registrationNumber");

-- CreateIndex
CREATE INDEX "Diploma_studentId_idx" ON "Diploma"("studentId");

-- CreateIndex
CREATE INDEX "EvaluationCommittee_studentId_idx" ON "EvaluationCommittee"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeSubject_committeeId_enrollmentId_key" ON "CommitteeSubject"("committeeId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ConductAgreement_studentId_idx" ON "ConductAgreement"("studentId");

-- AddForeignKey
ALTER TABLE "CalendarMilestone" ADD CONSTRAINT "CalendarMilestone_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSection" ADD CONSTRAINT "ClassSection_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectCourse" ADD CONSTRAINT "TeacherSubjectCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectCourse" ADD CONSTRAINT "TeacherSubjectCourse_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectCourse" ADD CONSTRAINT "TeacherSubjectCourse_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHistory" ADD CONSTRAINT "EnrollmentHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHistory" ADD CONSTRAINT "EnrollmentHistory_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAttendance" ADD CONSTRAINT "SubjectAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAttendance" ADD CONSTRAINT "SubjectAttendance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAttendance" ADD CONSTRAINT "SubjectAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intensification" ADD CONSTRAINT "Intensification_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rite" ADD CONSTRAINT "Rite_signingAuthorityId_fkey" FOREIGN KEY ("signingAuthorityId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMeeting" ADD CONSTRAINT "EdteMeeting_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMember" ADD CONSTRAINT "EdteMember_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMember" ADD CONSTRAINT "EdteMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectIntensify" ADD CONSTRAINT "PateSubjectIntensify_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectIntensify" ADD CONSTRAINT "PateSubjectIntensify_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateFollowUp" ADD CONSTRAINT "PateFollowUp_pateId_fkey" FOREIGN KEY ("pateId") REFERENCES "Pate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortePlan" ADD CONSTRAINT "FortePlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortePlanReport" ADD CONSTRAINT "FortePlanReport_fortePlanId_fkey" FOREIGN KEY ("fortePlanId") REFERENCES "FortePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConflict" ADD CONSTRAINT "LegalConflict_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConflict" ADD CONSTRAINT "LegalConflict_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConflictAttachment" ADD CONSTRAINT "LegalConflictAttachment_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "LegalConflict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionReceipt" ADD CONSTRAINT "ReceptionReceipt_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionReceipt" ADD CONSTRAINT "ReceptionReceipt_riteId_fkey" FOREIGN KEY ("riteId") REFERENCES "Rite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordDocument" ADD CONSTRAINT "RecordDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalTransfer" ADD CONSTRAINT "InstitutionalTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equivalency" ADD CONSTRAINT "Equivalency_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diploma" ADD CONSTRAINT "Diploma_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCommittee" ADD CONSTRAINT "EvaluationCommittee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeSubject" ADD CONSTRAINT "CommitteeSubject_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "EvaluationCommittee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeSubject" ADD CONSTRAINT "CommitteeSubject_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductAgreement" ADD CONSTRAINT "ConductAgreement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
