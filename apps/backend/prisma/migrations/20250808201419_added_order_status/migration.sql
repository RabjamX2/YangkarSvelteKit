-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "public"."CustomerOrder" ADD COLUMN     "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING';
