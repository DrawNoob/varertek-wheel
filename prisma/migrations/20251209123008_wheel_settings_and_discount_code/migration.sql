-- AlterTable
ALTER TABLE "CountdownAnswer" ADD COLUMN     "discountCode" TEXT;

-- CreateTable
CREATE TABLE "WheelSetting" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "segment1" JSONB NOT NULL,
    "segment2" JSONB NOT NULL,
    "segment3" JSONB NOT NULL,
    "segment4" JSONB NOT NULL,
    "segment5" JSONB NOT NULL,
    "segment6" JSONB NOT NULL,

    CONSTRAINT "WheelSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WheelSetting_shop_key" ON "WheelSetting"("shop");
