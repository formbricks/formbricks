"use server";

import { getResponseCountBySurveyId, getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse, TResponseFilterCriteria, TSurveySummary } from "@formbricks/types/responses";

export async function getResponsesBySurveySharingKeyAction(
  sharingKey: string,
  page: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize, filterCriteria);
  return responses;
}

export const getSummaryBySurveySharingKeyAction = async (
  sharingKey: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<TSurveySummary> => {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  return await getSurveySummary(surveyId, filterCriteria);
};

export const getResponseCountBySurveySharingKeyAction = async (
  sharingKey: string,
  filterCriteria?: TResponseFilterCriteria
): Promise<number> => {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  return await getResponseCountBySurveyId(surveyId, filterCriteria);
};
