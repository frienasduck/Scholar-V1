CREATE TABLE "StudyMusicLibrary" (
    "userId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyMusicLibrary_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "StudyMusicLibrary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
