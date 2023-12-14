import "server-only";

import { SERVICES_REVALIDATION_INTERVAL } from "@/constants";
import { hasUserEnvironmentAccess } from "@/environment/auth";
import { getMembershipByUserIdTeamId } from "@/membership/service";
import { getAccessFlags } from "@/membership/utils";
import { getTeamByEnvironmentId } from "@/team/service";
import { validateInputs } from "@/utils/validate";
import { unstable_cache } from "next/cache";

import { ZId } from "@formbricks/types/environment";

import { getTag } from "./service";

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

export const verifyUserRoleAccess = async (
  environmentId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> => {
  const team = await getTeamByEnvironmentId(environmentId);
  if (!team) {
    throw new Error("Team not found");
  }
  const currentUserMembership = await getMembershipByUserIdTeamId(userId, team.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  if (isViewer) {
    return {
      hasCreateOrUpdateAccess: false,
      hasDeleteAccess: false,
    };
  }

  return {
    hasCreateOrUpdateAccess: true,
    hasDeleteAccess: true,
  };
};
