/*
  Warnings:

  - A unique constraint covering the columns `[legacySku]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "legacySku" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_legacySku_key" ON "public"."ProductVariant"("legacySku");
