-- Star ledger: one row per member per chore completion, so stars can never be awarded twice.

CREATE TABLE "ChoreCompletion" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "choreTitle" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChoreCompletion_familyId_completedAt_idx" ON "ChoreCompletion"("familyId", "completedAt");

CREATE INDEX "ChoreCompletion_choreId_completedAt_idx" ON "ChoreCompletion"("choreId", "completedAt");

ALTER TABLE "ChoreCompletion" ADD CONSTRAINT "ChoreCompletion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChoreCompletion" ADD CONSTRAINT "ChoreCompletion_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
