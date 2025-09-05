-- AlterTable
ALTER TABLE "public"."CustomerOrder" ADD COLUMN     "cogs" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "public"."InventoryBatch" (
    "id" SERIAL NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchaseOrderItemId" INTEGER,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_purchaseOrderItemId_key" ON "public"."InventoryBatch"("purchaseOrderItemId");

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "public"."PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
