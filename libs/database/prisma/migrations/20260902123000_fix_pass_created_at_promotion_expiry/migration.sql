-- Pass.createdAt: billing (monthlyNewCustomersUsed) y schema Prisma.
-- Promotion.expiryMode/endsAt: analytics promotion.findMany (SELECT completo).

ALTER TABLE "Pass" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Pass" SET "createdAt" = "cycleStartedAt" WHERE "cycleStartedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Pass_storeId_createdAt_idx" ON "Pass"("storeId", "createdAt");

DO $$ BEGIN
  CREATE TYPE "PromotionExpiryMode" AS ENUM ('TIME', 'QUANTITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "expiryMode" "PromotionExpiryMode" NOT NULL DEFAULT 'QUANTITY';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
