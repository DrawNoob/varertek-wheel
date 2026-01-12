-- CreateTable
CREATE TABLE "UserEvent" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "email" TEXT,
    "eventType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "productHandle" TEXT,
    "deviceType" TEXT,
    "eventData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- Index for faster lookup by shop/email/time
CREATE INDEX "UserEvent_shop_email_createdAt_idx" ON "UserEvent"("shop", "email", "createdAt");
