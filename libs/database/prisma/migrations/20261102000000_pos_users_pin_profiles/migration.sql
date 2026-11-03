-- CreateEnum
CREATE TYPE "PosUserRole" AS ENUM ('ADMIN', 'ATENCION', 'CAJA', 'PREPARACION');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "posSharedTabs" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PosUser" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "PosUserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosUser_username_key" ON "PosUser"("username");
CREATE INDEX "PosUser_storeId_idx" ON "PosUser"("storeId");

-- AddForeignKey
ALTER TABLE "PosUser" ADD CONSTRAINT "PosUser_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PosTab" ADD COLUMN "openedByPosUserId" TEXT;
ALTER TABLE "PosTab" ADD COLUMN "attendedByPosUserId" TEXT;

-- AddForeignKey
ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_openedByPosUserId_fkey" FOREIGN KEY ("openedByPosUserId") REFERENCES "PosUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_attendedByPosUserId_fkey" FOREIGN KEY ("attendedByPosUserId") REFERENCES "PosUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PosSale" ADD COLUMN "posUserId" TEXT;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_posUserId_fkey" FOREIGN KEY ("posUserId") REFERENCES "PosUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "posUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_posUserId_fkey" FOREIGN KEY ("posUserId") REFERENCES "PosUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
