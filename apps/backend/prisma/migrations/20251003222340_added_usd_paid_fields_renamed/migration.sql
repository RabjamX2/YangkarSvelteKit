/*
  Warnings:

  - You are about to drop the column `usdExtraFees` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `usdShippingCost` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `usdTotalPaid` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."PurchaseOrder" DROP COLUMN "usdExtraFees",
DROP COLUMN "usdShippingCost",
DROP COLUMN "usdTotalPaid",
ADD COLUMN     "extraFeesCny" DECIMAL(65,30),
ADD COLUMN     "extraFeesUsd" DECIMAL(65,30),
ADD COLUMN     "totalPaidUsd" DECIMAL(65,30);
