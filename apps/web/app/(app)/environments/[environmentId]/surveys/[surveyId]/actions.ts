"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromSurveyId } from "@formbricks/lib/organization/utils";
import { getResponseDownloadUrl, getResponseFilteringValues } from "@formbricks/lib/response/service";
import { getSurvey, updateSurvey } from "@formbricks/lib/survey/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { ZId } from "@formbricks/types/common";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { ZSurvey } from "@formbricks/types/surveys/types";

const ZGetResponsesDownloadUrlAction = z.object({
  surveyId: ZId,
  format: z.union([z.literal("csv"), z.literal("xlsx")]),
  filterCriteria: ZResponseFilterCriteria,
});

export const getResponsesDownloadUrlAction = authenticatedActionClient
  .schema(ZGetResponsesDownloadUrlAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "read"],
    });

    return getResponseDownloadUrl(parsedInput.surveyId, parsedInput.format, parsedInput.filterCriteria);
  });

const ZGetSurveyFilterDataAction = z.object({
  surveyId: ZId,
});

export const getSurveyFilterDataAction = authenticatedActionClient
  .schema(ZGetSurveyFilterDataAction)
  .action(async ({ ctx, parsedInput }) => {
    const survey = await getSurvey(parsedInput.surveyId);

    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["survey", "read"],
    });

    const [tags, { personAttributes: attributes, meta, hiddenFields }] = await Promise.all([
      getTagsByEnvironmentId(survey.environmentId),
      getResponseFilteringValues(parsedInput.surveyId),
    ]);

    return { environmentTags: tags, attributes, meta, hiddenFields };
  });

const ZUpdateSurveyAction = z.object({
  survey: ZSurvey,
});

export const updateSurveyAction = authenticatedActionClient
  .schema(ZUpdateSurveyAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.survey.id),
      rules: ["survey", "update"],
    });

    return await updateSurvey(parsedInput.survey);
  });
