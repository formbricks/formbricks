import { Response } from "@prisma/client";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  TExpandParam,
  TExpandedResponseData,
  TResponseExpansions,
  expandWithChoiceIds,
  getQuestionHeadlines,
} from "./expand";

export type TTransformedResponse = Omit<Response, "data"> & {
  data: TResponseData | TExpandedResponseData;
  expansions?: TResponseExpansions;
};

/**
 * Transform a response based on requested expansions
 * @param response - The raw response from the database
 * @param survey - The survey definition
 * @param expand - Array of expansion keys to apply
 * @returns Transformed response with requested expansions
 */
export const transformResponse = (
  response: Response,
  survey: TSurvey,
  expand: TExpandParam
): TTransformedResponse => {
  const language = response.language ?? "default";
  const data = response.data as TResponseData;

  let transformedData: TResponseData | TExpandedResponseData = data;
  const expansions: TResponseExpansions = {};

  // Apply choiceIds expansion
  if (expand.includes("choiceIds")) {
    transformedData = expandWithChoiceIds(data, survey, language);
  }

  // Apply questionHeadlines expansion
  if (expand.includes("questionHeadlines")) {
    expansions.questionHeadlines = getQuestionHeadlines(data, survey, language);
  }

  return {
    ...response,
    data: transformedData,
    ...(Object.keys(expansions).length > 0 && { expansions }),
  };
};

/**
 * Transform multiple responses with caching of survey lookups
 * @param responses - Array of raw responses from the database
 * @param expand - Array of expansion keys to apply
 * @param getSurvey - Function to fetch survey by ID
 * @returns Array of transformed responses
 */
export const transformResponses = async (
  responses: Response[],
  expand: TExpandParam,
  getSurvey: (surveyId: string) => Promise<TSurvey | null>
): Promise<TTransformedResponse[]> => {
  if (expand.length === 0) {
    // No expansion requested, return as-is
    return responses as TTransformedResponse[];
  }

  // Cache surveys to avoid duplicate lookups
  const surveyCache = new Map<string, TSurvey | null>();

  const transformed = await Promise.all(
    responses.map(async (response) => {
      let survey = surveyCache.get(response.surveyId);

      if (survey === undefined) {
        survey = await getSurvey(response.surveyId);
        surveyCache.set(response.surveyId, survey);
      }

      if (!survey) {
        // Survey not found, return response unchanged
        return response as TTransformedResponse;
      }

      return transformResponse(response, survey, expand);
    })
  );

  return transformed;
};
