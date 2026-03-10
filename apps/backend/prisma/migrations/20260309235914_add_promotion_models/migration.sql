-- CreateTable
CREATE TABLE "public"."Promotion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromotionItem" (
    "id" SERIAL NOT NULL,
    "promotionPrice" DECIMAL(65,30) NOT NULL,
    "promotionId" INTEGER NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionItem_promotionId_productVariantId_key" ON "public"."PromotionItem"("promotionId", "productVariantId");

-- AddForeignKey
ALTER TABLE "public"."PromotionItem" ADD CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionItem" ADD CONSTRAINT "PromotionItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "public"."ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
