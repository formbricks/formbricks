import { ZId } from "@formbricks/types/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getSurvey } from "./service";
import { surveyCache } from "./cache";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getMembershipByUserIdTeamId } from "../../lib/membership/service";
import { getAccessFlags } from "../../lib/membership/utils";
import { getTeamByEnvironmentId } from "../../lib/team/service";

export const canUserAccessSurvey = async (userId: string, surveyId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([surveyId, ZId], [userId, ZId]);

      if (!userId) return false;

      const survey = await getSurvey(surveyId);
      if (!survey) throw new Error("Survey not found");

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`canUserAccessSurvey-${userId}-${surveyId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [surveyCache.tag.byId(surveyId)] }
  )();

export const verifyUserRoleAccess = async (
  environmentId: string,
  userId: string
): Promise<{
  hasCreateOrUpdateAccess: boolean;
  hasDeleteAccess: boolean;
}> =>
  await unstable_cache(
    async () => {
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
    },
    [`users-${userId}-verifyUserRoleAccessOnSurvey-${new Date().getTime()}`],
    {
      revalidate: 60 * 60 * 24,
    }
  )();
