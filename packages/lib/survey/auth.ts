import { hasUserEnvironmentAccess } from "../environment/auth";
import { getSurvey } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessSurvey = async (userId: string, surveyId: string): Promise<boolean> =>
  await unstable_cache(
    async () => {
      if (!userId) return false;

      const survey = await getSurvey(surveyId);
      if (!survey) throw new Error("Survey not found");

      const hasAccessToEnvironment = await hasUserEnvironmentAccess(userId, survey.environmentId);
      if (!hasAccessToEnvironment) return false;

      return true;
    },
    [`users-${userId}-surveys-${surveyId}`],
    { revalidate: 30 * 60, tags: [`surveys-${surveyId}`] }
  )(); // 30 minutes
