-- CRM-092: permitir anexos de seguimiento sin firma digital.
-- No modifica actas, anexos existentes ni triggers de inmutabilidad.

ALTER TABLE "LegalConflictAttachment"
ALTER COLUMN "digitalSignHash" DROP NOT NULL;
