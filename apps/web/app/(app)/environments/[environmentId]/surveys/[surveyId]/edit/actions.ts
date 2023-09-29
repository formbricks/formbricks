"use server";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { deleteSurvey, getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccessCached } from "@formbricks/lib/environment/auth";

export async function surveyMutateAction(survey: TSurvey): Promise<TSurvey> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const fetchedSurvey = await getSurvey(survey.id);
  if (!fetchedSurvey) throw new Error("Survey not found");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, fetchedSurvey.environmentId);

  if (isAuthorized) {
    return await updateSurvey(survey);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error("Survey not found");

  const isAuthorized = await hasUserEnvironmentAccessCached(session.user.id, survey.environmentId);

  if (isAuthorized) {
    await deleteSurvey(surveyId);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};
