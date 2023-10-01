import { prisma } from "@formbricks/database";
import { SHORT_SURVEY_BASE_URL } from "@formbricks/lib/constants";
import { customAlphabet } from "nanoid";

// Create short url and return it
export const createShortUrl = async (fullUrl: string) => {
  const nanoId = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();
  const shortUrl = `${SHORT_SURVEY_BASE_URL}/${nanoId}`;

  const inserted = await prisma.urlShortener.create({
    data: {
      fullUrl,
      shortUrl,
    },
    select: {
      shortUrl: true,
    },
  });

  return inserted.shortUrl;
};

// Get full url from short url and increment the hits count
export const getFullUrl = async (shortUrl: string) => {
  const url = await prisma.urlShortener.findUnique({
    where: {
      shortUrl: shortUrl,
    },
  });

  if (!url) {
    return null;
  }

  await prisma.urlShortener.update({
    where: {
      shortUrl,
    },
    data: {
      hits: url.hits + 1,
    },
  });

  return url;
};
