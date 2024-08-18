"use server";

import { z } from "zod";
import { actionClient } from "@formbricks/lib/actionClient";
import {
  getResponseCountBySurveyId,
  getResponseFilteringValues,
  getResponses,
  getSurveySummary,
} from "@formbricks/lib/response/service";
import { getSurveyIdByResultShareKey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { ZId } from "@formbricks/types/environment";
import { AuthorizationError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";

const ZGetResponsesBySurveySharingKeyAction = z.object({
  sharingKey: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponsesBySurveySharingKeyAction = actionClient
  .schema(ZGetResponsesBySurveySharingKeyAction)
  .action(async ({ parsedInput }) => {
    const surveyId = await getSurveyIdByResultShareKey(parsedInput.sharingKey);
    if (!surveyId) throw new AuthorizationError("Not authorized");

    const responses = await getResponses(
      surveyId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
    return responses;
  });

const ZGetSummaryBySurveySharingKeyAction = z.object({
  sharingKey: z.string(),
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getSummaryBySurveySharingKeyAction = actionClient
  .schema(ZGetSummaryBySurveySharingKeyAction)
  .action(async ({ parsedInput }) => {
    const surveyId = await getSurveyIdByResultShareKey(parsedInput.sharingKey);
    if (!surveyId) throw new AuthorizationError("Not authorized");

    return await getSurveySummary(surveyId, parsedInput.filterCriteria);
  });

const ZGetResponseCountBySurveySharingKeyAction = z.object({
  sharingKey: z.string(),
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponseCountBySurveySharingKeyAction = actionClient
  .schema(ZGetResponseCountBySurveySharingKeyAction)
  .action(async ({ parsedInput }) => {
    const surveyId = await getSurveyIdByResultShareKey(parsedInput.sharingKey);
    if (!surveyId) throw new AuthorizationError("Not authorized");

    return await getResponseCountBySurveyId(surveyId, parsedInput.filterCriteria);
  });

const ZGetSurveyFilterDataBySurveySharingKeyAction = z.object({
  sharingKey: z.string(),
  environmentId: ZId,
});

export const getSurveyFilterDataBySurveySharingKeyAction = actionClient
  .schema(ZGetSurveyFilterDataBySurveySharingKeyAction)
  .action(async ({ parsedInput }) => {
    const surveyId = await getSurveyIdByResultShareKey(parsedInput.sharingKey);
    if (!surveyId) throw new AuthorizationError("Not authorized");

    const [tags, { personAttributes: attributes, meta, hiddenFields }] = await Promise.all([
      getTagsByEnvironmentId(parsedInput.environmentId),
      getResponseFilteringValues(surveyId),
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields };
  });
