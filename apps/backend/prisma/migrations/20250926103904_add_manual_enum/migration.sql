-- AlterEnum
ALTER TYPE "public"."OrderType" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "public"."StockChange" ALTER COLUMN "changeTime" SET DEFAULT CURRENT_TIMESTAMP;
