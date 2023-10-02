-- CreateTable
CREATE TABLE "ShortenedUrl" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "longUrl" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,

    CONSTRAINT "ShortenedUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortenedUrl_shortUrl_key" ON "ShortenedUrl"("shortUrl");
