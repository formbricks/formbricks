"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@formbricks/lib/authOptions";
import { getResponseCountBySurveyId, getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse, TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurveySummary } from "@formbricks/types/surveys/types";

export const revalidateSurveyIdPath = async (environmentId: string, surveyId: string) => {
  revalidatePath(`/environments/${environmentId}/surveys/${surveyId}`);
};

export const getResponsesAction = async (
  surveyId: string,
  limit: number = 10,
  offset: number = 0,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  const responses = await getResponses(surveyId, limit, offset, filterCriteria);
  return responses;
};

export const getSurveySummaryAction = async (
  surveyId: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<TSurveySummary> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getSurveySummary(surveyId, filterCriteria);
};

export const getResponseCountAction = async (
  surveyId: string,
  filters?: TResponseFilterCriteria
): Promise<number> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await getResponseCountBySurveyId(surveyId, filters);
};
