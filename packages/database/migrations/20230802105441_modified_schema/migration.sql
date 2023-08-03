-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#64748b',
ADD COLUMN     "clickOutsideClose" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "darkOverlay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placement" "WidgetPlacement" NOT NULL DEFAULT 'bottomRight';
