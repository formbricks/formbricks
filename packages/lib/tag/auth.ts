import "server-only";

import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getTag } from "./service";
import { unstable_cache } from "next/cache";
import { ZId } from "@formbricks/types/v1/environment";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId]);

      const tag = await getTag(tagId);
      if (!tag) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, tag.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`${userId}-${tagId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
