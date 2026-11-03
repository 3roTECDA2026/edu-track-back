-- Asistencia en intensificación (CRM-059).
-- Se reutiliza SubjectAttendance: cada asistencia queda unida a la intensificación del alumno
-- y se guarda quién la cargó. No modifica ni borra registros existentes.

-- AlterTable
ALTER TABLE "SubjectAttendance" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "intensificationId" TEXT,
ADD COLUMN     "registeredById" TEXT;

-- CreateIndex
-- Una sola carga por intensificación y día
CREATE UNIQUE INDEX "SubjectAttendance_intensificationId_classDate_key" ON "SubjectAttendance"("intensificationId", "classDate");

-- AddForeignKey
-- RESTRICT: no se puede borrar una intensificación que tiene asistencias cargadas
ALTER TABLE "SubjectAttendance" ADD CONSTRAINT "SubjectAttendance_intensificationId_fkey" FOREIGN KEY ("intensificationId") REFERENCES "Intensification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAttendance" ADD CONSTRAINT "SubjectAttendance_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
