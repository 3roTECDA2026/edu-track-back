-- CRM-060: evidencias adjuntas a los intentos de intensificación (E3-RF-09).
-- Solo crea una tabla nueva: no modifica datos existentes. Escrita para poder correrse de nuevo
-- sin error (IF NOT EXISTS y claves foráneas solo si faltan).

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntensificationAttachment" (
    "id" TEXT NOT NULL,
    "intensificationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "IntensificationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IntensificationAttachment_storageKey_key" ON "IntensificationAttachment"("storageKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntensificationAttachment_intensificationId_idx" ON "IntensificationAttachment"("intensificationId");

-- AddForeignKey: un intento con evidencias no se puede borrar (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntensificationAttachment_intensificationId_fkey') THEN
    ALTER TABLE "IntensificationAttachment" ADD CONSTRAINT "IntensificationAttachment_intensificationId_fkey" FOREIGN KEY ("intensificationId") REFERENCES "Intensification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntensificationAttachment_uploadedById_fkey') THEN
    ALTER TABLE "IntensificationAttachment" ADD CONSTRAINT "IntensificationAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IntensificationAttachment_deletedById_fkey') THEN
    ALTER TABLE "IntensificationAttachment" ADD CONSTRAINT "IntensificationAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
