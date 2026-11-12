-- CRM-044: los seis períodos de intensificación del ciclo (Res. 1650/24, Anexo 2).
-- DECEMBER sigue siendo diciembre 2 (después del cierre del 2.º cuatrimestre).
ALTER TYPE "IntensificationPeriod" ADD VALUE IF NOT EXISTS 'MARCH';
ALTER TYPE "IntensificationPeriod" ADD VALUE IF NOT EXISTS 'JULY';
ALTER TYPE "IntensificationPeriod" ADD VALUE IF NOT EXISTS 'DECEMBER_TERM_CLOSE';
