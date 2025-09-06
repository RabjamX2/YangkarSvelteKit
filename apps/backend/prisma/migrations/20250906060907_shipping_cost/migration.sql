/*
  Warnings:

  - You are about to drop the column `cost` on the `InventoryBatch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."InventoryBatch" DROP COLUMN "cost",
ADD COLUMN     "arrivalDate" TIMESTAMP(3),
ADD COLUMN     "costCNY" DECIMAL(65,30),
ADD COLUMN     "costUSD" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."PurchaseOrder" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "shippingCostCny" DECIMAL(65,30),
ADD COLUMN     "shippingCostUsd" DECIMAL(65,30);
