-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ResponseToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ResponseToTag_AB_unique" ON "_ResponseToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ResponseToTag_B_index" ON "_ResponseToTag"("B");

-- AddForeignKey
ALTER TABLE "_ResponseToTag" ADD CONSTRAINT "_ResponseToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResponseToTag" ADD CONSTRAINT "_ResponseToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
