import "server-only";

import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getActionClass } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { actionClassCache } from "./cache";
import { getMembershipByUserIdTeamId } from "../../lib/membership/service";
import { getAccessFlags } from "../../lib/membership/utils";

export const canUserUpdateActionClass = async (
  userId: string,
  actionClassId: string,
  teamId: string
): Promise<boolean> =>
  await unstable_cache(
    async () => {
      const currentUserMembership = await getMembershipByUserIdTeamId(userId, teamId);
      const { isViewer } = getAccessFlags(currentUserMembership?.role);

      if (isViewer) {
        return false;
      }

      validateInputs([userId, ZId], [actionClassId, ZId]);
      if (!userId) return false;

      const actionClass = await getActionClass(actionClassId);
      if (!actionClass) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, actionClass.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },

    [`users-${userId}-actionClasses-${actionClassId}`],
    {
      revalidate: SERVICES_REVALIDATION_INTERVAL,
      tags: [actionClassCache.tag.byId(actionClassId)],
    }
  )();
