-- Recursado de materias (CRM-082): vínculo entre la inscripción REPEAT y la MPAA que se recursa.
-- Solo agrega una columna opcional: no toca datos existentes.
-- ON DELETE RESTRICT: una MPAA con recursados no se puede borrar, para no perder el historial.

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "repeatedPendingSubjectId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Enrollment_repeatedPendingSubjectId_idx" ON "Enrollment"("repeatedPendingSubjectId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_repeatedPendingSubjectId_fkey" FOREIGN KEY ("repeatedPendingSubjectId") REFERENCES "PendingSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
