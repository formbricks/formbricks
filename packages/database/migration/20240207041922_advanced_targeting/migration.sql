-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "segmentId" TEXT;

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "environmentId" TEXT NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Segment_environmentId_idx" ON "Segment"("environmentId");

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Segment_environmentId_title_key" ON "Segment"("environmentId", "title");
