-- AlterTable
ALTER TABLE "public"."PurchaseOrder" ADD COLUMN     "usdExtraFees" DECIMAL(65,30),
ADD COLUMN     "usdShippingCost" DECIMAL(65,30),
ADD COLUMN     "usdTotalPaid" DECIMAL(65,30);
