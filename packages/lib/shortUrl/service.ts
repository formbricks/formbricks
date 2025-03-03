// DEPRECATED
// The ShortUrl feature is deprecated and only available for backward compatibility.
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TShortUrl, ZShortUrlId } from "@formbricks/types/short-url";
import { cache } from "../cache";
import { validateInputs } from "../utils/validate";
import { shortUrlCache } from "./cache";

// Get the full url from short url and return it
export const getShortUrl = reactCache(
  async (id: string): Promise<TShortUrl | null> =>
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
  async (url: string): Promise<TShortUrl | null> =>
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
