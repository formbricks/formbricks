import { unstable_cache } from "next/cache";
import "server-only";

import { ZId } from "@formbricks/types/environment";

import { getMembershipByUserIdTeamId } from "../../lib/membership/service";
import { getAccessFlags } from "../../lib/membership/utils";
import { getTeamByEnvironmentId } from "../../lib/team/service";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { actionClassCache } from "./cache";
import { getActionClass } from "./service";

export const canUserUpdateActionClass = async (userId: string, actionClassId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
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

export const verifyUserRoleAccess = async (
  environmentId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> => {
  const accessObject = {
    hasCreateOrUpdateAccess: true,
    hasDeleteAccess: true,
  };

  const team = await getTeamByEnvironmentId(environmentId);
  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(userId, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  if (isViewer) {
    accessObject.hasCreateOrUpdateAccess = false;
    accessObject.hasDeleteAccess = false;
  }
  return accessObject;
};
