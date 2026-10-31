-- CreateTable
CREATE TABLE "FeedbackFollowUpSms" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackFollowUpSms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackFollowUpSms_storeId_createdAt_idx" ON "FeedbackFollowUpSms"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackFollowUpSms" ADD CONSTRAINT "FeedbackFollowUpSms_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackFollowUpSms" ADD CONSTRAINT "FeedbackFollowUpSms_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
