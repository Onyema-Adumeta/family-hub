-- Levels from lifetime stars, photo-proof review, achievements, family goals.

-- AlterEnum
ALTER TYPE "ChoreStatus" ADD VALUE 'review';

-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "lifetimeStars" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGoal" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎯',
    "reward" TEXT,
    "targetStars" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reachedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Achievement_familyId_createdAt_idx" ON "Achievement"("familyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_memberId_kind_code_key" ON "Achievement"("memberId", "kind", "code");

-- CreateIndex
CREATE INDEX "FamilyGoal_familyId_archivedAt_idx" ON "FamilyGoal"("familyId", "archivedAt");

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGoal" ADD CONSTRAINT "FamilyGoal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: lifetime stars = current balance + stars already spent on rewards,
-- so nobody's level drops when this ships.
UPDATE "Member" m SET "lifetimeStars" = m."stars" + COALESCE((
  SELECT SUM(r."cost") FROM "Redemption" rd JOIN "Reward" r ON r."id" = rd."rewardId" WHERE rd."memberId" = m."id"
), 0);
