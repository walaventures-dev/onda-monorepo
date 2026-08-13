-- AlterTable
ALTER TABLE "Store" ADD COLUMN "wompiTransactionId" TEXT;
ALTER TABLE "Store" ADD COLUMN "wompiPaymentSourceId" TEXT;

-- CreateIndex
CREATE INDEX "Store_ownerEmail_idx" ON "Store"("ownerEmail");
