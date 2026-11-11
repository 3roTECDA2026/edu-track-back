CREATE TABLE "EdteTeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInTeam" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EdteTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EdteTeamMember_userId_key" ON "EdteTeamMember"("userId");

ALTER TABLE "EdteTeamMember" ADD CONSTRAINT "EdteTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
