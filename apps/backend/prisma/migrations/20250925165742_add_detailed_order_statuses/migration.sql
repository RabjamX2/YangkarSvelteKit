/*
  Warnings:

  - The values [USER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `hasAccount` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `CustomerOrder` table. All the data in the column will be lost.
  - You are about to drop the column `arrivalDate` on the `InventoryBatch` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacyInvoiceNumber]` on the table `CustomerOrder` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subtotal` to the `CustomerOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `CustomerOrder` table without a default value. This is not possible if the table is not empty.
  - Made the column `purchaseOrderItemId` on table `InventoryBatch` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReturnStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'RECEIVED', 'COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Role_new" AS ENUM ('CLIENT', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."Role_new" USING ("role"::text::"public"."Role_new");
ALTER TYPE "public"."Role" RENAME TO "Role_old";
ALTER TYPE "public"."Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."InventoryBatch" DROP CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey";

-- AlterTable
ALTER TABLE "public"."Customer" DROP COLUMN "hasAccount",
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "public"."CustomerOrder" DROP COLUMN "status",
ADD COLUMN     "addressId" INTEGER,
ADD COLUMN     "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillmentStatus" "public"."FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN     "legacyInvoiceNumber" TEXT,
ADD COLUMN     "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "returnStatus" "public"."ReturnStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "shipping" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingAddressId" INTEGER,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "subtotal" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "taxes" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "trackingNumber" TEXT;

-- AlterTable
ALTER TABLE "public"."InventoryBatch" DROP COLUMN "arrivalDate",
ALTER COLUMN "purchaseOrderItemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';

-- DropEnum
DROP TYPE "public"."OrderStatus";

-- CreateTable
CREATE TABLE "public"."Address" (
    "id" SERIAL NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "customerId" INTEGER NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "public"."Customer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_legacyInvoiceNumber_key" ON "public"."CustomerOrder"("legacyInvoiceNumber");

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrder" ADD CONSTRAINT "CustomerOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrder" ADD CONSTRAINT "CustomerOrder_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
