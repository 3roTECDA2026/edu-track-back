-- CRM-090: Tabla de códigos normalizados de conflictos

CREATE TABLE "ConflictCode" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ConflictCode_pkey" PRIMARY KEY ("code")
);

-- Conservar los códigos que pudieran existir en conflictos anteriores.
-- Sus descripciones deberán revisarse antes de utilizar el catálogo.
INSERT INTO "ConflictCode" ("code", "description")
SELECT DISTINCT "conflictCode", 'Pendiente de normalización'
FROM "LegalConflict"
WHERE "conflictCode" IS NOT NULL;

-- Índice para búsquedas por código
CREATE INDEX "LegalConflict_conflictCode_idx"
ON "LegalConflict"("conflictCode");

-- Relación entre conflictos y códigos normalizados
ALTER TABLE "LegalConflict"
ADD CONSTRAINT "LegalConflict_conflictCode_fkey"
FOREIGN KEY ("conflictCode")
REFERENCES "ConflictCode"("code")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- CRM-090: Credenciales TOTP cifradas

CREATE TABLE "ConflictTotpCredential" (
    "userId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastUsedStep" BIGINT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "ConflictTotpCredential_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ConflictTotpCredential"
ADD CONSTRAINT "ConflictTotpCredential_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- CRM-090: Firmas electrónicas

CREATE TABLE "ConflictElectronicSignature" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictElectronicSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConflictElectronicSignature_conflictId_key"
ON "ConflictElectronicSignature"("conflictId");

CREATE INDEX "ConflictElectronicSignature_signerId_idx"
ON "ConflictElectronicSignature"("signerId");

ALTER TABLE "ConflictElectronicSignature"
ADD CONSTRAINT "ConflictElectronicSignature_conflictId_fkey"
FOREIGN KEY ("conflictId")
REFERENCES "LegalConflict"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ConflictElectronicSignature"
ADD CONSTRAINT "ConflictElectronicSignature_signerId_fkey"
FOREIGN KEY ("signerId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
