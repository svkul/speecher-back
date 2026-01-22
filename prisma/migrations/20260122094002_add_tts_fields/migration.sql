-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PREMIUM');

-- AlterTable
ALTER TABLE "SpeechBlock" ADD COLUMN     "charactersUsed" INTEGER,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "ttsLanguage" TEXT DEFAULT 'en-US',
ADD COLUMN     "ttsModel" TEXT DEFAULT 'Standard',
ADD COLUMN     "ttsStyle" TEXT,
ADD COLUMN     "ttsVoice" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "monthlyCharactersUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
