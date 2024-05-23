"use server";

import {
  getResponseCountBySurveyId,
  getResponseMeta,
  getResponsePersonAttributes,
  getResponses,
  getSurveySummary,
} from "@formbricks/lib/response/service";
import { getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TResponse, TResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurveySummary } from "@formbricks/types/surveys";

export const getResponsesBySurveySharingKeyAction = async (
  sharingKey: string,
  page: number,
  batchSize?: number,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> => {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  batchSize = batchSize ?? 10;
  const responses = await getResponses(surveyId, page, batchSize, filterCriteria);
  return responses;
};

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

export const getSurveyFilterDataBySurveySharingKeyAction = async (
  sharingKey: string,
  environmentId: string
) => {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  const [tags, attributes, meta] = await Promise.all([
    getTagsByEnvironmentId(environmentId),
    getResponsePersonAttributes(surveyId),
    getResponseMeta(surveyId),
  ]);

  return { environmentTags: tags, attributes, meta };
};
