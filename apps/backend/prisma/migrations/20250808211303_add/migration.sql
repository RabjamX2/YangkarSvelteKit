-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "public"."CustomerOrder" ADD COLUMN     "moneyHolder" TEXT,
ADD COLUMN     "paymentMethod" TEXT;
