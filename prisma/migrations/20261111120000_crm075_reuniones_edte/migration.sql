-- CRM-075: registro de reuniones del EDTE (E4-RF-03).
-- Conserva los datos si los hubiera: el período se convierte por nombre y "minutesSigned"
-- pasa al estado nuevo antes de borrarse.

-- CreateEnum
CREATE TYPE "EdteMeetingPeriod" AS ENUM ('FEBRUARY_MARCH', 'AUGUST', 'DECEMBER', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "EdteMeetingStatus" AS ENUM ('DRAFT', 'SIGNED');

-- AlterTable: período propio de las reuniones (los valores de antes tienen el mismo nombre)
ALTER TABLE "EdteMeeting"
  ALTER COLUMN "period" TYPE "EdteMeetingPeriod" USING ("period"::text::"EdteMeetingPeriod");

-- AlterTable: estado en lugar de "minutesSigned", turno, autoría y fechas
ALTER TABLE "EdteMeeting"
  ADD COLUMN "status" "EdteMeetingStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "shift" "Shift",
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "signedById" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EdteMeeting" SET "status" = 'SIGNED' WHERE "minutesSigned" = true;

ALTER TABLE "EdteMeeting" DROP COLUMN "minutesSigned";

-- CreateTable
CREATE TABLE "EdteMeetingStudent" (
    "id" TEXT NOT NULL,
    "edteMeetingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EdteMeetingStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdteMeeting_academicYearId_period_idx" ON "EdteMeeting"("academicYearId", "period");

-- CreateIndex
CREATE INDEX "EdteMeetingStudent_studentId_idx" ON "EdteMeetingStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "EdteMeetingStudent_edteMeetingId_studentId_key" ON "EdteMeetingStudent"("edteMeetingId", "studentId");

-- AddForeignKey
ALTER TABLE "EdteMeeting" ADD CONSTRAINT "EdteMeeting_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMeeting" ADD CONSTRAINT "EdteMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMeetingStudent" ADD CONSTRAINT "EdteMeetingStudent_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdteMeetingStudent" ADD CONSTRAINT "EdteMeetingStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
