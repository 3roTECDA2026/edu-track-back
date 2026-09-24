/*
  Warnings:

  - You are about to drop the column `absenceValue` on the `DailyAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `excused` on the `DailyAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `DailyAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `DailyAttendance` table. All the data in the column will be lost.
  - You are about to drop the column `shift` on the `DailyAttendance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,date,sectionId]` on the table `DailyAttendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `registeredById` to the `DailyAttendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `DailyAttendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `DailyAttendance` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceValue" AS ENUM ('PRESENT', 'ABSENT', 'HALF', 'QUARTER');

-- DropIndex
DROP INDEX "DailyAttendance_studentId_date_shift_key";

-- AlterTable
ALTER TABLE "DailyAttendance" DROP COLUMN "absenceValue",
DROP COLUMN "excused",
DROP COLUMN "notes",
DROP COLUMN "reason",
DROP COLUMN "shift",
ADD COLUMN     "justification" TEXT,
ADD COLUMN     "justified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registeredById" TEXT NOT NULL,
ADD COLUMN     "sectionId" TEXT NOT NULL,
ADD COLUMN     "value" "AttendanceValue" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_studentId_date_sectionId_key" ON "DailyAttendance"("studentId", "date", "sectionId");

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
