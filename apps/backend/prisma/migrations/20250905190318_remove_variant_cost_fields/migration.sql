/*
  Warnings:

  - You are about to drop the column `costCny` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the column `costUsd` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ProductVariant" DROP COLUMN "costCny",
DROP COLUMN "costUsd";
