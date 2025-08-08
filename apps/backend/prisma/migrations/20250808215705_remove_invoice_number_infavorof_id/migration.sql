/*
  Warnings:

  - You are about to drop the column `invoiceNumber` on the `CustomerOrder` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."CustomerOrder_invoiceNumber_key";

-- AlterTable
ALTER TABLE "public"."CustomerOrder" DROP COLUMN "invoiceNumber";
