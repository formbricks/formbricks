import { cache } from "@/lib/cache";
import { ZId } from "@formbricks/types/common";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { validateInputs } from "../utils/validate";
import { surveyCache } from "./cache";
import { getSurvey } from "./service";

export const canUserAccessSurvey = (userId: string, surveyId: string): Promise<boolean> =>
  cache(
    async () => {
      validateInputs([surveyId, ZId], [userId, ZId]);

      if (!userId) return false;

      try {
        const survey = await getSurvey(surveyId);
        if (!survey) throw new Error("Survey not found");

        const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
        if (!hasAccessToEnvironment) return false;

        return true;
      } catch (error) {
        throw error;
      }
    },
    [`canUserAccessSurvey-${userId}-${surveyId}`],
    {
      tags: [surveyCache.tag.byId(surveyId)],
    }
  )();
