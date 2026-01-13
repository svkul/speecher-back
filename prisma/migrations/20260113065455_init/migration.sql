-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speech" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Speech_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeechBlock" (
    "id" TEXT NOT NULL,
    "speechId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeechBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE INDEX "User_userId_idx" ON "User"("userId");

-- CreateIndex
CREATE INDEX "Speech_userId_idx" ON "Speech"("userId");

-- CreateIndex
CREATE INDEX "SpeechBlock_speechId_idx" ON "SpeechBlock"("speechId");

-- CreateIndex
CREATE INDEX "SpeechBlock_speechId_order_idx" ON "SpeechBlock"("speechId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SpeechBlock_speechId_order_key" ON "SpeechBlock"("speechId", "order");

-- AddForeignKey
ALTER TABLE "Speech" ADD CONSTRAINT "Speech_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeechBlock" ADD CONSTRAINT "SpeechBlock_speechId_fkey" FOREIGN KEY ("speechId") REFERENCES "Speech"("id") ON DELETE CASCADE ON UPDATE CASCADE;
