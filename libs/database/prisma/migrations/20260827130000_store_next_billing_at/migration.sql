-- AlterTable
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "nextBillingAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "referralBonusApplied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: new stores no longer get a free-month balance by default
ALTER TABLE "Store" ALTER COLUMN "freeMonthsBalance" SET DEFAULT 0;
