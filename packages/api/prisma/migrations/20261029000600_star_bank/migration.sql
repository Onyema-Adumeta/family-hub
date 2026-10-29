-- Screen-time and allowance bank (a ledger; no real money is held or moved).

-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "centsPerStar" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CAD',
ADD COLUMN     "screenMinutesPerStar" INTEGER;

-- CreateTable
CREATE TABLE "BankEntry" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bucket" TEXT,
    "amount" INTEGER NOT NULL,
    "stars" INTEGER,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankEntry_familyId_memberId_kind_idx" ON "BankEntry"("familyId", "memberId", "kind");

-- AddForeignKey
ALTER TABLE "BankEntry" ADD CONSTRAINT "BankEntry_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankEntry" ADD CONSTRAINT "BankEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

