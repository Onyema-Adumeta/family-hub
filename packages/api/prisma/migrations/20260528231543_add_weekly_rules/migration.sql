-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyStreak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WeeklyRule" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minStars" INTEGER NOT NULL,
    "consequence" TEXT NOT NULL DEFAULT 'reduce_screen_time',
    "consequenceNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleOutcome" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "starsEarned" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleOutcome_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WeeklyRule" ADD CONSTRAINT "WeeklyRule_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRule" ADD CONSTRAINT "WeeklyRule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRule" ADD CONSTRAINT "WeeklyRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleOutcome" ADD CONSTRAINT "RuleOutcome_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WeeklyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleOutcome" ADD CONSTRAINT "RuleOutcome_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
