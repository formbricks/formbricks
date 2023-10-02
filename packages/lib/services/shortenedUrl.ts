import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/types/v1/errors";

type ShortenedUrl = {
  id: string;
  createdAt: Date;
  longUrl: string;
  shortUrl: string;
};

export async function createShortenedUrl(shortUrl: string, longUrl: string): Promise<ShortenedUrl> {
  let urlRecord;
  try {
    urlRecord = await prisma.shortenedUrl.findFirst({
      where: {
        longUrl,
      },
    });
    if (!urlRecord) {
      urlRecord = await prisma.shortenedUrl.create({
        data: {
          shortUrl,
          longUrl,
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }

  return urlRecord;
}

export async function getRedirectUrl(shortUrl: string): Promise<ShortenedUrl | undefined | null> {
  let urlRecord;
  try {
    urlRecord = await prisma.shortenedUrl.findFirst({
      where: {
        shortUrl,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
  }

  return urlRecord;
}
