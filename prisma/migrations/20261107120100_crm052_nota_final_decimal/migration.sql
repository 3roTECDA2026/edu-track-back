-- Nota final con decimales (CRM-052, decisión 8): el promedio de los dos cuatrimestres
-- se guarda sin redondear (7 y 8 → 7,5), según la Res. 1650/24, Anexo 5, inc. 8.a.
-- Las notas ya guardadas (enteras) conservan su valor.

-- AlterTable
ALTER TABLE "Grade" ALTER COLUMN "finalScore" SET DATA TYPE DOUBLE PRECISION;
