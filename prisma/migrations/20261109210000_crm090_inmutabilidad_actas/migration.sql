-- CRM-090: inmutabilidad del acta original.
-- Los anexos corresponden a CRM-092.

BEGIN;

-- Permitir únicamente activar el bloqueo durante esta migración.
-- No se permite alterar otros campos ni desbloquear actas.
CREATE OR REPLACE FUNCTION prevent_signed_conflict_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."editLocked" = false
     AND NEW."editLocked" = true
     AND (to_jsonb(NEW) - 'editLocked') =
         (to_jsonb(OLD) - 'editLocked') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'CRM-090: el acta original es inmutable';
END;
$$;

UPDATE "LegalConflict"
SET "editLocked" = true
WHERE "editLocked" = false;

ALTER TABLE "LegalConflict"
ALTER COLUMN "editLocked" SET DEFAULT true;

-- Protección definitiva: prohibir cualquier UPDATE o DELETE.
CREATE OR REPLACE FUNCTION prevent_signed_conflict_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'CRM-090: el acta original es inmutable';
END;
$$;

COMMIT;
