import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { getOrganizationByEnvironmentId } from "../organization/service";
import { canUserAccessResponse } from "../response/auth";
import { canUserAccessTag } from "../tag/auth";
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
  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(userId, organization.id);
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
