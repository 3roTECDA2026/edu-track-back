-- CRM-087: archivos de evidencia adjuntos a una intervención (E4-RF-12).
-- Solo crea una tabla nueva: no modifica datos existentes.

-- CreateTable
CREATE TABLE "InterventionAttachment" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterventionAttachment_storageKey_key" ON "InterventionAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "InterventionAttachment_interventionId_idx" ON "InterventionAttachment"("interventionId");

-- AddForeignKey
ALTER TABLE "InterventionAttachment" ADD CONSTRAINT "InterventionAttachment_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionAttachment" ADD CONSTRAINT "InterventionAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
