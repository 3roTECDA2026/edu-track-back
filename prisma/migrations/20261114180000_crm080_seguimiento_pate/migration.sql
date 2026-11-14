-- CRM-080: seguimiento del PATE y evaluación final de cierre (E4-RF-07)

-- CreateEnum
CREATE TYPE "PateEvaluation" AS ENUM ('FAVORABLE', 'PARTIAL', 'UNFAVORABLE');

-- AlterTable Pate: evaluación final y cierre
ALTER TABLE "Pate"
  ADD COLUMN "finalEvaluation" "PateEvaluation",
  ADD COLUMN "finalObservations" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedById" TEXT;

-- AlterTable PateFollowUp: vincular a reunión EDTE, evaluación, observaciones y autor
ALTER TABLE "PateFollowUp"
  ADD COLUMN "edteMeetingId" TEXT,
  ADD COLUMN "observations" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Si existieran seguimientos sin reunión previa, asignar la reunión del PATE si la tuviera
UPDATE "PateFollowUp" f
SET "edteMeetingId" = p."edteMeetingId"
FROM "Pate" p
WHERE f."pateId" = p."id" AND f."edteMeetingId" IS NULL AND p."edteMeetingId" IS NOT NULL;

-- Convertir columna evaluation a Enum si tuviera valores previos
ALTER TABLE "PateFollowUp"
  ALTER COLUMN "evaluation" TYPE "PateEvaluation"
  USING (
    CASE UPPER(TRIM("evaluation"))
      WHEN 'FAVORABLE' THEN 'FAVORABLE'::"PateEvaluation"
      WHEN 'DESFAVORABLE' THEN 'UNFAVORABLE'::"PateEvaluation"
      WHEN 'UNFAVORABLE' THEN 'UNFAVORABLE'::"PateEvaluation"
      ELSE 'PARTIAL'::"PateEvaluation"
    END
  );

ALTER TABLE "PateFollowUp"
  ALTER COLUMN "evaluation" SET NOT NULL,
  ALTER COLUMN "edteMeetingId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PateFollowUp_edteMeetingId_idx" ON "PateFollowUp"("edteMeetingId");

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateFollowUp" ADD CONSTRAINT "PateFollowUp_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateFollowUp" ADD CONSTRAINT "PateFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
