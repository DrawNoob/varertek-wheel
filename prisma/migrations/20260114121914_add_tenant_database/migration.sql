-- CreateTable
CREATE TABLE "TenantDatabase" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantDatabase_shop_key" ON "TenantDatabase"("shop");
