ALTER TABLE "GroupStudyRoom"
  ADD COLUMN "navigationMode" TEXT NOT NULL DEFAULT 'follow',
  ADD COLUMN "activeFeature" TEXT NOT NULL DEFAULT 'overview',
  ADD COLUMN "activeContext" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "featurePolicy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "sessionPath" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "navigationRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cameraEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reactionsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "GroupStudyParticipant"
  ADD COLUMN "followHost" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "currentFeature" TEXT NOT NULL DEFAULT 'overview',
  ADD COLUMN "voiceJoined" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cameraActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voiceAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cameraAllowed" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "GroupStudySignal" (
  "id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroupStudySignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GroupStudySignal_targetId_createdAt_idx" ON "GroupStudySignal"("targetId", "createdAt");
CREATE INDEX "GroupStudySignal_expiresAt_idx" ON "GroupStudySignal"("expiresAt");
ALTER TABLE "GroupStudySignal" ADD CONSTRAINT "GroupStudySignal_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GroupStudyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupStudySignal" ADD CONSTRAINT "GroupStudySignal_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "GroupStudyParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupStudySignal" ADD CONSTRAINT "GroupStudySignal_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GroupStudyParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
