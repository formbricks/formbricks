"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@formbricks/lib/authOptions";
import { getResponseCountBySurveyId, getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { canUserAccessSurvey } from "@formbricks/lib/survey/auth";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse, TResponseFilterCriteria, TSurveySummary } from "@formbricks/types/responses";

export default async function revalidateSurveyIdPath(environmentId: string, surveyId: string) {
  revalidatePath(`/environments/${environmentId}/surveys/${surveyId}`);
}

export async function getMoreResponses(
  surveyId: string,
  page: number,
  batchSize?: number
): Promise<TResponse[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize);
  return responses;
}

export async function getResponsesAction(
  surveyId: string,
  page: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessSurvey(session.user.id, surveyId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize, filterCriteria);
  return responses;
}

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
