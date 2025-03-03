import { apiKeyCache } from "@/lib/cache/api-key";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { getHash } from "@formbricks/lib/crypto";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { InvalidInputError } from "@formbricks/types/errors";

export const getEnvironmentIdFromApiKey = reactCache(async (apiKey: string): Promise<string | null> => {
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
          select: {
            environmentId: true,
          },
        });

        if (!apiKeyData) {
          throw new ResourceNotFoundError("apiKey", apiKey);
        }

        return apiKeyData.environmentId;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getEnvironmentIdFromApiKey-${apiKey}`],
    {
      tags: [apiKeyCache.tag.byHashedKey(hashedKey)],
    }
  )();
});
