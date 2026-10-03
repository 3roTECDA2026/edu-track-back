CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Notification"
ADD COLUMN "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM';

UPDATE "Notification"
SET "severity" = CASE
  WHEN "type" = 'ABSENCES' THEN 'HIGH'::"AlertSeverity"
  WHEN "type" IN ('HEALTH', 'CONDUCT') THEN 'MEDIUM'::"AlertSeverity"
  ELSE 'LOW'::"AlertSeverity"
END;