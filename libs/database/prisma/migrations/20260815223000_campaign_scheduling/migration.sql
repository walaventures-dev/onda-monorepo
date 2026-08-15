-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignOrigin" AS ENUM ('MANUAL', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('REACTIVATE', 'SLOW_HOURS', 'NEW_REWARD', 'REVIEWS');

-- AlterTable
ALTER TABLE "Campaign"
  ADD COLUMN "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "origin" "CampaignOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "objective" "CampaignObjective",
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "smsBody" TEXT,
  ADD COLUMN "walletBody" TEXT,
  ADD COLUMN "sendSms" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sendWallet" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "audienceFilter" JSONB,
  ADD COLUMN "promoSnapshot" JSONB;

-- Existing rows already launched.
UPDATE "Campaign"
SET
  "status" = 'SENT',
  "scheduledAt" = "createdAt",
  "sentAt" = "createdAt",
  "smsBody" = CASE WHEN "channel" = 'SMS' THEN "title" ELSE NULL END,
  "walletBody" = CASE WHEN "channel" = 'WALLET' THEN "title" ELSE NULL END,
  "sendSms" = ("channel" = 'SMS'),
  "sendWallet" = ("channel" = 'WALLET');

CREATE INDEX IF NOT EXISTS "Campaign_storeId_status_scheduledAt_idx"
  ON "Campaign"("storeId", "status", "scheduledAt");
