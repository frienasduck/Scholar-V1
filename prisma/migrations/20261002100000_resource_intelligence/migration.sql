-- Additive only. Original uploads, quotas, auth and existing curriculum remain intact.
CREATE TABLE "StudyResource" (
 "id" TEXT NOT NULL, "identityKey" TEXT NOT NULL, "ownerUserId" TEXT, "ebookId" TEXT,
 "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
 "resourceType" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "canonicalUrl" TEXT, "publisher" TEXT NOT NULL,
 "author" TEXT, "language" TEXT NOT NULL DEFAULT 'en', "licenseType" TEXT NOT NULL DEFAULT 'PRIVATE_USER_UPLOAD',
 "licenseUrl" TEXT, "attributionText" TEXT NOT NULL, "canStoreCopy" BOOLEAN NOT NULL DEFAULT false,
 "canGenerateDerivatives" BOOLEAN NOT NULL DEFAULT false, "contentHash" TEXT, "state" TEXT NOT NULL DEFAULT 'DISCOVERED',
 "qualityStatus" TEXT NOT NULL DEFAULT 'user-provided', "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "sourceMetadata" JSONB NOT NULL DEFAULT '{}', "ingestionVersion" INTEGER NOT NULL DEFAULT 1, "lastCheckedAt" TIMESTAMP(3),
 "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StudyResource_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StudyResource_visibility_owner_check" CHECK (("visibility" = 'GLOBAL' AND "ownerUserId" IS NULL) OR ("visibility" = 'PRIVATE' AND "ownerUserId" IS NOT NULL))
);
CREATE TABLE "ResourceMapping" (
 "id" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "curriculumId" TEXT NOT NULL DEFAULT 'cbse', "grade" INTEGER NOT NULL,
 "subjectId" TEXT NOT NULL, "chapterId" TEXT NOT NULL DEFAULT '', "topicId" TEXT NOT NULL DEFAULT '', "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
 CONSTRAINT "ResourceMapping_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResourceChunk" (
 "id" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "heading" TEXT NOT NULL, "text" TEXT NOT NULL,
 "page" INTEGER, "timestamp" INTEGER, "sourceUrl" TEXT, CONSTRAINT "ResourceChunk_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResourceArtifact" (
 "id" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "type" TEXT NOT NULL, "sourceHash" TEXT NOT NULL,
 "content" JSONB NOT NULL, "references" JSONB NOT NULL, "generator" TEXT NOT NULL, "quality" TEXT NOT NULL DEFAULT 'source-derived',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ResourceArtifact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResourceJob" (
 "id" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'QUEUED', "stage" TEXT NOT NULL DEFAULT 'EXTRACTING',
 "attempts" INTEGER NOT NULL DEFAULT 0, "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "errorCode" TEXT,
 "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ResourceJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudyResource_identityKey_key" ON "StudyResource"("identityKey");
CREATE UNIQUE INDEX "StudyResource_ebookId_key" ON "StudyResource"("ebookId");
CREATE INDEX "StudyResource_ownerUserId_deletedAt_updatedAt_idx" ON "StudyResource"("ownerUserId", "deletedAt", "updatedAt");
CREATE INDEX "StudyResource_visibility_state_deletedAt_idx" ON "StudyResource"("visibility", "state", "deletedAt");
CREATE INDEX "StudyResource_contentHash_idx" ON "StudyResource"("contentHash");
CREATE UNIQUE INDEX "ResourceMapping_resourceId_curriculumId_grade_subjectId_cha_key" ON "ResourceMapping"("resourceId", "curriculumId", "grade", "subjectId", "chapterId", "topicId");
CREATE INDEX "ResourceMapping_curriculumId_grade_subjectId_chapterId_idx" ON "ResourceMapping"("curriculumId", "grade", "subjectId", "chapterId");
CREATE UNIQUE INDEX "ResourceChunk_resourceId_ordinal_key" ON "ResourceChunk"("resourceId", "ordinal");
CREATE UNIQUE INDEX "ResourceArtifact_resourceId_type_sourceHash_key" ON "ResourceArtifact"("resourceId", "type", "sourceHash");
CREATE UNIQUE INDEX "ResourceJob_resourceId_key" ON "ResourceJob"("resourceId");
CREATE INDEX "ResourceJob_state_nextRunAt_idx" ON "ResourceJob"("state", "nextRunAt");
ALTER TABLE "StudyResource" ADD CONSTRAINT "StudyResource_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyResource" ADD CONSTRAINT "StudyResource_ebookId_fkey" FOREIGN KEY ("ebookId") REFERENCES "CustomEbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceMapping" ADD CONSTRAINT "ResourceMapping_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudyResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceChunk" ADD CONSTRAINT "ResourceChunk_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudyResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceArtifact" ADD CONSTRAINT "ResourceArtifact_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudyResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceJob" ADD CONSTRAINT "ResourceJob_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudyResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Lightweight lexical indexes, no extension/vector service required.
CREATE INDEX "ResourceChunk_search_idx" ON "ResourceChunk" USING GIN (to_tsvector('simple', "text"));
CREATE INDEX "StudyResource_search_idx" ON "StudyResource" USING GIN (to_tsvector('simple', "title" || ' ' || "description"));
