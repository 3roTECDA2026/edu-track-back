-- CRM-090: proteger la integridad de las firmas electrónicas.

CREATE OR REPLACE FUNCTION prevent_conflict_signature_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'CRM-090: una firma electrónica registrada no puede modificarse ni eliminarse';
END;
$$;

CREATE TRIGGER protect_conflict_electronic_signatures
BEFORE UPDATE OR DELETE
ON "ConflictElectronicSignature"
FOR EACH ROW
EXECUTE FUNCTION prevent_conflict_signature_changes();
