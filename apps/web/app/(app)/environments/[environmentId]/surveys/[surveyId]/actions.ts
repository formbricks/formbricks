"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import { getResponseDownloadUrl } from "@formbricks/lib/response/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponseFilterCriteria } from "@formbricks/types/responses";

export async function getResponsesDownloadUrlAction(
  surveyId: string,
  format: "csv" | "xlsx",
  filterCritera: TResponseFilterCriteria
): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return getResponseDownloadUrl(surveyId, format, filterCritera);
}
