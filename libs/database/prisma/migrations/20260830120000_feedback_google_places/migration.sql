-- Feedback + Google Places (schema cambió en 69fcbb5 sin migración).
-- Sin estas columnas, POST /stores/with-subscription hace 500:
-- Prisma SELECT/RETURNING incluye googleRating* que no existen en prod.

-- CreateEnum
DO $$ BEGIN CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEGATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeedbackSource" AS ENUM ('POST_ACCUMULATE', 'MANUAL', 'CAMPAIGN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FeedbackFollowUpStatus" AS ENUM ('OPEN', 'CONTACTED', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GooglePlaceSnapshotSource" AS ENUM ('ONBOARDING', 'CRON'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable Store
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "googleRating" DOUBLE PRECISION;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "googleReviewCount" INTEGER;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "googleRatingUpdatedAt" TIMESTAMP(3);

-- AlterTable Pass
ALTER TABLE "Pass" ADD COLUMN IF NOT EXISTS "lastFeedbackSmsAt" TIMESTAMP(3);

-- Feedback: la tabla puede existir de un db:push previo.
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "redirectedToGoogle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "passId" TEXT;
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "sentiment" "FeedbackSentiment" NOT NULL DEFAULT 'POSITIVE';
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "dimensions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "source" "FeedbackSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "followUpStatus" "FeedbackFollowUpStatus" NOT NULL DEFAULT 'OPEN';

CREATE INDEX IF NOT EXISTS "Feedback_storeId_createdAt_idx" ON "Feedback"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Feedback_storeId_sentiment_idx" ON "Feedback"("storeId", "sentiment");
CREATE INDEX IF NOT EXISTS "Feedback_passId_idx" ON "Feedback"("passId");

DO $$ BEGIN
  ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable GooglePlaceSnapshot
CREATE TABLE IF NOT EXISTS "GooglePlaceSnapshot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "googlePlaceId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "GooglePlaceSnapshotSource" NOT NULL,
    CONSTRAINT "GooglePlaceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GooglePlaceSnapshot_storeId_fetchedAt_idx" ON "GooglePlaceSnapshot"("storeId", "fetchedAt");

DO $$ BEGIN
  ALTER TABLE "GooglePlaceSnapshot" ADD CONSTRAINT "GooglePlaceSnapshot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
