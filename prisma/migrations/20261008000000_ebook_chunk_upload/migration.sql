CREATE TABLE "EbookUpload" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "key" TEXT NOT NULL, "name" TEXT NOT NULL, "title" TEXT NOT NULL, "totalBytes" INTEGER NOT NULL,
 "receivedBytes" INTEGER NOT NULL DEFAULT 0, "bytes" BYTEA NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'uploading', "lastOffset" INTEGER NOT NULL DEFAULT -1,
 "lastDigest" TEXT NOT NULL DEFAULT '', "leaseUntil" TIMESTAMP(3), "result" JSONB, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "EbookUpload_size_check" CHECK ("totalBytes" BETWEEN 5 AND 20971520 AND "receivedBytes" BETWEEN 0 AND "totalBytes" AND octet_length("bytes") <= 20971520)
);
CREATE UNIQUE INDEX "EbookUpload_userId_key_key" ON "EbookUpload"("userId", "key");
CREATE INDEX "EbookUpload_expiresAt_idx" ON "EbookUpload"("expiresAt");
