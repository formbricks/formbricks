"use server";

import { getResponseCountBySurveyId, getResponseFilteringValues, getResponses } from "@/lib/response/service";
import { getSurveyIdByResultShareKey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { actionClient } from "@/lib/utils/action-client";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { getSurveySummary } from "../../(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";

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

    const [tags, { contactAttributes: attributes, meta, hiddenFields }] = await Promise.all([
      getTagsByEnvironmentId(parsedInput.environmentId),
      getResponseFilteringValues(surveyId),
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields };
  });
