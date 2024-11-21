import "server-only";
import { ZId } from "@formbricks/types/common";
import { cache } from "../cache";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { getOrganizationByEnvironmentId } from "../organization/service";
import { canUserAccessSurvey } from "../survey/auth";
import { canUserAccessTag } from "../tag/auth";
import { validateInputs } from "../utils/validate";
import { tagOnSurveyCache } from "./cache";

export const canUserAccessTagOnSurvey = (userId: string, tagId: string, surveyId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [tagId, ZId], [surveyId, ZId]);

      try {
        const isAuthorizedForTag = await canUserAccessTag(userId, tagId);
        const isAuthorizedForSurvey = await canUserAccessSurvey(userId, surveyId);

        return isAuthorizedForTag && isAuthorizedForSurvey;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessTagOnSurvey-${userId}-${tagId}-${surveyId}`],
    {
      tags: [tagOnSurveyCache.tag.bySurveyIdAndTagId(surveyId, tagId)],
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
