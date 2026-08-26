-- Campaign reach tracking + results fields

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "audienceCount" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "reachCount" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "freeReachApplied" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "paidReachCount" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "costCop" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "estimatedCostCop" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "successCount" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "successEvaluatedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "attributedSalesCop" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "roiRatio" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "CampaignReach" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignReach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignReach_campaignId_passId_key" ON "CampaignReach"("campaignId", "passId");
CREATE INDEX IF NOT EXISTS "CampaignReach_userId_sentAt_idx" ON "CampaignReach"("userId", "sentAt");
CREATE INDEX IF NOT EXISTS "CampaignReach_campaignId_idx" ON "CampaignReach"("campaignId");

DO $$ BEGIN
  ALTER TABLE "CampaignReach" ADD CONSTRAINT "CampaignReach_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
