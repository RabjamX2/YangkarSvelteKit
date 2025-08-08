/*
  Warnings:

  - The values [PAID] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `CustomerOrder` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `Customer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `invoiceNumber` to the `CustomerOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."OrderStatus_new" AS ENUM ('PENDING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "status" TYPE "public"."OrderStatus_new" USING ("status"::text::"public"."OrderStatus_new");
ALTER TYPE "public"."OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "public"."OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Customer" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."CustomerOrder" ADD COLUMN     "invoiceNumber" TEXT NOT NULL,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "public"."Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_invoiceNumber_key" ON "public"."CustomerOrder"("invoiceNumber");
