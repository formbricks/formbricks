"use server";
import { generateSurveySingleUseId } from "@/lib/singleUseSurveys";
import { authOptions } from "@formbricks/lib/authOptions";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { getServerSession } from "next-auth";

export async function generateSingleUseIdAction(surveyId: string, isEncrypted: boolean): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasUserSurveyAccess = await canUserAccessSurvey(session.user.id, surveyId);

  if (!hasUserSurveyAccess) throw new AuthorizationError("Not authorized");

  return generateSurveySingleUseId(isEncrypted);
}
