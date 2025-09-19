/*
  Warnings:

  - You are about to drop the column `productVariantID` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - Added the required column `ProductVariantID` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_productVariantID_fkey";

-- AlterTable
ALTER TABLE "public"."Product" ALTER COLUMN "skuIntBase" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PurchaseOrderItem" DROP COLUMN "productVariantID",
ADD COLUMN     "ProductVariantID" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_ProductVariantID_fkey" FOREIGN KEY ("ProductVariantID") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
