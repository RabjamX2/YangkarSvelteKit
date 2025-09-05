/*
  Warnings:

  - You are about to drop the column `orderDate` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `arrived` on the `PurchaseOrderItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_supplierId_fkey";

-- AlterTable
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "color" DROP NOT NULL,
ALTER COLUMN "costCny" DROP NOT NULL,
ALTER COLUMN "costUsd" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."PurchaseOrder" DROP COLUMN "orderDate",
DROP COLUMN "supplierId",
ADD COLUMN     "arrivalDate" TIMESTAMP(3),
ADD COLUMN     "shipDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."PurchaseOrderItem" DROP COLUMN "arrived",
ALTER COLUMN "costPerItemCny" DROP NOT NULL,
ALTER COLUMN "costPerItemUsd" DROP NOT NULL;
