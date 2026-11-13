-- CreateEnum
CREATE TYPE "FortePlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "FortePlan" ADD COLUMN "responsibleId" TEXT,
ADD COLUMN "status" "FortePlanStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FortePlanReport" ADD COLUMN "authorId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "observations" TEXT;

-- CreateIndex
CREATE INDEX "FortePlan_status_idx" ON "FortePlan"("status");

-- CreateIndex
CREATE INDEX "FortePlanReport_fortePlanId_date_idx" ON "FortePlanReport"("fortePlanId", "date");

-- AddForeignKey
ALTER TABLE "FortePlan" ADD CONSTRAINT "FortePlan_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FortePlanReport" ADD CONSTRAINT "FortePlanReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;