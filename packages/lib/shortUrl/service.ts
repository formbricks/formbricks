import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { cache as reactCache } from "react";
import { shortUrlCache } from "shortUrl/cache";
import z from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TShortUrl, ZShortUrlId } from "@formbricks/types/shortUrl";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";

// Create the short url and return it
export const createShortUrl = async (url: string): Promise<TShortUrl> => {
  validateInputs([url, z.string().url()]);

  try {
    // Check if an entry with the provided fullUrl already exists.
    const existingShortUrl = await getShortUrlByUrl(url);

    if (existingShortUrl) {
      return existingShortUrl;
    }

    // If an entry with the provided fullUrl does not exist, create a new one.
    const id = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();

    const shortUrl = await prisma.shortUrl.create({
      data: {
        id,
        url,
      },
    });

    shortUrlCache.revalidate({
      id: shortUrl.id,
      url: shortUrl.url,
    });

    return shortUrl;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

// Get the full url from short url and return it
export const getShortUrl = reactCache(
  (id: string): Promise<TShortUrl | null> =>
    cache(
      async () => {
        validateInputs([id, ZShortUrlId]);
        try {
          return await prisma.shortUrl.findUnique({
            where: {
              id,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getShortUrl-${id}`],
      {
        tags: [shortUrlCache.tag.byId(id)],
      }
    )()
);

export const getShortUrlByUrl = reactCache(
  (url: string): Promise<TShortUrl | null> =>
    cache(
      async () => {
        validateInputs([url, z.string().url()]);
        try {
          return await prisma.shortUrl.findUnique({
            where: {
              url,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getShortUrlByUrl-${url}`],
      {
        tags: [shortUrlCache.tag.byUrl(url)],
      }
    )()
);
