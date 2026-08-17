ALTER TABLE "Transaction" ADD COLUMN "accumulateId" TEXT;

CREATE INDEX "Transaction_accumulateId_idx" ON "Transaction"("accumulateId");

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_accumulateId_fkey"
  FOREIGN KEY ("accumulateId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
