-- Catch-up idempotente: columnas/tablas que existían en schema.prisma vía db:push
-- pero nunca tuvieron migración. Sin esto, POST /stores/with-subscription falla en prod
-- (insertStore) y GET /stores devuelve 500.

-- Enums
DO $$ BEGIN CREATE TYPE "StoreSubcategory" AS ENUM (
  'CAFE', 'RESTAURANT_FULL', 'BAR', 'BAKERY', 'FAST_FOOD', 'FOOD_TRUCK', 'RETAIL',
  'BEAUTY', 'HEALTH', 'AUTO', 'EDUCATION', 'OTHER_SERVICE', 'HOTEL', 'HOSTEL',
  'VACATION_RENTAL', 'EVENT_VENUE'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "StoreSegment" AS ENUM (
  'CAFE_COFFEE', 'CAFE_SPECIALTY', 'CAFE_ROASTERY', 'REST_CASUAL', 'REST_FINE',
  'REST_TRADITIONAL', 'REST_SEAFOOD', 'BAR_PUB', 'BAR_BREWERY', 'BAR_COCKTAIL',
  'BAKERY_BREAD', 'BAKERY_PASTRY', 'BAKERY_DESSERT', 'FAST_BURGER', 'FAST_PIZZA',
  'FAST_CHICKEN', 'FAST_OTHER', 'TRUCK_FOOD', 'TRUCK_CART', 'RETAIL_FASHION',
  'RETAIL_BOUTIQUE', 'RETAIL_MARKET', 'RETAIL_OTHER', 'BEAUTY_HAIR', 'BEAUTY_BARBER',
  'BEAUTY_SALON', 'BEAUTY_SPA', 'BEAUTY_NAILS', 'BEAUTY_BROWS', 'HEALTH_CLINIC',
  'HEALTH_AESTHETIC', 'HEALTH_PHARMA', 'HEALTH_GYM', 'HEALTH_DENTAL', 'AUTO_SHOP',
  'AUTO_WASH', 'AUTO_TIRES', 'EDU_ACADEMY', 'EDU_LANGUAGE', 'EDU_TUTOR', 'OTHER_PETS',
  'OTHER_CLEANING', 'OTHER_GENERIC', 'HOTEL_STANDARD', 'HOTEL_BOUTIQUE', 'HOSTEL_STANDARD',
  'STAY_CABIN', 'STAY_GLAMPING', 'STAY_APARTMENT', 'VENUE_HALL', 'VENUE_TERRACE'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'SERVICE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "StoreCategory" ADD VALUE IF NOT EXISTS 'HOSPITALITY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "PromotionPool" AS ENUM ('BIENVENIDA', 'RETENCION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PromotionIntent" AS ENUM ('GANCHO', 'INTERMEDIA', 'PREMIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CartillaStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingInvoiceKind" AS ENUM ('PLAN', 'USAGE', 'COMBINED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'ZERO', 'FAILED', 'CARRIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Store: columnas de onboarding / billing / taxonomía
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "subcategory" "StoreSubcategory";
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "segment" "StoreSegment";
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "referredByStoreId" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "ondaValue" DOUBLE PRECISION;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "freeMonthsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "nextUsageBillingAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "usageBalanceCop" INTEGER NOT NULL DEFAULT 0;

UPDATE "Store"
SET "slug" = lower(regexp_replace(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE "slug" IS NULL OR trim("slug") = '';

UPDATE "Store" s
SET "slug" = left(s."slug", 40) || '-' || left(replace(s."id", '-', ''), 6)
WHERE EXISTS (
  SELECT 1 FROM "Store" s2
  WHERE s2."slug" = s."slug" AND s2."id" <> s."id"
);

UPDATE "Store"
SET "ownerName" = COALESCE(NULLIF(trim("ownerName"), ''), trim("name"), 'Encargado')
WHERE "ownerName" IS NULL OR trim("ownerName") = '';

UPDATE "Store"
SET "subcategory" = 'CAFE'::"StoreSubcategory"
WHERE "subcategory" IS NULL;

UPDATE "Store"
SET "referralCode" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE "referralCode" IS NULL OR trim("referralCode") = '';

UPDATE "Store" s
SET "referralCode" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE EXISTS (
  SELECT 1 FROM "Store" s2
  WHERE s2."referralCode" = s."referralCode" AND s2."id" <> s."id"
);

ALTER TABLE "Store" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "ownerName" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "subcategory" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Store_slug_key" ON "Store"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Store_referralCode_key" ON "Store"("referralCode");

DO $$ BEGIN
  ALTER TABLE "Store" ADD CONSTRAINT "Store_referredByStoreId_fkey"
    FOREIGN KEY ("referredByStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Promotion: cartilla / pool
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "pool" "PromotionPool" NOT NULL DEFAULT 'RETENCION';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "intent" "PromotionIntent" NOT NULL DEFAULT 'INTERMEDIA';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "duplicatedFromId" TEXT;

CREATE INDEX IF NOT EXISTS "Promotion_storeId_pool_idx" ON "Promotion"("storeId", "pool");

-- Pass / Transaction / PassDesign: cartilla
ALTER TABLE "Pass" ADD COLUMN IF NOT EXISTS "cartillaId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "cartillaId" TEXT;
ALTER TABLE "PassDesign" ADD COLUMN IF NOT EXISTS "cartillaId" TEXT;

CREATE INDEX IF NOT EXISTS "Pass_cartillaId_idx" ON "Pass"("cartillaId");
CREATE INDEX IF NOT EXISTS "Transaction_cartillaId_idx" ON "Transaction"("cartillaId");
CREATE UNIQUE INDEX IF NOT EXISTS "PassDesign_cartillaId_key" ON "PassDesign"("cartillaId");

-- Cartilla
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

CREATE TABLE IF NOT EXISTS "CartillaPromo" (
    "id" TEXT NOT NULL,
    "cartillaId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "pointsRequired" INTEGER NOT NULL,
    "pool" "PromotionPool" NOT NULL,
    CONSTRAINT "CartillaPromo_pkey" PRIMARY KEY ("id")
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
CREATE INDEX IF NOT EXISTS "CartillaPromo_promotionId_idx" ON "CartillaPromo"("promotionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CartillaPromo_cartillaId_pointsRequired_pool_key"
  ON "CartillaPromo"("cartillaId", "pointsRequired", "pool");
CREATE INDEX IF NOT EXISTS "PassPromoAssignment_promotionId_cartillaId_idx"
  ON "PassPromoAssignment"("promotionId", "cartillaId");
CREATE UNIQUE INDEX IF NOT EXISTS "PassPromoAssignment_passId_cartillaId_pointsRequired_key"
  ON "PassPromoAssignment"("passId", "cartillaId", "pointsRequired");

DO $$ BEGIN
  ALTER TABLE "Cartilla" ADD CONSTRAINT "Cartilla_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CartillaPromo" ADD CONSTRAINT "CartillaPromo_cartillaId_fkey"
    FOREIGN KEY ("cartillaId") REFERENCES "Cartilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CartillaPromo" ADD CONSTRAINT "CartillaPromo_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
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

DO $$ BEGIN
  ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cartillaId_fkey"
    FOREIGN KEY ("cartillaId") REFERENCES "Cartilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PassDesign" ADD CONSTRAINT "PassDesign_cartillaId_fkey"
    FOREIGN KEY ("cartillaId") REFERENCES "Cartilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BillingInvoice
CREATE TABLE IF NOT EXISTS "BillingInvoice" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "BillingInvoiceKind" NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "planType" "PlanType" NOT NULL,
    "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "planCop" INTEGER NOT NULL DEFAULT 0,
    "newCustomersUsed" INTEGER NOT NULL DEFAULT 0,
    "newCustomersLimit" INTEGER NOT NULL DEFAULT 0,
    "extraCustomersCount" INTEGER NOT NULL DEFAULT 0,
    "extraCustomersCop" INTEGER NOT NULL DEFAULT 0,
    "smsUsed" INTEGER NOT NULL DEFAULT 0,
    "smsLimit" INTEGER NOT NULL DEFAULT 0,
    "extraSmsCount" INTEGER NOT NULL DEFAULT 0,
    "extraSmsCop" INTEGER NOT NULL DEFAULT 0,
    "campaignsCount" INTEGER NOT NULL DEFAULT 0,
    "carriedInCop" INTEGER NOT NULL DEFAULT 0,
    "carriedOutCop" INTEGER NOT NULL DEFAULT 0,
    "totalCop" INTEGER NOT NULL DEFAULT 0,
    "chargedCop" INTEGER NOT NULL DEFAULT 0,
    "wompiReference" TEXT,
    "pdfStoragePath" TEXT,
    "lineItems" JSONB,
    "emailedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "BillingInvoice_storeId_issuedAt_idx" ON "BillingInvoice"("storeId", "issuedAt");
CREATE INDEX IF NOT EXISTS "BillingInvoice_storeId_periodStart_periodEnd_idx"
  ON "BillingInvoice"("storeId", "periodStart", "periodEnd");

DO $$ BEGIN
  ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
