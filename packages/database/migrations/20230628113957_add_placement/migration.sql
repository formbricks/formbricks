-- CreateEnum
CREATE TYPE "WidgetPlacement" AS ENUM ('bottomLeft', 'bottomRight', 'topLeft', 'topRight', 'center');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "clickOutsideClose" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "darkOverlay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placement" "WidgetPlacement" NOT NULL DEFAULT 'bottomRight';
