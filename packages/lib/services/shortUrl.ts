"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { SHORT_SURVEY_BASE_URL } from "../constants";
import { DatabaseError, InvalidInputError } from "@formbricks/types/v1/errors";

interface IShortenUrlData {
  id: string;
  longUrl: string;
  shortUrl: string;
  clicks: number;
}

const validateUrl = (longUrl: string) => {
  return longUrl.startsWith(SHORT_SURVEY_BASE_URL);
};

export const shortenUrl = async (hash: string, longUrl: string): Promise<IShortenUrlData> => {
  try {
    if (!validateUrl(longUrl)) {
      throw new InvalidInputError("Only formbricks links allowed.");
    }

    const existingUrl = await prisma.urlShorten.findFirst({
      where: {
        longUrl,
      },
    });

    // If the shorten record of this longUrl already exists, it will simply return the existing data
    if (existingUrl) {
      return {
        clicks: existingUrl.clicks,
        id: existingUrl.id,
        longUrl: existingUrl.longUrl,
        shortUrl: existingUrl.shortUrl,
      };
    }

    // Else it will create a new entry in the database
    const newShortUrl = await prisma.urlShorten.create({
      data: {
        clicks: 0,
        longUrl,
        shortUrl: hash,
        id: hash,
      },
    });

    return {
      clicks: newShortUrl.clicks,
      id: newShortUrl.id,
      longUrl: newShortUrl.longUrl,
      shortUrl: newShortUrl.shortUrl,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Unable to create short url!");
    }
    throw error;
  }
};

export const getLongUrlFromShortUrl = async (shortUrl: string): Promise<IShortenUrlData | undefined> => {
  try {
    const urlData = await prisma.urlShorten.findFirst({
      where: {
        shortUrl,
      },
    });

    if (!urlData) {
      throw new DatabaseError("Invalid URL!");
    }

    await prisma.urlShorten.update({
      where: {
        id: urlData.id,
      },
      data: {
        clicks: urlData.clicks + 1,
      },
    });

    return urlData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Unable to retrieve url from record!");
    }
    throw error;
  }
};
