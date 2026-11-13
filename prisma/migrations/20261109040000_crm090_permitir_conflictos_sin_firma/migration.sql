-- CRM-090: permitir registrar conflictos antes de firmarlos.
-- La firma electrónica se incorpora posteriormente.

ALTER TABLE "LegalConflict"
ALTER COLUMN "digitalSignHash" DROP NOT NULL;
