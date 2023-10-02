import { hasUserEnvironmentAccessCached } from "../environment/auth";
import { getSurvey } from "./service";
import { unstable_cache } from "next/cache";

export const canUserAccessSurvey = async (userId: string, surveyId: string): Promise<boolean> => {
  if (!userId) return false;

  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Survey not found");

  const hasAccessToEnvironment = await hasUserEnvironmentAccessCached(userId, survey.environmentId);
  if (!hasAccessToEnvironment) return false;

  return true;
};

export const canUserAccessSurveyCached = async (userId: string, surveyId: string) =>
  await unstable_cache(
    async () => {
      return await canUserAccessSurvey(userId, surveyId);
    },
    [`${userId}-${surveyId}`],
    {
      revalidate: 30 * 60, // 30 minutes
    }
  )();
