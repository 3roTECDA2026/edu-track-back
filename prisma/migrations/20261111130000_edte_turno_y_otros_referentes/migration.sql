-- AlterEnum: otros referentes que designe la conducción (Disp. 40/26)
ALTER TYPE "EdteRole" ADD VALUE 'OTHER';

-- DropIndex: ahora la fila es única por usuario y turno
DROP INDEX "EdteTeamMember_userId_key";

-- DropIndex
DROP INDEX "EdteTeamMember_active_idx";

-- AlterTable: hay un EDTE por turno. Si ya había integrantes, quedan en el turno mañana
ALTER TABLE "EdteTeamMember" ADD COLUMN "shift" "Shift" NOT NULL DEFAULT 'MORNING';
ALTER TABLE "EdteTeamMember" ALTER COLUMN "shift" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "EdteTeamMember_userId_shift_key" ON "EdteTeamMember"("userId", "shift");

-- CreateIndex
CREATE INDEX "EdteTeamMember_shift_active_idx" ON "EdteTeamMember"("shift", "active");
