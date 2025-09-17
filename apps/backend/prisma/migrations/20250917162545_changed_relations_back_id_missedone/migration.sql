/*
  Warnings:

  - You are about to drop the column `batchNumber` on the `PurchaseOrderItem` table. All the data in the column will be lost.
  - Added the required column `PurchaseOrderID` to the `PurchaseOrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_batchNumber_fkey";

-- AlterTable
ALTER TABLE "public"."PurchaseOrderItem" DROP COLUMN "batchNumber",
ADD COLUMN     "PurchaseOrderID" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_PurchaseOrderID_fkey" FOREIGN KEY ("PurchaseOrderID") REFERENCES "public"."PurchaseOrder"("batchNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
