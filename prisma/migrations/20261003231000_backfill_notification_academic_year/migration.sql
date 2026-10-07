UPDATE "Notification" AS notification
SET "academicYearId" = academic_year.id
FROM "AcademicYear" AS academic_year
WHERE notification."academicYearId" IS NULL
  AND EXTRACT(YEAR FROM notification."createdAt")::integer = academic_year.year;
