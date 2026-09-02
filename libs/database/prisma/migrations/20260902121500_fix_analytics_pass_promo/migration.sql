-- PassPromoAssignment y tablas cartilla: requeridas por analytics/overview
-- (pass.findMany include promoAssignments). Idempotente.

DO $$ BEGIN CREATE TYPE "PromotionPool" AS ENUM ('BIENVENIDA', 'RETENCION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PromotionIntent" AS ENUM ('GANCHO', 'INTERMEDIA', 'PREMIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CartillaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Pass" ADD COLUMN IF NOT EXISTS "cartillaId" TEXT;

CREATE TABLE IF NOT EXISTS "Cartilla" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "CartillaStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxStamps" INTEGER NOT NULL DEFAULT 12,
    "smsRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cartilla_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PassPromoAssignment" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "cartillaId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "pointsRequired" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassPromoAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Cartilla_storeId_status_idx" ON "Cartilla"("storeId", "status");
CREATE INDEX IF NOT EXISTS "Pass_cartillaId_idx" ON "Pass"("cartillaId");
CREATE INDEX IF NOT EXISTS "PassPromoAssignment_promotionId_cartillaId_idx"
  ON "PassPromoAssignment"("promotionId", "cartillaId");
CREATE UNIQUE INDEX IF NOT EXISTS "PassPromoAssignment_passId_cartillaId_pointsRequired_key"
  ON "PassPromoAssignment"("passId", "cartillaId", "pointsRequired");

DO $$ BEGIN
  ALTER TABLE "Cartilla" ADD CONSTRAINT "Cartilla_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PassPromoAssignment" ADD CONSTRAINT "PassPromoAssignment_passId_fkey"
    FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PassPromoAssignment" ADD CONSTRAINT "PassPromoAssignment_cartillaId_fkey"
    FOREIGN KEY ("cartillaId") REFERENCES "Cartilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PassPromoAssignment" ADD CONSTRAINT "PassPromoAssignment_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Pass" ADD CONSTRAINT "Pass_cartillaId_fkey"
    FOREIGN KEY ("cartillaId") REFERENCES "Cartilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
