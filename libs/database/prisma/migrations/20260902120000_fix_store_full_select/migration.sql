-- Catch-up idempotente: columnas de Store que Prisma incluye en SELECT completo
-- pero GET /stores omite vía storePublicSelect (sigue en 200).
-- Síntomas: 500 en GET /billing/store/:id y GET /analytics/store/:id/overview.

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "posEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "usageBalanceCop" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "campaignCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "campaignPackSubscribed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "wompiTransactionId" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "wompiPaymentSourceId" TEXT;

-- Reafirmar columnas del fix anterior por si prod quedó a medias.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "smsReachCount" INTEGER;

DO $$ BEGIN
  CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PosSale" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "passId" TEXT,
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ondasGranted" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTxId" TEXT,
    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosSale_tabId_key" ON "PosSale"("tabId");
CREATE INDEX IF NOT EXISTS "PosSale_storeId_completedAt_idx" ON "PosSale"("storeId", "completedAt");
CREATE INDEX IF NOT EXISTS "PosSale_passId_idx" ON "PosSale"("passId");

DO $$ BEGIN
  ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
