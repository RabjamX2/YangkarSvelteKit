-- AlterTable
ALTER TABLE "public"."CustomerOrderItem" ADD COLUMN     "inventoryBatchId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."CustomerOrderItem" ADD CONSTRAINT "CustomerOrderItem_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "public"."InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
