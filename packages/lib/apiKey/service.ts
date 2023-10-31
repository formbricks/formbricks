import "server-only";

import { prisma } from "@formbricks/database";
import { TApiKey, TApiKeyCreateInput, ZApiKeyCreateInput } from "@formbricks/types/apiKeys";
import { Prisma } from "@prisma/client";
import { getHash } from "../crypto";
import { createHash, randomBytes } from "crypto";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/environment";
import { ZString, ZOptionalNumber } from "@formbricks/types/common";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { unstable_cache } from "next/cache";
import { apiKeyCache } from "./cache";

export const getApiKey = async (apiKeyId: string): Promise<TApiKey | null> =>
  unstable_cache(
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

        if (!apiKeyData) {
          throw new ResourceNotFoundError("API Key from ID", apiKeyId);
        }

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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getApiKeys = async (environmentId: string, page?: number): Promise<TApiKey[]> =>
  unstable_cache(
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export async function createApiKey(environmentId: string, apiKeyData: TApiKeyCreateInput): Promise<TApiKey> {
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
}

export const getApiKeyFromKey = async (apiKey: string): Promise<TApiKey | null> => {
  const hashedKey = getHash(apiKey);

  return unstable_cache(
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
};

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
