/*
  Warnings:

  - You are about to drop the column `goal` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `progress` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Quest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Quest" DROP COLUMN "goal",
DROP COLUMN "progress",
DROP COLUMN "type",
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'easy',
ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "stages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "stars" INTEGER NOT NULL DEFAULT 10;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
