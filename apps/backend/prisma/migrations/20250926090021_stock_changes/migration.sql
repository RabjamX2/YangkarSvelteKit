-- AlterTable
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "paymentMethod" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."StockChange" ADD COLUMN     "changeTime" TIMESTAMP(3);
