"use server";

import { getResponseCountBySurveyId, getResponses } from "@/lib/response/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromSurveyId, getProjectIdFromSurveyId } from "@/lib/utils/helper";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import { getSurveySummary } from "./summary/lib/surveySummary";

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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
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
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromSurveyId(parsedInput.surveyId),
      access: [
        {
          type: "organization",
          schema: ZResponseFilterCriteria,
          data: parsedInput.filterCriteria,
          roles: ["owner", "manager"],
        },
        {
          type: "projectTeam",
          minPermission: "read",
          projectId: await getProjectIdFromSurveyId(parsedInput.surveyId),
        },
      ],
    });

    return getResponseCountBySurveyId(parsedInput.surveyId, parsedInput.filterCriteria);
  });
