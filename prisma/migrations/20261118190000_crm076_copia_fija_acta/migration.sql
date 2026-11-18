-- CRM-076: copia fija del acta de la reunión del EDTE al completarse las firmas (como el RITE)

-- AlterTable EdteMeeting: datos del acta firmada, para que no cambie aunque cambien los datos
ALTER TABLE "EdteMeeting" ADD COLUMN IF NOT EXISTS "minutesSnapshot" JSONB;