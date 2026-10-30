-- Dias habiles de clase del ciclo lectivo (total y por cuatrimestre)
ALTER TABLE "AcademicYear" ADD COLUMN "term1SchoolDays" INTEGER,
ADD COLUMN "term2SchoolDays" INTEGER,
ADD COLUMN "totalSchoolDays" INTEGER;