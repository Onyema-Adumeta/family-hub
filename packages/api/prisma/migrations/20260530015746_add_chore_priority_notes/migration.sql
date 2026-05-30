-- AlterTable
ALTER TABLE "Chore" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal';
