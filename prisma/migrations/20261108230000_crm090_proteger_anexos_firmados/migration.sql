CREATE OR REPLACE FUNCTION prevent_signed_conflict_attachment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_id_to_check TEXT;
  conflict_is_locked BOOLEAN;
BEGIN
  -- Para UPDATE se revisan tanto el acta original
  -- como el acta de destino.
  FOR conflict_id_to_check IN
    SELECT DISTINCT id
    FROM (
      SELECT CASE
        WHEN TG_OP IN ('UPDATE', 'DELETE')
        THEN OLD."conflictId"
        ELSE NULL
      END AS id

      UNION ALL

      SELECT CASE
        WHEN TG_OP IN ('UPDATE', 'INSERT')
        THEN NEW."conflictId"
        ELSE NULL
      END AS id
    ) conflicts
    WHERE id IS NOT NULL
    ORDER BY id
  LOOP
    SELECT (
      c."editLocked"
      OR c."digitalSignHash" IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM "ConflictElectronicSignature" s
        WHERE s."conflictId" = c."id"
      )
    )
    INTO conflict_is_locked
    FROM "LegalConflict" c
    WHERE c."id" = conflict_id_to_check
    FOR UPDATE;

    IF conflict_is_locked THEN
      RAISE EXCEPTION
        'No se pueden modificar anexos de un acta firmada';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_signed_conflict_attachments
BEFORE INSERT OR UPDATE OR DELETE
ON "LegalConflictAttachment"
FOR EACH ROW
EXECUTE FUNCTION prevent_signed_conflict_attachment_changes();

-- Impedir modificaciones o eliminación de actas firmadas.

CREATE OR REPLACE FUNCTION prevent_signed_conflict_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."editLocked" OR OLD."digitalSignHash" IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM "ConflictElectronicSignature"
         WHERE "conflictId" = OLD."id"
       ) THEN
      RAISE EXCEPTION 'No se puede eliminar un acta firmada';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD."editLocked" OR OLD."digitalSignHash" IS NOT NULL
     OR EXISTS (
       SELECT 1
       FROM "ConflictElectronicSignature"
       WHERE "conflictId" = OLD."id"
     ) THEN
    RAISE EXCEPTION 'No se puede modificar un acta firmada';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_signed_conflicts
BEFORE UPDATE OR DELETE
ON "LegalConflict"
FOR EACH ROW
EXECUTE FUNCTION prevent_signed_conflict_changes();
