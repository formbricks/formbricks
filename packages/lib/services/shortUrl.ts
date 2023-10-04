import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { TShortUrl } from "@formbricks/types/v1/shortUrl";
import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { validateInputs } from "../utils/validate";
import z from "zod";

// Create the short url and return it
export const createShortUrl = async (url: string): Promise<TShortUrl> => {
  validateInputs([url, z.string().url()]);
  let shortUrl;

  try {
    // Check if an entry with the provided fullUrl already exists.
    shortUrl = getShortUrlByUrl(url);

    // If an entry with the provided fullUrl does not exist, create a new one.
    if (!shortUrl) {
      const id = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 10)();

      shortUrl = await prisma.shortUrl.create({
        data: {
          id,
          url,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  return shortUrl;
};

// Get the full url from short url and return it
export const getShortUrl = async (id: string): Promise<TShortUrl> => {
  validateInputs([url, z.string().cuid()]);
  try {
    return await prisma.shortUrl.findUnique({
      where: {
        id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};

export const getShortUrlByUrl = async (url: string): Promise<TShortUrl> => {
  validateInputs([url, z.string().url()]);
  try {
    return await prisma.shortUrl.findUnique({
      where: {
        url,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
