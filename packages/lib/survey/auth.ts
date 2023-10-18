import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getSurvey, getSurveyCacheTag } from "./service";
import { unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

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
    [`users-${userId}-surveys-${surveyId}`],
    { revalidate: SERVICES_REVALIDATION_INTERVAL, tags: [getSurveyCacheTag(surveyId)] }
  )();
