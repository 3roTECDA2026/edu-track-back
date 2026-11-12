-- Nota final de la MPAA con decimales (CRM-082): si se acredita por recursado, toma la nota final
-- de la cursada, que puede tener decimales (7 y 8 → 7,5; ver crm052_nota_final_decimal).
-- Las notas ya guardadas (enteras) conservan su valor.

-- AlterTable
ALTER TABLE "PendingSubject" ALTER COLUMN "finalScore" SET DATA TYPE DOUBLE PRECISION;
