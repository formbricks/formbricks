import "server-only";

import { unstable_cache } from "next/cache";

import { ZId } from "@formbricks/types/environment";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { getIntegration } from "./service";

export const canUserAccessIntegration = async (userId: string, integrationId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [integrationId, ZId]);
      if (!userId) return false;

      const integration = await getIntegration(integrationId);
      if (!integration) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, integration.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-integrations-${integrationId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [`integrations-${integrationId}`] }
  )();
