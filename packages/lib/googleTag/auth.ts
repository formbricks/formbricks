import { ZId } from "@formbricks/types/environment";

import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { googleTagCache } from "./cache";
import { getGoogleTag } from "./service";

export const canUserAccessGoogleTag = async (userId: string, id: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [id, ZId]);

      try {
        const googleTag = await getGoogleTag(id);
        if (!googleTag) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, googleTag.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessGoogletag-${userId}-${id}`],
    {
      tags: [googleTagCache.tag.byId(id)],
    }
  )();
