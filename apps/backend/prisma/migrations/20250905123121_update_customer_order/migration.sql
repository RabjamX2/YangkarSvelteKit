/*
  Warnings:

  - You are about to drop the column `total` on the `CustomerOrder` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `CustomerOrder` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."CustomerOrder" DROP CONSTRAINT "CustomerOrder_customerId_fkey";

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hasAccount" BOOLEAN DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."CustomerOrder" DROP COLUMN "total",
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderType" TEXT,
ADD COLUMN     "staffName" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" ADD COLUMN     "discount" DECIMAL(65,30) DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_invoiceNumber_key" ON "public"."CustomerOrder"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "public"."CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
