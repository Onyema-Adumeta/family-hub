CREATE TABLE "WebPushSubscription" (
 "id" TEXT NOT NULL, "memberId" TEXT NOT NULL, "endpoint" TEXT NOT NULL,
 "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "tasks" BOOLEAN NOT NULL DEFAULT true, "rewards" BOOLEAN NOT NULL DEFAULT true, "chat" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Member" ADD COLUMN "canOpenPersonalOS" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "canOpenPremed" BOOLEAN NOT NULL DEFAULT false;
