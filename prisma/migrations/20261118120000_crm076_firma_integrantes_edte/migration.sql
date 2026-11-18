-- CRM-076: firma de cada integrante presente en el acta de la reunión del EDTE (E4-RF-04)

-- AlterTable EdteMember: cuándo firmó el acta
ALTER TABLE "EdteMember" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);