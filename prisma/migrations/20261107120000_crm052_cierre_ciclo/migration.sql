-- Cierre del ciclo lectivo (CRM-052): fecha del primer cierre y quién lo hizo.
-- Solo agrega columnas opcionales: no toca datos existentes.

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "closedById" TEXT;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
