import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { hasUserEnvironmentAccess } from "../environment/auth";
import { getResponse } from "./service";
import { unstable_cache } from "next/cache";
import { getSurvey } from "../services/survey";

export const canUserAccessResponse = async (userId: string, responseId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      validateInputs([userId, ZId], [responseId, ZId]);

      if (!userId) return false;

      const response = await getResponse(responseId);
      if (!response) return false;

      const survey = await getSurvey(response.surveyId);
      if (!survey) return false;

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`users-${userId}-responses-${responseId}`],
    { revalidate: 30 * 60, tags: [`responses-${responseId}`] }
  )(); // 30 minutes
