-- CRM-078: modelo del PATE (E4-RF-06).
-- La reunión del EDTE queda opcional hasta que se puedan registrar reuniones (CRM-075).
-- Hoy no hay PATE cargados (no había endpoints), pero la migración convierte los datos si los
-- hubiera: los estados por nombre, el ciclo desde la reunión del EDTE y la MPAA desde la cursada
-- de origen. Una recursada vieja no tiene sección: si existiera alguna, la migración se detiene
-- al volver obligatoria la columna, para que se revise a mano.

-- AlterEnum: DRAFT / IN_PROGRESS / CLOSED
BEGIN;
CREATE TYPE "PateStatus_new" AS ENUM ('DRAFT', 'IN_PROGRESS', 'CLOSED');
ALTER TABLE "Pate" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Pate" ALTER COLUMN "status" TYPE "PateStatus_new" USING (
  CASE "status"::text
    WHEN 'FINISHED' THEN 'CLOSED'
    ELSE 'IN_PROGRESS'
  END::"PateStatus_new"
);
ALTER TYPE "PateStatus" RENAME TO "PateStatus_old";
ALTER TYPE "PateStatus_new" RENAME TO "PateStatus";
DROP TYPE "PateStatus_old";
ALTER TABLE "Pate" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable: ciclo (desde la reunión del EDTE), autoría y fecha de modificación
ALTER TABLE "Pate"
  ADD COLUMN "academicYearId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Pate" p SET "academicYearId" = m."academicYearId"
FROM "EdteMeeting" m WHERE m."id" = p."edteMeetingId";

ALTER TABLE "Pate" ALTER COLUMN "academicYearId" SET NOT NULL;

-- AlterTable: reunión del EDTE opcional
ALTER TABLE "Pate" ALTER COLUMN "edteMeetingId" DROP NOT NULL;
ALTER TABLE "Pate" DROP CONSTRAINT "Pate_edteMeetingId_fkey";
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_edteMeetingId_fkey" FOREIGN KEY ("edteMeetingId") REFERENCES "EdteMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: materias a intensificar → MPAA y sección (sin el texto libre "location")
ALTER TABLE "PateSubjectIntensify" DROP CONSTRAINT "PateSubjectIntensify_enrollmentId_fkey";
DROP INDEX "PateSubjectIntensify_pateId_enrollmentId_key";

ALTER TABLE "PateSubjectIntensify"
  ADD COLUMN "pendingSubjectId" TEXT,
  ADD COLUMN "targetClassSectionId" TEXT;

UPDATE "PateSubjectIntensify" i SET "pendingSubjectId" = ps."id"
FROM "PendingSubject" ps WHERE ps."originEnrollmentId" = i."enrollmentId";

ALTER TABLE "PateSubjectIntensify"
  ALTER COLUMN "pendingSubjectId" SET NOT NULL,
  DROP COLUMN "enrollmentId",
  DROP COLUMN "location";

-- AlterTable: materias a recursar → MPAA, sección donde recursa e inscripción creada (CRM-082)
ALTER TABLE "PateSubjectRepeat" DROP CONSTRAINT "PateSubjectRepeat_enrollmentId_fkey";
DROP INDEX "PateSubjectRepeat_pateId_enrollmentId_key";

ALTER TABLE "PateSubjectRepeat"
  ADD COLUMN "pendingSubjectId" TEXT,
  ADD COLUMN "classSectionId" TEXT,
  ADD COLUMN "repeatEnrollmentId" TEXT;

UPDATE "PateSubjectRepeat" r SET "pendingSubjectId" = ps."id"
FROM "PendingSubject" ps WHERE ps."originEnrollmentId" = r."enrollmentId";

ALTER TABLE "PateSubjectRepeat"
  ALTER COLUMN "pendingSubjectId" SET NOT NULL,
  ALTER COLUMN "classSectionId" SET NOT NULL,
  DROP COLUMN "enrollmentId",
  DROP COLUMN "location";

-- CreateIndex
CREATE UNIQUE INDEX "Pate_studentId_academicYearId_key" ON "Pate"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "PateSubjectIntensify_pateId_pendingSubjectId_key" ON "PateSubjectIntensify"("pateId", "pendingSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PateSubjectRepeat_repeatEnrollmentId_key" ON "PateSubjectRepeat"("repeatEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PateSubjectRepeat_pateId_pendingSubjectId_key" ON "PateSubjectRepeat"("pateId", "pendingSubjectId");

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pate" ADD CONSTRAINT "Pate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectIntensify" ADD CONSTRAINT "PateSubjectIntensify_pendingSubjectId_fkey" FOREIGN KEY ("pendingSubjectId") REFERENCES "PendingSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectIntensify" ADD CONSTRAINT "PateSubjectIntensify_targetClassSectionId_fkey" FOREIGN KEY ("targetClassSectionId") REFERENCES "ClassSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_pendingSubjectId_fkey" FOREIGN KEY ("pendingSubjectId") REFERENCES "PendingSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PateSubjectRepeat" ADD CONSTRAINT "PateSubjectRepeat_repeatEnrollmentId_fkey" FOREIGN KEY ("repeatEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
