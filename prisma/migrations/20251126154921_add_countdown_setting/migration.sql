-- CreateTable
CREATE TABLE "CountdownSetting" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountdownSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CountdownSetting_shop_key" ON "CountdownSetting"("shop");
