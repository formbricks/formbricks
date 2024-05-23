"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@formbricks/lib/authOptions";
import {
  getResponseDownloadUrl,
  getResponseMeta,
  getResponsePersonAttributes,
} from "@formbricks/lib/response/service";
import { canUserAccessSurvey, verifyUserRoleAccess } from "@formbricks/lib/survey/auth";
import { updateSurvey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

export const getResponsesDownloadUrlAction = async (
  surveyId: string,
  format: "csv" | "xlsx",
  filterCritera: TResponseFilterCriteria
): Promise<string> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return getResponseDownloadUrl(surveyId, format, filterCritera);
};

export const getSurveyFilterDataAction = async (surveyId: string, environmentId: string) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const [tags, attributes, meta] = await Promise.all([
    getTagsByEnvironmentId(environmentId),
    getResponsePersonAttributes(surveyId),
    getResponseMeta(surveyId),
  ]);

  return { environmentTags: tags, attributes, meta };
};

export const updateSurveyAction = async (survey: TSurvey): Promise<TSurvey> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, survey.id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const { hasCreateOrUpdateAccess } = await verifyUserRoleAccess(survey.environmentId, session.user.id);
  if (!hasCreateOrUpdateAccess) throw new AuthorizationError("Not authorized");

  return await updateSurvey(survey);
};
