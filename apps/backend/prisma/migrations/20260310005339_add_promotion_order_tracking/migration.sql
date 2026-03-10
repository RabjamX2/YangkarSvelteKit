-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" ADD COLUMN     "promotionItemId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_promotionItemId_fkey" FOREIGN KEY ("promotionItemId") REFERENCES "public"."PromotionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
