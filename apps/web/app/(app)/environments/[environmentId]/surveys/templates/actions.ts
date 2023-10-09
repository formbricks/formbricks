"use server";

import { createSurvey } from "@formbricks/lib/survey/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { TSurveyInput } from "@formbricks/types/v1/surveys";

export async function createSurveyAction(environmentId: string, surveyBody: TSurveyInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createSurvey(environmentId, surveyBody);
}
