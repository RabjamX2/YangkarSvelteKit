/*
  Warnings:

  - Made the column `style` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Product" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "skuBase" DROP NOT NULL,
ALTER COLUMN "style" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "sku" DROP NOT NULL;
