-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN "classSectionId" TEXT;

-- CreateIndex
CREATE INDEX "Intervention_classSectionId_date_idx" ON "Intervention"("classSectionId", "date");

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
