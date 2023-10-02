"use server";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { deleteSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function updateSurveyAction(survey: TSurvey): Promise<TSurvey> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, survey.id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateSurvey(survey);
}

export const deleteSurveyAction = async (surveyId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  await deleteSurvey(surveyId);
};
