-- AlterTable
ALTER TABLE "public"."Promotion" ADD COLUMN     "bannerText" TEXT,
ADD COLUMN     "bannerVisible" BOOLEAN NOT NULL DEFAULT false;
