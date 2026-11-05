/*
  Warnings:

  - You are about to drop the column `targetClassSection` on the `Intensification` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PendingSubjectStatus" AS ENUM ('PENDING', 'ACCREDITED');

-- CreateEnum
CREATE TYPE "PromotionOutcome" AS ENUM ('PROMOTED', 'REFERRED_TO_EDTE');

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN     "term1IntensificationScore" INTEGER;

-- AlterTable
ALTER TABLE "InstitutionalConfig" ADD COLUMN     "district" TEXT,
ADD COLUMN     "institutionName" TEXT,
ADD COLUMN     "institutionNumber" TEXT;

-- AlterTable
ALTER TABLE "Intensification" DROP COLUMN "targetClassSection",
ADD COLUMN     "scheduleId" TEXT,
ADD COLUMN     "targetClassSectionId" TEXT,
ALTER COLUMN "pendingKnowledge" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PendingSubject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "originEnrollmentId" TEXT NOT NULL,
    "originAcademicYearId" TEXT NOT NULL,
    "status" "PendingSubjectStatus" NOT NULL DEFAULT 'PENDING',
    "initialPendingKnowledge" TEXT,
    "closingPendingKnowledge" TEXT,
    "finalScore" INTEGER,
    "accreditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensificationSchedule" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "period" "IntensificationPeriod" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntensificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntensificationScheduleSubject" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "IntensificationScheduleSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionDecision" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "pendingCount" INTEGER NOT NULL,
    "outcome" "PromotionOutcome" NOT NULL,
    "executedById" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PromotionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSubject_originEnrollmentId_key" ON "PendingSubject"("originEnrollmentId");

-- CreateIndex
CREATE INDEX "PendingSubject_studentId_status_idx" ON "PendingSubject"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntensificationSchedule_academicYearId_period_key" ON "IntensificationSchedule"("academicYearId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "IntensificationScheduleSubject_scheduleId_subjectId_key" ON "IntensificationScheduleSubject"("scheduleId", "subjectId");

-- CreateIndex
CREATE INDEX "PromotionDecision_academicYearId_outcome_idx" ON "PromotionDecision"("academicYearId", "outcome");

-- CreateIndex
CREATE INDEX "PromotionDecision_studentId_idx" ON "PromotionDecision"("studentId");

-- CreateIndex
CREATE INDEX "Intensification_scheduleId_idx" ON "Intensification"("scheduleId");

-- AddForeignKey
ALTER TABLE "Intensification" ADD CONSTRAINT "Intensification_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "IntensificationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intensification" ADD CONSTRAINT "Intensification_targetClassSectionId_fkey" FOREIGN KEY ("targetClassSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intensification" ADD CONSTRAINT "Intensification_responsibleTeacherId_fkey" FOREIGN KEY ("responsibleTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubject" ADD CONSTRAINT "PendingSubject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubject" ADD CONSTRAINT "PendingSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubject" ADD CONSTRAINT "PendingSubject_originEnrollmentId_fkey" FOREIGN KEY ("originEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubject" ADD CONSTRAINT "PendingSubject_originAcademicYearId_fkey" FOREIGN KEY ("originAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensificationSchedule" ADD CONSTRAINT "IntensificationSchedule_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensificationScheduleSubject" ADD CONSTRAINT "IntensificationScheduleSubject_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "IntensificationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensificationScheduleSubject" ADD CONSTRAINT "IntensificationScheduleSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntensificationScheduleSubject" ADD CONSTRAINT "IntensificationScheduleSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionDecision" ADD CONSTRAINT "PromotionDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionDecision" ADD CONSTRAINT "PromotionDecision_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionDecision" ADD CONSTRAINT "PromotionDecision_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;