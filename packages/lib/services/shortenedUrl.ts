import { prisma } from "@formbricks/database";

export async function createShortenedUrl(shortUrl: string, longUrl: string) {
  const url = await prisma.shortenedUrl.create({
    data: {
      shortUrl,
      longUrl,
    },
  });

  return url;
}

export async function getRedirectUrl(shortUrl: string) {
  const url = await prisma.shortenedUrl.findUnique({
    where: {
      shortUrl,
    },
  });

  return url;
}
