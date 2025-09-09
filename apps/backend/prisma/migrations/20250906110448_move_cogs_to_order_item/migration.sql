/*
  Warnings:

  - You are about to drop the column `cogs` on the `CustomerOrder` table. All the data in the column will be lost.
  - You are about to drop the column `priceAtTimeOfSale` on the `CustomerOrderItem` table. All the data in the column will be lost.
  - Added the required column `salePrice` to the `CustomerOrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."CustomerOrder" DROP COLUMN "cogs";

-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" DROP COLUMN "priceAtTimeOfSale",
ADD COLUMN     "cogs" DECIMAL(65,30),
ADD COLUMN     "salePrice" DECIMAL(65,30) NOT NULL;
