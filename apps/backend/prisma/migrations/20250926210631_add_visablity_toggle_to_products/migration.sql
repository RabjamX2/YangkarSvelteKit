/*
  Warnings:

  - You are about to drop the column `estimatedShipDate` on the `CustomerOrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "fulfillmentStatus" SET DEFAULT 'PICKED_UP',
ALTER COLUMN "paymentStatus" SET DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" DROP COLUMN "estimatedShipDate";

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "visable" BOOLEAN DEFAULT true;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ADD COLUMN     "visable" BOOLEAN DEFAULT true;
