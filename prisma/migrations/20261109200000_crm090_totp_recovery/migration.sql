-- CRM-090: Solicitudes de recuperación TOTP

CREATE TABLE "ConflictTotpRecovery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,

    CONSTRAINT "ConflictTotpRecovery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConflictTotpRecovery_userId_status_idx"
ON "ConflictTotpRecovery"("userId", "status");

ALTER TABLE "ConflictTotpRecovery"
ADD CONSTRAINT "ConflictTotpRecovery_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ConflictTotpRecovery"
ADD CONSTRAINT "ConflictTotpRecovery_approvedById_fkey"
FOREIGN KEY ("approvedById")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;


-- Una sola solicitud pendiente por usuario.
-- El índice parcial protege incluso frente a solicitudes simultáneas.
CREATE UNIQUE INDEX "ConflictTotpRecovery_one_pending_per_user"
ON "ConflictTotpRecovery"("userId")
WHERE "status" = 'PENDING';

-- Estados permitidos.
ALTER TABLE "ConflictTotpRecovery"
ADD CONSTRAINT "ConflictTotpRecovery_status_check"
CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));

-- Una solicitud aprobada debe identificar al autorizante y la fecha.
ALTER TABLE "ConflictTotpRecovery"
ADD CONSTRAINT "ConflictTotpRecovery_approval_check"
CHECK (
    ("status" = 'APPROVED' AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR
    ("status" <> 'APPROVED' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
);

-- Nadie puede aprobar su propia recuperación.
ALTER TABLE "ConflictTotpRecovery"
ADD CONSTRAINT "ConflictTotpRecovery_no_self_approval"
CHECK ("approvedById" IS NULL OR "approvedById" <> "userId");


-- CRM-090: Persistencia del bloqueo de autorizaciones

CREATE TABLE "ConflictTotpRecoveryAttempt" (
    "userId" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "ConflictTotpRecoveryAttempt_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "ConflictTotpRecoveryAttempt"
ADD CONSTRAINT "ConflictTotpRecoveryAttempt_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
