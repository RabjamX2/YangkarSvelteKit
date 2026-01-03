-- DropForeignKey
ALTER TABLE "public"."InventoryBatch" DROP CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey";

-- AlterTable
ALTER TABLE "public"."InventoryBatch" ALTER COLUMN "purchaseOrderItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
