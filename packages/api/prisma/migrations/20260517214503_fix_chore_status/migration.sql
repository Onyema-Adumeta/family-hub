/*
  Warnings:

  - You are about to drop the column `done` on the `Chore` table. All the data in the column will be lost.
  - The `status` column on the `Chore` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ChoreStatus" AS ENUM ('pending', 'in_progress', 'done');

-- AlterTable
ALTER TABLE "Chore" DROP COLUMN "done",
DROP COLUMN "status",
ADD COLUMN     "status" "ChoreStatus" NOT NULL DEFAULT 'pending';
