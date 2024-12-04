import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TApiKey } from "@formbricks/types/api-keys";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { getHash } from "../crypto";
import { validateInputs } from "../utils/validate";
import { apiKeyCache } from "./cache";

export const getApiKey = reactCache(
  async (apiKeyId: string): Promise<TApiKey | null> =>
    cache(
      async () => {
        validateInputs([apiKeyId, ZString]);

        if (!apiKeyId) {
          throw new InvalidInputError("API key cannot be null or undefined.");
        }

        try {
          const apiKeyData = await prisma.apiKey.findUnique({
            where: {
              id: apiKeyId,
            },
          });

          return apiKeyData;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getApiKey-${apiKeyId}`],
      {
        tags: [apiKeyCache.tag.byId(apiKeyId)],
      }
    )()
);

export const getApiKeys = reactCache(
  async (environmentId: string, page?: number): Promise<TApiKey[]> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

        try {
          const apiKeys = await prisma.apiKey.findMany({
            where: {
              environmentId,
            },
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });

          return apiKeys;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getApiKeys-${environmentId}-${page}`],
      {
        tags: [apiKeyCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);

export const getApiKeyFromKey = reactCache(async (apiKey: string): Promise<TApiKey | null> => {
  const hashedKey = getHash(apiKey);
  return cache(
    async () => {
      validateInputs([apiKey, ZString]);

      if (!apiKey) {
        throw new InvalidInputError("API key cannot be null or undefined.");
      }

      try {
        const apiKeyData = await prisma.apiKey.findUnique({
          where: {
            hashedKey,
          },
        });

        return apiKeyData;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getApiKeyFromKey-${apiKey}`],
    {
      tags: [apiKeyCache.tag.byHashedKey(hashedKey)],
    }
  )();
});
