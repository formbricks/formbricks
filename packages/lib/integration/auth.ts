import "server-only";

import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getIntegrationById } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessIntegration = async (userId: string, integrationId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [integrationId, ZId]);
      if (!userId) return false;

      const integration = await getIntegrationById(integrationId);
      if (!integration) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, integration.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-integrations-${integrationId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`integrations-${integrationId}`] }
  )();
