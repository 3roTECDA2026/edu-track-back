-- CreateEnum
CREATE TYPE "EdteRole" AS ENUM ('TEACHER', 'PRECEPTOR', 'COUNSELOR', 'DIRECTIVE');

-- CreateTable
CREATE TABLE "EdteTeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "edteRole" "EdteRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdteTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdteTeamMember_userId_key" ON "EdteTeamMember"("userId");

-- CreateIndex
CREATE INDEX "EdteTeamMember_active_idx" ON "EdteTeamMember"("active");

-- AddForeignKey
ALTER TABLE "EdteTeamMember" ADD CONSTRAINT "EdteTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;