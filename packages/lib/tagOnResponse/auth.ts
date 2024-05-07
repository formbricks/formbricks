import "server-only";

import { ZId } from "@formbricks/types/environment";

import { cache } from "../cache";
import { getMembershipByUserIdTeamId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { canUserAccessResponse } from "../response/auth";
import { canUserAccessTag } from "../tag/auth";
import { getTeamByEnvironmentId } from "../team/service";
import { validateInputs } from "../utils/validate";
import { tagOnResponseCache } from "./cache";

export const canUserAccessTagOnResponse = (
  userId: string,
  tagId: string,
  responseId: string
): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId], [responseId, ZId]);

      try {
        const isAuthorizedForTag = await canUserAccessTag(userId, tagId);
        const isAuthorizedForResponse = await canUserAccessResponse(userId, responseId);

        return isAuthorizedForTag && isAuthorizedForResponse;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessTagOnResponse-${userId}-${tagId}-${responseId}`],
    {
      tags: [tagOnResponseCache.tag.byResponseIdAndTagId(responseId, tagId)],
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
