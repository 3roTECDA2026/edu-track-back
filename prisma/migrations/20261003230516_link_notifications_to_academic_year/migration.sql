-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "academicYearId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_academicYearId_createdAt_idx" ON "Notification"("academicYearId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
