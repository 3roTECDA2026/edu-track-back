-- Un alumno no puede asignarse dos veces al mismo período en la misma materia
CREATE UNIQUE INDEX "Intensification_enrollmentId_scheduleId_key" ON "Intensification"("enrollmentId", "scheduleId");