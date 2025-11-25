/*
  Warnings:

  - The primary key for the `CountdownAnswer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `CountdownAnswer` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CountdownAnswer" DROP CONSTRAINT "CountdownAnswer_pkey",
ADD COLUMN     "deviceType" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "CountdownAnswer_pkey" PRIMARY KEY ("id");
