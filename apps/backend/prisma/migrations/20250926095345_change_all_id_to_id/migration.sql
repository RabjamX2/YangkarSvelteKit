/*
  Warnings:

  - You are about to drop the column `productVariantID` on the `CustomerOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `categoryID` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `supplierID` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `productID` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `ProductVariantID` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `PurchaseOrderID` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `productVariantID` on the `StockChange` table. All the data in the column will be lost.
  - The `orderType` column on the `StockChange` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `productVariantId` to the `CustomerOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantId` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purchaseOrderId` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantId` to the `StockChange` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('CUSTOMER', 'PURCHASE');

-- DropForeignKey
ALTER TABLE "public"."CustomerOrderItem" DROP CONSTRAINT "CustomerOrderItem_productVariantID_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_categoryID_fkey";

-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_supplierID_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductVariant" DROP CONSTRAINT "ProductVariant_productID_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_ProductVariantID_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_PurchaseOrderID_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockChange" DROP CONSTRAINT "StockChange_productVariantID_fkey";

-- DropIndex
DROP INDEX "public"."ProductVariant_productID_idx";

-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" DROP COLUMN "productVariantID",
ADD COLUMN     "productVariantId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "categoryID",
DROP COLUMN "supplierID",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "supplierId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "productID",
ADD COLUMN     "productId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."PurchaseOrderItem" DROP COLUMN "ProductVariantID",
DROP COLUMN "PurchaseOrderID",
ADD COLUMN     "productVariantId" INTEGER NOT NULL,
ADD COLUMN     "purchaseOrderId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."StockChange" DROP COLUMN "productVariantID",
ADD COLUMN     "productVariantId" INTEGER NOT NULL,
DROP COLUMN "orderType",
ADD COLUMN     "orderType" "public"."OrderType";

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "public"."ProductVariant"("productId");

-- AddForeignKey
ALTER TABLE "public"."StockChange" ADD CONSTRAINT "StockChange_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "public"."PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
