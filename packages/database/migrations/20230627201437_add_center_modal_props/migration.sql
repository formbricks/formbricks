-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "clickOutsideClose" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "darkOverlay" BOOLEAN NOT NULL DEFAULT false;
