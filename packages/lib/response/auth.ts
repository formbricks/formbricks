import "server-only";
import { ZId } from "@formbricks/types/environment";
import { cache } from "../cache";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getMembershipByUserIdOrganizationId } from "../membership/service";
import { getAccessFlags } from "../membership/utils";
import { getOrganizationByEnvironmentId } from "../organization/service";
import { getSurvey } from "../survey/service";
import { validateInputs } from "../utils/validate";
import { responseCache } from "./cache";
import { getResponse } from "./service";

export const canUserAccessResponse = (userId: string, responseId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([userId, ZId], [responseId, ZId]);

      if (!userId) return false;

      try {
        const response = await getResponse(responseId);
        if (!response) return false;

        const survey = await getSurvey(response.surveyId);
        if (!survey) return false;

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessResponse-${userId}-${responseId}`],
    {
      tags: [responseCache.tag.byId(responseId)],
    }
  )();

export const verifyUserRoleAccess = async (
  responseId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new Error("Response not found");
  }

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    throw new Error("Survey not found");
  }

  const organization = await getOrganizationByEnvironmentId(survey.environmentId);
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
