import "server-only";

import { ZId } from "@formbricks/types/environment";

import { cache } from "../cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { apiKeyCache } from "./cache";
import { getApiKey } from "./service";

export const canUserAccessApiKey = (userId: string, apiKeyId: string): Promise<boolean> =>
  cache(
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
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [apiKeyCache.tag.byId(apiKeyId)] }
  )();
