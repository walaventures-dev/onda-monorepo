CREATE TYPE "CampaignBillingKind" AS ENUM ('FREE', 'CREDIT');
CREATE TYPE "CampaignPurchaseSku" AS ENUM ('SINGLE', 'PACK', 'PACK_SUB');

ALTER TABLE "Store"
  ADD COLUMN "campaignCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "campaignPackSubscribed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Campaign"
  ADD COLUMN "billingKind" "CampaignBillingKind" NOT NULL DEFAULT 'FREE';

CREATE TABLE "CampaignPurchase" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "sku" "CampaignPurchaseSku" NOT NULL,
  "credits" INTEGER NOT NULL,
  "amountCop" INTEGER NOT NULL,
  "wompiReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignPurchase_wompiReference_key" ON "CampaignPurchase"("wompiReference");
CREATE INDEX "CampaignPurchase_storeId_createdAt_idx" ON "CampaignPurchase"("storeId", "createdAt");

ALTER TABLE "CampaignPurchase"
  ADD CONSTRAINT "CampaignPurchase_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
