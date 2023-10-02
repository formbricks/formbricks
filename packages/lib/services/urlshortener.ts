import { prisma } from "@formbricks/database";
import { SHORT_SURVEY_BASE_URL } from "../../lib/constants";
import { customAlphabet } from "nanoid";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/types/v1/errors";

// Create short url and return it
export const createShortUrl = async (fullUrl: string): Promise<string> => {
  const nanoId = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();
  const shortUrl = `${SHORT_SURVEY_BASE_URL}${nanoId}`;

  let urlEntry;

  try {
    urlEntry = await prisma.urlShortener.findFirst({
      where: {
        fullUrl,
      },
      select: {
        shortUrl: true,
      },
    });

    // If an entry with the provided fullUrl does not exist, create a new one.
    if (!urlEntry) {
      urlEntry = await prisma.urlShortener.create({
        data: {
          fullUrl,
          shortUrl,
        },
        select: {
          shortUrl: true,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  return urlEntry.shortUrl;
};

// Get full url from short url and increment the hits count
export const getFullUrl = async (shortUrlParam: string): Promise<string | null> => {
  const shortUrl = `${SHORT_SURVEY_BASE_URL}${shortUrlParam}`;

  let urlEntry;

  try {
    urlEntry = await prisma.urlShortener.findFirst({
      where: {
        shortUrl,
      },
    });

    if (!urlEntry) {
      return null;
    }

    await prisma.urlShortener.update({
      where: {
        id: urlEntry.id,
        shortUrl,
      },
      data: {
        hits: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  return urlEntry.fullUrl;
};
