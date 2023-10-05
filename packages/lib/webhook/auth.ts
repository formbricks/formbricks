import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getWebhook } from "./service";
import { unstable_cache } from "next/cache";
import { ZId } from "@formbricks/types/v1/environment";

export const canUserAccessWebhook = async (userId: string, webhookId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [webhookId, ZId]);

      const webhook = await getWebhook(webhookId);
      if (!webhook) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, webhook.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`${userId}-${webhookId}`],
    {
      revalidate: 30 * 60, // 30 minutes
    }
  )();
