import "server-only";
import { cache } from "@/lib/cache";
import { ZId } from "@formbricks/types/common";
import { hasUserEnvironmentAccess } from "../environment/auth";
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
