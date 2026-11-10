-- 1. Columna singleton (siempre true)
ALTER TABLE "InstitutionalConfig"
  ADD COLUMN IF NOT EXISTS "singleton" BOOLEAN NOT NULL DEFAULT true;

-- 2. Si por el bug previo quedaron varias filas, conservar solo la mas reciente
DELETE FROM "InstitutionalConfig"
WHERE "id" NOT IN (
  SELECT "id" FROM "InstitutionalConfig" ORDER BY "createdAt" DESC LIMIT 1
);

-- 3. Indice unico sobre singleton: garantiza una sola fila
CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionalConfig_singleton_key"
  ON "InstitutionalConfig"("singleton");