-- CreateEnum
CREATE TYPE "KitchenTicketStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KitchenItemStatus" AS ENUM ('QUEUED', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "PosItem" ADD COLUMN     "stationId" TEXT;

-- AlterTable
ALTER TABLE "PosTab" ADD COLUMN     "guestCount" INTEGER,
ADD COLUMN     "tableId" TEXT;

-- AlterTable
ALTER TABLE "PosTabLine" ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "stationId" TEXT;

-- CreateTable
CREATE TABLE "PosSection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosTable" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosStation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "stationId" TEXT,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'PENDING',
    "openedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tabLineId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "status" "KitchenItemStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "KitchenTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosSection_storeId_idx" ON "PosSection"("storeId");

-- CreateIndex
CREATE INDEX "PosTable_storeId_idx" ON "PosTable"("storeId");

-- CreateIndex
CREATE INDEX "PosTable_sectionId_idx" ON "PosTable"("sectionId");

-- CreateIndex
CREATE INDEX "PosStation_storeId_idx" ON "PosStation"("storeId");

-- CreateIndex
CREATE INDEX "KitchenTicket_storeId_status_idx" ON "KitchenTicket"("storeId", "status");

-- CreateIndex
CREATE INDEX "KitchenTicket_tabId_idx" ON "KitchenTicket"("tabId");

-- CreateIndex
CREATE INDEX "KitchenTicketItem_ticketId_idx" ON "KitchenTicketItem"("ticketId");

-- AddForeignKey
ALTER TABLE "PosItem" ADD CONSTRAINT "PosItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "PosStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "PosTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSection" ADD CONSTRAINT "PosSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTable" ADD CONSTRAINT "PosTable_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTable" ADD CONSTRAINT "PosTable_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PosSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosStation" ADD CONSTRAINT "PosStation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "PosTab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "PosStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_openedByMemberId_fkey" FOREIGN KEY ("openedByMemberId") REFERENCES "StoreMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_tabLineId_fkey" FOREIGN KEY ("tabLineId") REFERENCES "PosTabLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

