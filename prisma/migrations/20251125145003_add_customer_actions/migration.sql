-- CreateTable
CREATE TABLE "CountdownAnswer" (
    "id" TEXT NOT NULL,
    "shop" TEXT,
    "email" TEXT,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountdownAnswer_pkey" PRIMARY KEY ("id")
);
