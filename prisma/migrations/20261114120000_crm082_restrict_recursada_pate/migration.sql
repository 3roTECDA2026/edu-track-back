-- Recursado de materias (CRM-082): la inscripción REPEAT que creó un PATE no se puede borrar
-- mientras el PATE la use. La FK de CRM-078 quedó con ON DELETE SET NULL: al borrar la inscripción,
-- el PATE se quedaba sin su recursada sin avisar. Pasa a RESTRICT (el servicio además lo controla
-- antes y responde 409 con un mensaje claro). No toca datos.

-- DropForeignKey
ALTER TABLE "PateSubjectRepeat" DROP CONSTRAINT IF EXISTS "PateSubjectRepeat_repeatEnrollmentId_fkey";

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_repeatEnrollmentId_fkey" FOREIGN KEY ("repeatEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
