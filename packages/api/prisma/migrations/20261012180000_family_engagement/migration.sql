ALTER TABLE "Chore" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "pollQuestion" TEXT, ADD COLUMN "pollOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "MessageAcknowledgement" ("id" TEXT NOT NULL,"messageId" TEXT NOT NULL,"memberId" TEXT NOT NULL,"kind" TEXT NOT NULL, CONSTRAINT "MessageAcknowledgement_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MessageAcknowledgement_messageId_memberId_key" ON "MessageAcknowledgement"("messageId","memberId");
ALTER TABLE "MessageAcknowledgement" ADD CONSTRAINT "MessageAcknowledgement_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAcknowledgement" ADD CONSTRAINT "MessageAcknowledgement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "MessagePollVote" ("id" TEXT NOT NULL,"messageId" TEXT NOT NULL,"memberId" TEXT NOT NULL,"optionIndex" INTEGER NOT NULL,CONSTRAINT "MessagePollVote_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MessagePollVote_messageId_memberId_key" ON "MessagePollVote"("messageId","memberId");
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Member" ADD COLUMN "rewardGoalId" TEXT;
