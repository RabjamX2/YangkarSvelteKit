/*
  Warnings:

  - You are about to drop the column `productVariantId` on the `CustomerOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `categoryName` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `supplierName` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `productSkuBase` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `productVariantId` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseOrderId` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `productVariantId` on the `StockChange` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[batchNumber]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productVariantID` to the `CustomerOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryID` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierID` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productID` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Made the column `sku` on table `ProductVariant` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `batchNumber` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantID` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantID` to the `StockChange` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."CustomerOrderItem" DROP CONSTRAINT "CustomerOrderItem_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_categoryName_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_supplierName_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_productSkuBase_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockChange" DROP CONSTRAINT "StockChange_productVariantId_fkey";

-- DropIndex
DROP INDEX "public"."ProductVariant_productSkuBase_idx";

-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" DROP COLUMN "productVariantId",
ADD COLUMN     "productVariantID" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "categoryName",
DROP COLUMN "supplierName",
ADD COLUMN     "categoryID" INTEGER NOT NULL,
ADD COLUMN     "supplierID" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "productSkuBase",
DROP COLUMN "stock",
ADD COLUMN     "productID" INTEGER NOT NULL,
ALTER COLUMN "sku" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."PurchaseOrderItem" DROP COLUMN "productVariantId",
DROP COLUMN "purchaseOrderId",
ADD COLUMN     "batchNumber" INTEGER NOT NULL,
ADD COLUMN     "productVariantID" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."StockChange" DROP COLUMN "productVariantId",
ADD COLUMN     "productVariantID" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "ProductVariant_productID_idx" ON "public"."ProductVariant"("productID");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_batchNumber_key" ON "public"."PurchaseOrder"("batchNumber");

-- AddForeignKey
ALTER TABLE "public"."StockChange" ADD CONSTRAINT "StockChange_productVariantID_fkey" FOREIGN KEY ("productVariantID") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_supplierID_fkey" FOREIGN KEY ("supplierID") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryID_fkey" FOREIGN KEY ("categoryID") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_productID_fkey" FOREIGN KEY ("productID") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_batchNumber_fkey" FOREIGN KEY ("batchNumber") REFERENCES "public"."PurchaseOrder"("batchNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productVariantID_fkey" FOREIGN KEY ("productVariantID") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_productVariantID_fkey" FOREIGN KEY ("productVariantID") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
