-- CreateTable
CREATE TABLE "UrlShorten" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "longUrl" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,

    CONSTRAINT "UrlShorten_pkey" PRIMARY KEY ("id")
);
