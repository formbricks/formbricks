"use server";

import { createSurvey } from "@formbricks/lib/survey/service";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";

export async function createSurveyAction(environmentId: string, surveyBody: any) {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (isAuthorized) {
    return await createSurvey(environmentId, surveyBody);
  } else {
    throw new AuthorizationError("Not authorized");
  }
}
