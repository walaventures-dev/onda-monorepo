-- CreateEnum
DO $$ BEGIN CREATE TYPE "StoreMemberRole" AS ENUM ('ADMIN', 'CAJA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "StoreMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PosItemKind" AS ENUM ('PRODUCT', 'SERVICE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PosTabStatus" AS ENUM ('OPEN', 'CHECKOUT', 'PAID', 'VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PosRefundKind" AS ENUM ('FULL', 'PARTIAL', 'VOID_BEFORE_PAY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AccountingProvider" AS ENUM ('NONE', 'ALEGRA', 'SIIGO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AccountingSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "posEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreMember" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StoreMemberRole" NOT NULL,
    "status" "StoreMemberStatus" NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "firebaseUid" TEXT,

    CONSTRAINT "StoreMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "PosItemKind" NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "stockQty" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "externalSku" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosAddon" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosItemAddon" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PosItemAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosItemVariant" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PosItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosTab" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PosTabStatus" NOT NULL DEFAULT 'OPEN',
    "guestName" TEXT,
    "userId" TEXT,
    "passId" TEXT,
    "openedByMemberId" TEXT,
    "attendedByMemberId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkoutAt" TIMESTAMP(3),

    CONSTRAINT "PosTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosTabLine" (
    "id" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "variantId" TEXT,
    "variantName" TEXT,

    CONSTRAINT "PosTabLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosTabLineAddon" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "addonId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PosTabLineAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosSaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "variantName" TEXT,

    CONSTRAINT "PosSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosSaleLineAddon" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PosSaleLineAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosPayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "methodKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "cashReceived" INTEGER,
    "changeGiven" INTEGER,

    CONSTRAINT "PosPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosPaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PosPaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosRefund" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "kind" "PosRefundKind" NOT NULL,
    "reason" TEXT,
    "amount" INTEGER NOT NULL,
    "ondasReversed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosRefundLine" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "PosRefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreAccountingConfig" (
    "storeId" TEXT NOT NULL,
    "provider" "AccountingProvider" NOT NULL DEFAULT 'NONE',
    "credentials" JSONB,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreAccountingConfig_pkey" PRIMARY KEY ("storeId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PosAccountingSync" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "provider" "AccountingProvider" NOT NULL,
    "status" "AccountingSyncStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosAccountingSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoreMember_inviteToken_key" ON "StoreMember"("inviteToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StoreMember_email_status_idx" ON "StoreMember"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoreMember_storeId_email_key" ON "StoreMember"("storeId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosItem_storeId_isActive_idx" ON "PosItem"("storeId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosAddon_storeId_isActive_idx" ON "PosAddon"("storeId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosItemAddon_addonId_idx" ON "PosItemAddon"("addonId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PosItemAddon_itemId_addonId_key" ON "PosItemAddon"("itemId", "addonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosItemVariant_itemId_idx" ON "PosItemVariant"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosTab_storeId_status_idx" ON "PosTab"("storeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosTab_storeId_status_attendedByMemberId_idx" ON "PosTab"("storeId", "status", "attendedByMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosTabLine_tabId_idx" ON "PosTabLine"("tabId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosTabLine_itemId_idx" ON "PosTabLine"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosTabLineAddon_lineId_idx" ON "PosTabLineAddon"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PosSale_tabId_key" ON "PosSale"("tabId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosSale_storeId_completedAt_idx" ON "PosSale"("storeId", "completedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosSale_passId_idx" ON "PosSale"("passId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosSaleLine_saleId_idx" ON "PosSaleLine"("saleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosSaleLine_itemId_idx" ON "PosSaleLine"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosSaleLineAddon_lineId_idx" ON "PosSaleLineAddon"("lineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosPayment_saleId_idx" ON "PosPayment"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PosPaymentMethodConfig_storeId_key_key" ON "PosPaymentMethodConfig"("storeId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosRefund_saleId_idx" ON "PosRefund"("saleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosRefundLine_refundId_idx" ON "PosRefundLine"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PosAccountingSync_saleId_key" ON "PosAccountingSync"("saleId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StoreMember" ADD CONSTRAINT "StoreMember_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosItem" ADD CONSTRAINT "PosItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosAddon" ADD CONSTRAINT "PosAddon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosItemAddon" ADD CONSTRAINT "PosItemAddon_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosItemAddon" ADD CONSTRAINT "PosItemAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "PosAddon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosItemVariant" ADD CONSTRAINT "PosItemVariant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_openedByMemberId_fkey" FOREIGN KEY ("openedByMemberId") REFERENCES "StoreMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_attendedByMemberId_fkey" FOREIGN KEY ("attendedByMemberId") REFERENCES "StoreMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTabLine" ADD CONSTRAINT "PosTabLine_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "PosTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTabLine" ADD CONSTRAINT "PosTabLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTabLineAddon" ADD CONSTRAINT "PosTabLineAddon_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PosTabLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosTabLineAddon" ADD CONSTRAINT "PosTabLineAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "PosAddon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "PosTab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosSaleLine" ADD CONSTRAINT "PosSaleLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosSaleLineAddon" ADD CONSTRAINT "PosSaleLineAddon_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PosSaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosPaymentMethodConfig" ADD CONSTRAINT "PosPaymentMethodConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosRefundLine" ADD CONSTRAINT "PosRefundLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "PosRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StoreAccountingConfig" ADD CONSTRAINT "StoreAccountingConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosAccountingSync" ADD CONSTRAINT "PosAccountingSync_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill admins desde ownerEmail
INSERT INTO "StoreMember" ("id", "storeId", "email", "name", "role", "status", "invitedAt", "acceptedAt")
SELECT gen_random_uuid()::text,
       s."id",
       lower(s."ownerEmail"),
       s."ownerName",
       'ADMIN'::"StoreMemberRole",
       'ACTIVE'::"StoreMemberStatus",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Store" s
WHERE s."ownerEmail" IS NOT NULL
  AND length(trim(s."ownerEmail")) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "StoreMember" m
    WHERE m."storeId" = s."id" AND lower(m."email") = lower(s."ownerEmail")
  );
