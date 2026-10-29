-- Fair rotation: chores that take turns between members.

-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "rotate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rotationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rotationIndex" INTEGER NOT NULL DEFAULT 0;

