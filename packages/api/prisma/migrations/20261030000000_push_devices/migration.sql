-- Phones that receive push notifications (one row per device, many per member).
CREATE TABLE IF NOT EXISTS "PushDevice" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "tasks" BOOLEAN NOT NULL DEFAULT true,
    "rewards" BOOLEAN NOT NULL DEFAULT true,
    "chat" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX IF NOT EXISTS "PushDevice_memberId_idx" ON "PushDevice"("memberId");
DO $$ BEGIN
  ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Carry over phones saved the old way (one token on the member row).
INSERT INTO "PushDevice" ("id", "memberId", "token")
SELECT 'pd_' || md5(m."id" || m."pushToken"), m."id", m."pushToken"
FROM "Member" m
WHERE m."pushToken" IS NOT NULL AND m."pushToken" <> ''
ON CONFLICT ("token") DO NOTHING;
