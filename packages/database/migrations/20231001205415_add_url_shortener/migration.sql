-- CreateTable
CREATE TABLE "UrlShortener" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "fullUrl" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UrlShortener_pkey" PRIMARY KEY ("id")
);
