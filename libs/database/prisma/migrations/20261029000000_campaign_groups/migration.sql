ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
CREATE INDEX IF NOT EXISTS "Campaign_storeId_groupId_idx" ON "Campaign"("storeId", "groupId");
