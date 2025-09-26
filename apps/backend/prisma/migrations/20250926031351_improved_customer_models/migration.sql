-- AlterTable
ALTER TABLE "public"."CustomerOrder" ALTER COLUMN "subtotal" DROP NOT NULL,
ALTER COLUMN "total" DROP NOT NULL;
