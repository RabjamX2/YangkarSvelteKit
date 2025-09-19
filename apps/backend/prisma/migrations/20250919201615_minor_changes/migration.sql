/*
  Warnings:

  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[skuIntBase]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `skuIntBase` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `skuBase` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_PurchaseOrderID_fkey";

-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "name",
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "skuIntBase" INTEGER NOT NULL,
ALTER COLUMN "skuBase" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "colorHex" TEXT,
ADD COLUMN     "displayColor" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_skuIntBase_key" ON "public"."Product"("skuIntBase");

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_PurchaseOrderID_fkey" FOREIGN KEY ("PurchaseOrderID") REFERENCES "public"."PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
