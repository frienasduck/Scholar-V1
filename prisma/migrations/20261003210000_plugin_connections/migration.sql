CREATE TABLE "PluginConnection" (
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "encryptedTokens" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "provider"),
  CONSTRAINT "PluginConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
