import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
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
    { tags: [apiKeyCache.tag.byId(apiKeyId)] }
  )();
