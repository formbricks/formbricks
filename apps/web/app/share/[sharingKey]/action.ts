"use server";

import { getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { getSurveyByResultShareKey } from "@formbricks/lib/survey/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse, TResponseFilterCriteria, TSurveySummary } from "@formbricks/types/responses";

export async function getResultShareUrlSurveyAction(key: string): Promise<string | null> {
  return getSurveyByResultShareKey(key);
}

export async function getResponsesUnauthorizedAction(
  sharingKey: string,
  page: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> {
  const surveyId = await getSurveyByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize, filterCriteria);
  return responses;
}

export const getSurveySummaryUnauthorizedAction = async (
  sharingKey: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<TSurveySummary> => {
  const surveyId = await getSurveyByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  return await getSurveySummary(surveyId, filterCriteria);
};
