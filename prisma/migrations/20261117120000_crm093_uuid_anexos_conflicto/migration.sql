-- CRM-093: identificador único de cada anexo de un acta de conflicto (E4-RF-17).
--
-- Los anexos son inmutables (trigger de CRM-090): un UPDATE para completar las filas existentes
-- fallaría. Por eso la columna se agrega con NOT NULL y DEFAULT en la misma sentencia: Postgres
-- completa las filas existentes al reescribir la tabla, sin disparar los triggers de UPDATE.
ALTER TABLE "LegalConflictAttachment"
  ADD COLUMN IF NOT EXISTS "documentUuid" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX IF NOT EXISTS "LegalConflictAttachment_documentUuid_key"
  ON "LegalConflictAttachment"("documentUuid");
