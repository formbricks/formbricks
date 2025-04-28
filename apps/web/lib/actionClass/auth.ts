import "server-only";
import { cache } from "@/lib/cache";
import { ZId } from "@formbricks/types/common";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { actionClassCache } from "./cache";
import { getActionClass } from "./service";

export const canUserUpdateActionClass = (userId: string, actionClassId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [actionClassId, ZId]);

      try {
        if (!userId) return false;

        const actionClass = await getActionClass(actionClassId);
        if (!actionClass) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, actionClass.environmentId);

        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },

    [`canUserUpdateActionClass-${userId}-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
    }
  )();
