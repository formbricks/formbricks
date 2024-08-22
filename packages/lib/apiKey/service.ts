import "server-only";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TApiKey, TApiKeyCreateInput, ZApiKeyCreateInput } from "@formbricks/types/api-keys";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { getHash } from "../crypto";
import { validateInputs } from "../utils/validate";
import { apiKeyCache } from "./cache";

export const getApiKey = reactCache(
  (apiKeyId: string): Promise<TApiKey | null> =>
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
  (environmentId: string, page?: number): Promise<TApiKey[]> =>
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

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export const createApiKey = async (
  environmentId: string,
  apiKeyData: TApiKeyCreateInput
): Promise<TApiKey> => {
  validateInputs([environmentId, ZId], [apiKeyData, ZApiKeyCreateInput]);
  try {
    const key = randomBytes(16).toString("hex");
    const hashedKey = hashApiKey(key);

    const result = await prisma.apiKey.create({
      data: {
        ...apiKeyData,
        hashedKey,
        environment: { connect: { id: environmentId } },
      },
    });

    apiKeyCache.revalidate({
      id: result.id,
      hashedKey: result.hashedKey,
      environmentId: result.environmentId,
    });

    return { ...result, apiKey: key };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getApiKeyFromKey = reactCache((apiKey: string): Promise<TApiKey | null> => {
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

export const deleteApiKey = async (id: string): Promise<TApiKey | null> => {
  validateInputs([id, ZId]);

  try {
    const deletedApiKeyData = await prisma.apiKey.delete({
      where: {
        id: id,
      },
    });

    apiKeyCache.revalidate({
      id: deletedApiKeyData.id,
      hashedKey: deletedApiKeyData.hashedKey,
      environmentId: deletedApiKeyData.environmentId,
    });

    return deletedApiKeyData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
