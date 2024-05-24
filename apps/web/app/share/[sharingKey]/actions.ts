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
  limit: number = 10,
  offset: number = 0,
  filterCriteria?: TResponseFilterCriteria
): Promise<TResponse[]> => {
  const surveyId = await getSurveyIdByResultShareKey(sharingKey);
  if (!surveyId) throw new AuthorizationError("Not authorized");

  const responses = await getResponses(surveyId, limit, offset, filterCriteria);
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
