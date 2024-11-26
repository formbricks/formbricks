"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getOrganizationIdFromSurveyId } from "@formbricks/lib/organization/utils";
import { getResponseCountBySurveyId, getResponses, getSurveySummary } from "@formbricks/lib/response/service";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";

export const revalidateSurveyIdPath = async (environmentId: string, surveyId: string) => {
  revalidatePath(`/environments/${environmentId}/surveys/${surveyId}`);
};

const ZGetResponsesAction = z.object({
  surveyId: ZId,
  limit: z.number().optional(),
  offset: z.number().optional(),
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponsesAction = authenticatedActionClient
  .schema(ZGetResponsesAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "read"],
    });

    return getResponses(
      parsedInput.surveyId,
      parsedInput.limit,
      parsedInput.offset,
      parsedInput.filterCriteria
    );
  });

const ZGetSurveySummaryAction = z.object({
  surveyId: ZId,
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getSurveySummaryAction = authenticatedActionClient
  .schema(ZGetSurveySummaryAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "read"],
    });

    return getSurveySummary(parsedInput.surveyId, parsedInput.filterCriteria);
  });

const ZGetResponseCountAction = z.object({
  surveyId: ZId,
  filterCriteria: ZResponseFilterCriteria.optional(),
});

export const getResponseCountAction = authenticatedActionClient
  .schema(ZGetResponseCountAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      rules: ["response", "read"],
    });

    return getResponseCountBySurveyId(parsedInput.surveyId, parsedInput.filterCriteria);
  });
