"use server";

import { getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { getSurveyByResultShareKey } from "@formbricks/lib/survey/service";
import { TResponse, TResponseFilterCriteria, TSurveySummary } from "@formbricks/types/responses";

export async function getResultShareUrlSurveyAction(key: string): Promise<string | null> {
  return getSurveyByResultShareKey(key);
}

export async function getResponsesUnauthorizedAction(
  surveyId: string,
  page: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> {
  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize, filterCriteria);
  return responses;
}

export const getSurveySummaryUnauthorizedAction = async (
  surveyId: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<TSurveySummary> => {
  return await getSurveySummary(surveyId, filterCriteria);
};
