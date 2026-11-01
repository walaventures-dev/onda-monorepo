-- CreateEnum
DO $$ BEGIN CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "CampaignOrigin" AS ENUM ('MANUAL', 'RECOMMENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "CampaignObjective" AS ENUM ('REACTIVATE', 'SLOW_HOURS', 'NEW_REWARD', 'REVIEWS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "origin" "CampaignOrigin" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "objective" "CampaignObjective";
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "smsBody" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "walletBody" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "sendSms" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "sendWallet" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "audienceFilter" JSONB;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "promoSnapshot" JSONB;

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
