-- CRM-090: compatibilidad con anexos de seguimiento de CRM-092.
-- El acta original permanece inmutable.
-- Los anexos pueden incorporarse, pero no editarse ni eliminarse.

CREATE OR REPLACE FUNCTION prevent_signed_conflict_attachment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Los anexos de seguimiento no pueden modificarse ni eliminarse';
END;
$$;
