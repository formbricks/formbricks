import { apiKeyCache } from "@/lib/cache/api-key";
import { hashApiKey } from "@/modules/api/v2/management/lib/utils";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getEnvironmentIdFromApiKey = reactCache(async (apiKey: string) => {
  const hashedKey = hashApiKey(apiKey);
  return cache(
    async (): Promise<Result<string, ApiErrorResponseV2>> => {
      if (!apiKey) {
        return err({
          type: "bad_request",
          details: [{ field: "apiKey", issue: "API key cannot be null or undefined." }],
        });
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
          return err({ type: "not_found", details: [{ field: "apiKey", issue: "not found" }] });
        }

        return ok(apiKeyData.environmentId);
      } catch (error) {
        return err({ type: "internal_server_error", details: [{ field: "apiKey", issue: error.message }] });
      }
    },
    [`management-api-getEnvironmentIdFromApiKey-${hashedKey}`],
    {
      tags: [apiKeyCache.tag.byHashedKey(hashedKey)],
    }
  )();
});
