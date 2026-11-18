-- CRM-080: seguimiento del PATE y evaluación final de cierre (E4-RF-07)

-- CreateEnum (idempotente)
DO $$ BEGIN
  CREATE TYPE "PateEvaluation" AS ENUM ('FAVORABLE', 'PARTIAL', 'UNFAVORABLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Pate: evaluación final y cierre
ALTER TABLE "Pate"
  ADD COLUMN IF NOT EXISTS "finalEvaluation" "PateEvaluation",
  ADD COLUMN IF NOT EXISTS "finalObservations" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedById" TEXT;

-- AlterTable PateFollowUp: vincular a reunión EDTE, evaluación, observaciones y autor
ALTER TABLE "PateFollowUp"
  ADD COLUMN IF NOT EXISTS "edteMeetingId" TEXT,
  ADD COLUMN IF NOT EXISTS "observations" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Si existieran seguimientos sin reunión previa, asignar la reunión del PATE si la tuviera
UPDATE "PateFollowUp" f
SET "edteMeetingId" = p."edteMeetingId"
FROM "Pate" p
WHERE f."pateId" = p."id" AND f."edteMeetingId" IS NULL AND p."edteMeetingId" IS NOT NULL;

-- Si aún quedaran seguimientos huérfanos sin reunión ni PATE con reunión, eliminarlos
-- antes de aplicar la restricción NOT NULL para preservar la integridad de datos
DELETE FROM "PateFollowUp"
WHERE "edteMeetingId" IS NULL;

-- Convertir columna evaluation a Enum si tuviera valores previos
DO $$ BEGIN
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
EXCEPTION
  WHEN undefined_column THEN null;
END $$;

ALTER TABLE "PateFollowUp"
  ALTER COLUMN "evaluation" SET NOT NULL,
  ALTER COLUMN "edteMeetingId" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PateFollowUp_edteMeetingId_idx" ON "PateFollowUp"("edteMeetingId");

-- AddForeignKey (idempotentes)
DO $$ BEGIN
  ALTER TABLE "Pate" ADD CONSTRAINT "Pate_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PateFollowUp" ADD CONSTRAINT "PateFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PateFollowUp" ADD CONSTRAINT "PateFollowUp_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
