-- CreateTable
CREATE TABLE IF NOT EXISTS "PosItemHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosItemHistory_itemId_createdAt_idx" ON "PosItemHistory"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PosItemHistory_storeId_createdAt_idx" ON "PosItemHistory"("storeId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PosItemHistory" ADD CONSTRAINT "PosItemHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
