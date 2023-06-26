-- CreateEnum
CREATE TYPE "WidgetPlacement" AS ENUM ('bottomLeft', 'bottomRight', 'topLeft', 'topRight', 'center');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "placement" "WidgetPlacement" NOT NULL DEFAULT 'bottomRight';
