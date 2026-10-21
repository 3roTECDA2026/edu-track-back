-- Agregar el rol PRECEPTOR al sistema NOTAR.
-- No modifica usuarios ni elimina registros.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRECEPTOR';
