-- Catch-up migration: brings the committed migrations in line with schema.prisma.
--
-- These tables and columns were previously added to the live database with
-- `prisma db push`, so they never had a migration. A brand-new database built
-- from migrations alone could not even register a family (Muse report, section 4).
--
-- Every statement is written to be safe on BOTH:
--   * a brand-new empty database (creates everything), and
--   * the existing production database (skips anything that already exists).

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'app';

ALTER TABLE "Family" ADD COLUMN IF NOT EXISTS "googleTokens" TEXT;

ALTER TABLE "Quest" ALTER COLUMN "emoji" SET DEFAULT '⚡';

ALTER TABLE "WishlistItem" ADD COLUMN IF NOT EXISTS "declineReason" TEXT,
ADD COLUMN IF NOT EXISTS "deferUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';

CREATE TABLE IF NOT EXISTS "GameScore" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Trip" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PackingItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ItineraryDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "notes" TEXT,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ItineraryActivity" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItineraryActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "_ChoreAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "_MealAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "_ActivityAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "GameScore_familyId_gameType_idx" ON "GameScore"("familyId", "gameType");

CREATE UNIQUE INDEX IF NOT EXISTS "_ChoreAssignees_AB_unique" ON "_ChoreAssignees"("A", "B");

CREATE INDEX IF NOT EXISTS "_ChoreAssignees_B_index" ON "_ChoreAssignees"("B");

CREATE UNIQUE INDEX IF NOT EXISTS "_MealAssignees_AB_unique" ON "_MealAssignees"("A", "B");

CREATE INDEX IF NOT EXISTS "_MealAssignees_B_index" ON "_MealAssignees"("B");

CREATE UNIQUE INDEX IF NOT EXISTS "_ActivityAssignees_AB_unique" ON "_ActivityAssignees"("A", "B");

CREATE INDEX IF NOT EXISTS "_ActivityAssignees_B_index" ON "_ActivityAssignees"("B");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameScore_familyId_fkey') THEN
    ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameScore_memberId_fkey') THEN
    ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trip_familyId_fkey') THEN
    ALTER TABLE "Trip" ADD CONSTRAINT "Trip_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trip_createdById_fkey') THEN
    ALTER TABLE "Trip" ADD CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackingItem_tripId_fkey') THEN
    ALTER TABLE "PackingItem" ADD CONSTRAINT "PackingItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackingItem_memberId_fkey') THEN
    ALTER TABLE "PackingItem" ADD CONSTRAINT "PackingItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItineraryDay_tripId_fkey') THEN
    ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ItineraryActivity_dayId_fkey') THEN
    ALTER TABLE "ItineraryActivity" ADD CONSTRAINT "ItineraryActivity_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ChoreAssignees_A_fkey') THEN
    ALTER TABLE "_ChoreAssignees" ADD CONSTRAINT "_ChoreAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ChoreAssignees_B_fkey') THEN
    ALTER TABLE "_ChoreAssignees" ADD CONSTRAINT "_ChoreAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_MealAssignees_A_fkey') THEN
    ALTER TABLE "_MealAssignees" ADD CONSTRAINT "_MealAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_MealAssignees_B_fkey') THEN
    ALTER TABLE "_MealAssignees" ADD CONSTRAINT "_MealAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ActivityAssignees_A_fkey') THEN
    ALTER TABLE "_ActivityAssignees" ADD CONSTRAINT "_ActivityAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "ItineraryActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ActivityAssignees_B_fkey') THEN
    ALTER TABLE "_ActivityAssignees" ADD CONSTRAINT "_ActivityAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
