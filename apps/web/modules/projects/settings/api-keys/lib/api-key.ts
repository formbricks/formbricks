import "server-only";
import { apiKeyCache } from "@/lib/cache/api-key";
import { TApiKeyCreateInput, ZApiKeyCreateInput } from "@/modules/projects/settings/api-keys/types/api-keys";
import { TApiKey } from "@/modules/projects/settings/api-keys/types/api-keys";
import { ApiKey, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getApiKeys = reactCache(
  async (environmentId: string, page?: number): Promise<ApiKey[]> =>
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

export const deleteApiKey = async (id: string): Promise<ApiKey | null> => {
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

const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

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
