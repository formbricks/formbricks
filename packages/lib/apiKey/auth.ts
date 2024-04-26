import "server-only";

import { unstable_cache } from "next/cache";

import { ZId } from "@formbricks/types/environment";

import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { apiKeyCache } from "./cache";
import { getApiKey } from "./service";

export const canUserAccessApiKey = async (userId: string, apiKeyId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [apiKeyId, ZId]);

      try {
        const apiKeyFromServer = await getApiKey(apiKeyId);
        if (!apiKeyFromServer) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, apiKeyFromServer.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },

    [`canUserAccessApiKey-${userId}-${apiKeyId}`],
    { tags: [apiKeyCache.tag.byId(apiKeyId)] }
  )();
