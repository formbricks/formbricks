import "server-only";

import { ZId } from "@formbricks/types/environment";

import { hasUserEnvironmentAccess } from "../environment/auth";
import { getMembershipByUserIdTeamId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { getTeamByEnvironmentId } from "../team/service";
import { validateInputs } from "../utils/validate";
import { getTag } from "./service";

export const canUserAccessTag = async (userId: string, tagId: string): Promise<boolean> => {
  validateInputs([userId, ZId], [tagId, ZId]);

  try {
    const tag = await getTag(tagId);
    if (!tag) return false;

    const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, tag.environmentId);
    if (!hasAccessToEnvironment) return false;

    return true;
  } catch (error) {
    throw error;
  }
};

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
