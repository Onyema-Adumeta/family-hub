-- AlterTable
ALTER TABLE "GroceryItem" ADD COLUMN     "listType" TEXT NOT NULL DEFAULT 'grocery',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal';
