"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { generateSurveySingleUseId } from "@formbricks/lib/utils/singleUseSurveys";
import { AuthorizationError } from "@formbricks/types/errors";

export const generateSingleUseIdAction = async (surveyId: string, isEncrypted: boolean): Promise<string> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);

  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return generateSurveySingleUseId(isEncrypted);
};
