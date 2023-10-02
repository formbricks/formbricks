import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getSurvey, getSurveyCacheTag } from "./service";
import { unstable_cache } from "next/cache";

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
    { revalidate: 30 * 60, tags: [getSurveyCacheTag(surveyId)] }
  )(); // 30 minutes
