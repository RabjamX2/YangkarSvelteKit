-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FLAT');

-- AlterTable
ALTER TABLE "public"."Promotion" ADD COLUMN     "discountType" "public"."DiscountType",
ADD COLUMN     "discountValue" DECIMAL(65,30);
