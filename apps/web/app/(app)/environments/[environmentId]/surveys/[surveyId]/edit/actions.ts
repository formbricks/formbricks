"use server";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { deleteSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { canUserAccessSurveyCached } from "@formbricks/lib/survey/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";

export async function surveyMutateAction(survey: TSurvey): Promise<TSurvey> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessSurveyCached(session.user.id, survey.id);
  if (isAuthorized) {
    return await updateSurvey(survey);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
}

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("You are not authorized to perform this action.");

  const isAuthorized = await canUserAccessSurveyCached(session.user.id, surveyId);
  if (isAuthorized) {
    await deleteSurvey(surveyId);
  } else {
    throw new Error("You are not authorized to perform this action.");
  }
};
