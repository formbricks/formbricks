import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { getIntegration } from "./service";

export const canUserAccessIntegration = async (userId: string, integrationId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [integrationId, ZId]);
      if (!userId) return false;

      try {
        const integration = await getIntegration(integrationId);
        if (!integration) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, integration.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },

    [`canUserAccessIntegration-${userId}-${integrationId}`],
    {
      tags: [`integrations-${integrationId}`],
    }
  )();
